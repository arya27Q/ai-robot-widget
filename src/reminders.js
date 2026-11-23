/**
 * Reminder Manager with localStorage persistence, Countdown & HH:MM scheduling,
 * active ringing queue, Complete & Snooze 5m actions.
 */

const STORAGE_KEY = "ai_robot_reminders_v1";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatClockTime(timestamp) {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  if (totalSec < 60) {
    return `${totalSec}d`;
  }
  const totalMin = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (totalMin < 60) {
    return `${totalMin}m ${String(sec).padStart(2, "0")}d`;
  }
  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hrs}j ${String(min).padStart(2, "0")}m`;
}

export class ReminderManager {
  constructor({ onTrigger, onChange }) {
    this.onTrigger = onTrigger;
    this.onChange = onChange;

    this.reminders = this._load();
    this.ringingQueue = [];

    // Immediately evaluate due reminders that may have fired while closed
    this._checkDue();

    // High-reliability 1-second check loop
    this._intervalId = window.setInterval(() => {
      this._checkDue();
      this.onChange?.();
    }, 1000);
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.message === "string" &&
          typeof item.triggerAt === "number"
      );
    } catch {
      return [];
    }
  }

  _save() {
    try {
      const allPending = [...this.ringingQueue, ...this.reminders];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(allPending));
    } catch {
      // Ignore storage quota errors
    }
  }

  addCountdown(minutes, message) {
    const mins = Number(minutes);
    const cleanMsg = message.trim();
    if (!Number.isFinite(mins) || mins <= 0 || !cleanMsg) return null;

    const item = {
      id: generateId(),
      message: cleanMsg,
      triggerAt: Date.now() + Math.round(mins * 60 * 1000),
      createdAt: Date.now(),
      snoozedCount: 0,
    };

    this.reminders.push(item);
    this._sort();
    this._save();
    this.onChange?.();
    return item;
  }

  addClockTime(timeStr, message) {
    const cleanMsg = message.trim();
    if (!timeStr || !timeStr.includes(":") || !cleanMsg) return null;

    const [hhStr, mmStr] = timeStr.split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;

    const now = new Date();
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);

    // If the selected HH:MM has already passed today, schedule for tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const item = {
      id: generateId(),
      message: cleanMsg,
      triggerAt: target.getTime(),
      createdAt: Date.now(),
      snoozedCount: 0,
    };

    this.reminders.push(item);
    this._sort();
    this._save();
    this.onChange?.();
    return item;
  }

  remove(id) {
    this.reminders = this.reminders.filter((r) => r.id !== id);
    this._save();
    this.onChange?.();
  }

  getUpcoming() {
    this._sort();
    return [...this.reminders];
  }

  getActiveAlert() {
    return this.ringingQueue[0] || null;
  }

  getQueuedAlertCount() {
    return this.ringingQueue.length;
  }

  completeActive() {
    if (this.ringingQueue.length === 0) return null;
    const finished = this.ringingQueue.shift();
    this._save();
    this.onChange?.();
    return finished;
  }

  snoozeActive(minutes = 5) {
    if (this.ringingQueue.length === 0) return null;
    const item = this.ringingQueue.shift();
    item.triggerAt = Date.now() + minutes * 60 * 1000;
    item.snoozedCount = (item.snoozedCount || 0) + 1;
    this.reminders.push(item);
    this._sort();
    this._save();
    this.onChange?.();
    return item;
  }

  _sort() {
    this.reminders.sort((a, b) => a.triggerAt - b.triggerAt);
  }

  _checkDue() {
    const now = Date.now();
    const newlyDue = [];
    const remaining = [];

    for (const item of this.reminders) {
      if (item.triggerAt <= now) {
        newlyDue.push(item);
      } else {
        remaining.push(item);
      }
    }

    if (newlyDue.length > 0) {
      this.reminders = remaining;
      this.ringingQueue.push(...newlyDue);
      this._save();
      this.onTrigger?.(newlyDue);
      this.onChange?.();
    }
  }
}
