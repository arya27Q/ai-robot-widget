/**
 * Pomodoro / Focus Mode Engine
 * Supports Focus (25m), Short Focus (15m), Deep Focus (50m), and Break (5m).
 * Emits live progress (0..1) for the neon visor progress bar and completion callbacks.
 */

export const POMODORO_PRESETS = {
  focus: { label: "Fokus", minutes: 25, kind: "focus" },
  break: { label: "Istirahat", minutes: 5, kind: "break" },
  deep: { label: "Deep 50m", minutes: 50, kind: "focus" },
};

export function formatTimerMMSS(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export class PomodoroManager {
  constructor({ onTick, onComplete }) {
    this.onTick = onTick;
    this.onComplete = onComplete;

    this.presetKey = "focus";
    this.totalMs = POMODORO_PRESETS.focus.minutes * 60 * 1000;
    this.remainingMs = this.totalMs;
    this.running = false;
    this.endAt = null;
    this._timerId = null;
  }

  selectPreset(key) {
    if (!POMODORO_PRESETS[key]) return;
    this.pause();
    this.presetKey = key;
    this.totalMs = POMODORO_PRESETS[key].minutes * 60 * 1000;
    this.remainingMs = this.totalMs;
    this._emitTick();
  }

  start() {
    if (this.running) return;
    if (this.remainingMs <= 0) {
      this.remainingMs = this.totalMs;
    }
    this.running = true;
    this.endAt = Date.now() + this.remainingMs;
    this._emitTick();

    this._timerId = window.setInterval(() => {
      const left = Math.max(0, this.endAt - Date.now());
      this.remainingMs = left;
      this._emitTick();

      if (left <= 0) {
        const finishedPreset = this.getPreset();
        this.pause();
        this.remainingMs = 0;
        this._emitTick();
        this.onComplete?.(finishedPreset);
      }
    }, 250);
  }

  pause() {
    if (this._timerId) {
      window.clearInterval(this._timerId);
      this._timerId = null;
    }
    if (this.running && this.endAt) {
      this.remainingMs = Math.max(0, this.endAt - Date.now());
    }
    this.running = false;
    this.endAt = null;
    this._emitTick();
  }

  toggle() {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset() {
    this.pause();
    this.remainingMs = this.totalMs;
    this._emitTick();
  }

  getPreset() {
    return POMODORO_PRESETS[this.presetKey];
  }

  getState() {
    const progress =
      this.totalMs > 0 ? Math.max(0, Math.min(1, 1 - this.remainingMs / this.totalMs)) : 0;
    return {
      presetKey: this.presetKey,
      preset: this.getPreset(),
      running: this.running,
      remainingMs: this.remainingMs,
      totalMs: this.totalMs,
      formatted: formatTimerMMSS(this.remainingMs),
      progress,
      isFocusActive: this.running && this.getPreset().kind === "focus",
    };
  }

  _emitTick() {
    this.onTick?.(this.getState());
  }
}
