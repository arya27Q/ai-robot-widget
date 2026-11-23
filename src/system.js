/**
 * Real-Time PC Monitor (CPU, RAM & Laptop Battery)
 * Uses native Tauri Rust command `get_system_stats` on Windows,
 * with graceful Web Battery API fallback in browser preview.
 */

export class SystemMonitor {
  constructor({ onUpdate, onHighCpu, onLowBattery, onPluggedIn }) {
    this.onUpdate = onUpdate;
    this.onHighCpu = onHighCpu;
    this.onLowBattery = onLowBattery;
    this.onPluggedIn = onPluggedIn;

    this.lastHighCpuAlert = 0;
    this.lastLowBatAlert = 0;
    this.prevCharging = null;
    this.stats = {
      cpuPercent: 0,
      ramPercent: 0,
      ramUsedGb: 0,
      ramTotalGb: 0,
      batteryPercent: null,
      isCharging: null,
      native: false,
    };

    this._poll();
    this._interval = window.setInterval(() => this._poll(), 3000);
  }

  async _poll() {
    let next = null;

    if (window.__TAURI__?.core?.invoke) {
      try {
        const res = await window.__TAURI__.core.invoke("get_system_stats");
        next = {
          cpuPercent: res.cpu_percent ?? 0,
          ramPercent: res.ram_percent ?? 0,
          ramUsedGb: res.ram_used_gb ?? 0,
          ramTotalGb: res.ram_total_gb ?? 0,
          batteryPercent: res.battery_percent ?? null,
          isCharging: res.is_charging ?? null,
          native: true,
        };
      } catch {
        // Fallback below
      }
    }

    if (!next) {
      let batPct = null;
      let charging = null;
      if (navigator.getBattery) {
        try {
          const bat = await navigator.getBattery();
          batPct = Math.round(bat.level * 100);
          charging = Boolean(bat.charging);
        } catch {
          // Ignore
        }
      }
      next = {
        cpuPercent: null,
        ramPercent: null,
        ramUsedGb: null,
        ramTotalGb: null,
        batteryPercent: batPct,
        isCharging: charging,
        native: false,
      };
    }

    this.stats = next;
    this.onUpdate?.(next);

    const now = Date.now();

    // Reactive CPU spike reaction (cooldown 2 minutes)
    if (
      typeof next.cpuPercent === "number" &&
      next.cpuPercent >= 88 &&
      now - this.lastHighCpuAlert > 120_000
    ) {
      this.lastHighCpuAlert = now;
      this.onHighCpu?.(next.cpuPercent);
    }

    // Reactive low battery warning (cooldown 5 minutes)
    if (
      typeof next.batteryPercent === "number" &&
      next.batteryPercent <= 20 &&
      next.isCharging === false &&
      now - this.lastLowBatAlert > 300_000
    ) {
      this.lastLowBatAlert = now;
      this.onLowBattery?.(next.batteryPercent);
    }

    // Celebrate plugging in charger!
    if (this.prevCharging === false && next.isCharging === true) {
      this.onPluggedIn?.(next.batteryPercent);
    }
    if (next.isCharging !== null) {
      this.prevCharging = next.isCharging;
    }
  }

  getStats() {
    return this.stats;
  }
}
