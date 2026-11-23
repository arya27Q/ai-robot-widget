/**
 * Virtual Pet Mode: Robot Energy Bar, Electric Snack Charging & Friendship XP Levels
 */

const PET_KEY = "ai_robot_pet_v1";

const LEVEL_TITLES = [
  "Kenalan Baru",
  "Teman Ngobrol",
  "Sobat Coding",
  "Partner Produktif",
  "Bestie Digital",
  "Soulmate AI",
  "Legenda Cyber",
];

function xpForNextLevel(level) {
  return 60 + (level - 1) * 40;
}

export class PetManager {
  constructor({ onChange, onLevelUp, onLowEnergy }) {
    this.onChange = onChange;
    this.onLevelUp = onLevelUp;
    this.onLowEnergy = onLowEnergy;
    this.lowEnergyNotified = false;
    this.state = this._load();

    // Gentle energy drain (~1% every 3 minutes)
    window.setInterval(() => {
      if (this.state.energy > 8) {
        this.state.energy = Math.max(8, this.state.energy - 1);
        this._save();
        this.onChange?.(this.getState());
        if (this.state.energy <= 22 && !this.lowEnergyNotified) {
          this.lowEnergyNotified = true;
          this.onLowEnergy?.(this.state.energy);
        }
      }
    }, 3 * 60 * 1000);
  }

  _load() {
    const defaults = {
      level: 1,
      xp: 0,
      energy: 86,
      snacksGiven: 0,
    };
    try {
      const raw = window.localStorage.getItem(PET_KEY);
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }

  _save() {
    try {
      window.localStorage.setItem(PET_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore
    }
  }

  addXp(amount) {
    this.state.xp += amount;
    let leveledUp = false;

    while (this.state.xp >= xpForNextLevel(this.state.level)) {
      this.state.xp -= xpForNextLevel(this.state.level);
      this.state.level += 1;
      leveledUp = true;
    }

    this._save();
    const snapshot = this.getState();
    this.onChange?.(snapshot);

    if (leveledUp) {
      this.onLevelUp?.(snapshot);
    }
    return leveledUp;
  }

  feedSnack() {
    this.state.energy = Math.min(100, this.state.energy + 28);
    this.state.snacksGiven += 1;
    if (this.state.energy > 30) {
      this.lowEnergyNotified = false;
    }
    const leveled = this.addXp(12);
    return { leveled, state: this.getState() };
  }

  getState() {
    const needed = xpForNextLevel(this.state.level);
    const titleIdx = Math.min(this.state.level - 1, LEVEL_TITLES.length - 1);
    return {
      ...this.state,
      xpNeeded: needed,
      xpPercent: Math.min(100, Math.round((this.state.xp / needed) * 100)),
      title: LEVEL_TITLES[titleIdx],
    };
  }
}
