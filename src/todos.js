/**
 * Quick Daily To-Do List Manager with localStorage persistence
 */

const TODO_KEY = "ai_robot_todos_v1";

function makeId() {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export class TodoManager {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.items = this._load();
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(TODO_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _save() {
    try {
      window.localStorage.setItem(TODO_KEY, JSON.stringify(this.items));
    } catch {
      // Ignore
    }
  }

  add(text) {
    const clean = text.trim();
    if (!clean) return null;
    const item = {
      id: makeId(),
      text: clean,
      done: false,
      createdAt: Date.now(),
    };
    this.items.unshift(item);
    this._save();
    this.onChange?.();
    return item;
  }

  toggle(id) {
    const target = this.items.find((i) => i.id === id);
    if (!target) return null;
    target.done = !target.done;
    this._save();
    this.onChange?.();
    return target;
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id);
    this._save();
    this.onChange?.();
  }

  getAll() {
    return [...this.items].sort((a, b) => Number(a.done) - Number(b.done));
  }

  getPendingCount() {
    return this.items.filter((i) => !i.done).length;
  }
}
