/**
 * Expressive AI Robot Eye, Sleep/Wake, Focus, Voice & Music-Vibe Controller
 * - 60fps GPU-accelerated eye tracking (requestAnimationFrame spring lerp)
 * - Random organic blinking (3–6s, occasional double blink)
 * - Occasional subtle idle glances
 * - Double-click & "petting" (elus) -> Happy ^ ^ expression for 2s
 * - Auto-Sleep (Ngantuk -> Zzz) after inactivity or manual trigger -> Surprised Wake-Up!
 * - Focus / Pomodoro mode -> Determined eyes + neon progress bar
 * - Live Audio / Mic Visualizer -> 9 voice equalizer bars + rhythmic beat head-bob
 */

import {
  getAudioBars,
  onSoundPlay,
  playArcadeGameSound,
  playConcertBeatSound,
  playCoolSound,
  playCuriousSound,
  playDizzySound,
  playFlowerSound,
  playGiggleSound,
  playGrumpySound,
  playHappyChirp,
  playLaughSound,
  playLoveChime,
  playMovieSound,
  playSadWhimper,
  playScaredScreamSound,
  playShySound,
  playSleepLullaby,
  playSpookyGhostSound,
  playStarrySound,
  playSuitRevealSound,
  playWakeSurprise,
  playWinkSound,
} from "./audio.js";

const ALL_MOODS = [
  "happy",
  "sad",
  "love",
  "curious",
  "excited",
  "grumpy",
  "wink",
  "starry",
  "dizzy",
  "cool",
  "shy",
  "laugh",
];

const MOOD_CLASSES = ALL_MOODS.map((m) => `state-${m}`);

export class RobotController {
  constructor({
    visorEl,
    floatWrapperEl,
    eyesRigEl,
    voiceWaveEl,
    soundRingsEl,
    onMoodChange,
    onWake,
    onPet,
  }) {
    this.visorEl = visorEl;
    this.floatWrapperEl = floatWrapperEl;
    this.eyesRigEl = eyesRigEl;
    this.voiceWaveEl = voiceWaveEl;
    this.soundRingsEl = soundRingsEl;
    this.onMoodChange = onMoodChange;
    this.onWake = onWake;
    this.onPet = onPet;

    this.waveBars = voiceWaveEl
      ? Array.from(voiceWaveEl.querySelectorAll(".wave-bar"))
      : [];
    this.smoothedBars = this.waveBars.map(() => 0.18);
    this.smoothedBeat = 0;

    // Eye tracking lerp state
    this.currentX = 0;
    this.currentY = 0;
    this.targetX = 0;
    this.targetY = 0;

    // Idle glance offsets
    this.glanceX = 0;
    this.glanceY = 0;
    this.peerLookX = null;
    this.peerLookY = null;
    this.isPointerInside = false;

    // Emotion & activity states
    this.currentMood = null; // null | "happy" | "sad" | "love" | "curious" | "excited" | "grumpy"
    this.isHappy = false;
    this.isAlert = false;
    this.isFocus = false;
    this.isMicLive = false;
    this.autoMoodEnabled = true;
    this.sleepState = "awake"; // "awake" | "sleepy" | "sleeping" | "surprised"

    // Timers
    this.moodTimer = null;
    this.sceneTimer = null;
    this.currentScene = null;
    this.autoMoodPausedUntil = 0;
    this.autoMoodTimer = null;
    this.blinkTimer = null;
    this.glanceTimer = null;
    this.burstTimer = null;
    this.sleepCheckTimer = null;
    this.surprisedTimer = null;
    this.lastActivityAt = Date.now();
    this.moodCycleIndex = 0;

    // Double-tap fallback
    this.lastTapTime = 0;
    this.lastTapX = 0;
    this.lastTapY = 0;

    // Petting ("elus") gesture tracker
    this.petLastX = null;
    this.petLastDir = 0;
    this.petReversals = 0;
    this.petTravel = 0;
    this.petWindowStart = 0;

    this._bindEvents();
    this._bindSoundVisualizer();
    this._scheduleNextBlink();
    this._scheduleNextGlance();
    this._scheduleNextAutoMood();
    this._startSleepWatcher();
    this._startAnimationLoop();
  }

  markActivity(wakeIfSleeping = true) {
    this.lastActivityAt = Date.now();
    if (wakeIfSleeping && (this.sleepState === "sleeping" || this.sleepState === "sleepy")) {
      this.wakeUp(this.sleepState === "sleeping");
    }
  }

  _bindEvents() {
    window.addEventListener(
      "mousemove",
      (e) => {
        this.isPointerInside = true;
        this.lastActivityAt = Date.now();

        if (this.sleepState === "sleepy") {
          this.wakeUp(false);
        }

        const rect = this.visorEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = (e.clientX - centerX) / 140;
        const dy = (e.clientY - centerY) / 140;

        const dist = Math.hypot(dx, dy);
        const clamped = dist > 1 ? 1 / dist : 1;

        this.targetX = dx * clamped * 14;
        this.targetY = dy * clamped * 8;
      },
      { passive: true }
    );

    window.addEventListener(
      "keydown",
      () => {
        this.markActivity(true);
      },
      { passive: true }
    );

    document.addEventListener("mouseleave", () => {
      this.isPointerInside = false;
      this.targetX = this.glanceX;
      this.targetY = this.glanceY;
    });

    // Clicking a sleeping robot wakes it with a cute surprised reaction
    this.visorEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;

      if (this.sleepState === "sleeping") {
        this.wakeUp(true);
        return;
      }

      this.markActivity(true);

      const now = performance.now();
      const dt = now - this.lastTapTime;
      const moved = Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY);

      if (dt > 40 && dt < 340 && moved < 10) {
        this.lastTapTime = 0;
        this.onPet?.();
        if (this.currentMood === "sad") {
          this.triggerMood("love", 2400);
        } else {
          this.triggerHappy(2000);
        }
      } else {
        this.lastTapTime = now;
        this.lastTapX = e.clientX;
        this.lastTapY = e.clientY;
      }
    });

    this.visorEl.addEventListener("dblclick", () => {
      if (this.sleepState === "sleeping") {
        this.wakeUp(true);
      } else {
        this.onPet?.();
        if (this.currentMood === "sad") {
          this.triggerMood("love", 2400);
        } else {
          this.triggerHappy(2000);
        }
      }
    });

    // Petting ("elus") gesture over visor
    this.visorEl.addEventListener(
      "mousemove",
      (e) => {
        if (e.buttons !== 0 || this.isHappy) return;

        const now = performance.now();
        if (now - this.petWindowStart > 900) {
          this.petWindowStart = now;
          this.petReversals = 0;
          this.petTravel = 0;
          this.petLastDir = 0;
          this.petLastX = e.clientX;
          return;
        }

        if (this.petLastX !== null) {
          const dx = e.clientX - this.petLastX;
          if (Math.abs(dx) >= 3) {
            const dir = dx > 0 ? 1 : -1;
            this.petTravel += Math.abs(dx);
            if (this.petLastDir !== 0 && dir !== this.petLastDir) {
              this.petReversals += 1;
            }
            this.petLastDir = dir;
            this.petLastX = e.clientX;

            if (this.petReversals >= 3 && this.petTravel >= 85) {
              this.petReversals = 0;
              this.petTravel = 0;
              if (this.sleepState === "sleeping") {
                this.wakeUp(true);
              } else {
                this.onPet?.();
                if (this.currentMood === "sad") {
                  this.triggerMood("love", 2500);
                } else {
                  this.triggerHappy(2000);
                }
              }
            }
          }
        } else {
          this.petLastX = e.clientX;
        }
      },
      { passive: true }
    );

    this.visorEl.addEventListener("mouseleave", () => {
      this.petLastX = null;
      this.petReversals = 0;
      this.petTravel = 0;
    });
  }

  _bindSoundVisualizer() {
    onSoundPlay(({ style }) => {
      if (!this.soundRingsEl || style === "alert" || this.isAlert) return;
      this._triggerSoundBurst();
    });
  }

  _triggerSoundBurst() {
    if (!this.soundRingsEl) return;
    this.soundRingsEl.classList.remove("is-burst");
    void this.soundRingsEl.offsetWidth;
    this.soundRingsEl.classList.add("is-burst");

    if (this.burstTimer) {
      window.clearTimeout(this.burstTimer);
    }
    this.burstTimer = window.setTimeout(() => {
      this.soundRingsEl.classList.remove("is-burst");
      this.burstTimer = null;
    }, 1150);
  }

  _startSleepWatcher() {
    this.sleepCheckTimer = window.setInterval(() => {
      // Never fall asleep during active alert, focus session, happy reaction, or live mic vibe
      if (this.isAlert || this.isFocus || this.isHappy || this.isMicLive) {
        this.lastActivityAt = Date.now();
        return;
      }

      const hour = new Date().getHours();
      const isLateNight = hour >= 22 || hour < 5;
      const sleepyThresholdMs = isLateNight ? 45_000 : 90_000;
      const deepSleepThresholdMs = sleepyThresholdMs + 7_000;
      const idleMs = Date.now() - this.lastActivityAt;

      if (idleMs >= deepSleepThresholdMs && this.sleepState !== "sleeping") {
        this.enterSleep();
      } else if (idleMs >= sleepyThresholdMs && this.sleepState === "awake") {
        this.sleepState = "sleepy";
        this.visorEl.classList.add("state-sleepy");
      }
    }, 2000);
  }

  enterSleep(withSound = false) {
    if (this.isAlert) return;
    this.clearScene();
    this.clearMood();
    this.sleepState = "sleeping";
    this.visorEl.classList.remove("state-sleepy", "state-surprised", "is-blinking");
    this.visorEl.classList.add("state-sleeping");
    this.floatWrapperEl?.classList.add("is-sleeping");
    if (withSound) {
      playSleepLullaby();
    }
  }

  wakeUp(withSurprise = true) {
    this.lastActivityAt = Date.now();
    this.visorEl.classList.remove("state-sleepy", "state-sleeping");
    this.floatWrapperEl?.classList.remove("is-sleeping");

    if (!withSurprise) {
      this.sleepState = "awake";
      return;
    }

    this.sleepState = "surprised";
    this.visorEl.classList.remove("state-surprised");
    void this.visorEl.offsetWidth;
    this.visorEl.classList.add("state-surprised");
    playWakeSurprise();
    this.onWake?.();

    if (this.surprisedTimer) {
      window.clearTimeout(this.surprisedTimer);
    }
    this.surprisedTimer = window.setTimeout(() => {
      this.sleepState = "awake";
      this.visorEl.classList.remove("state-surprised");
      this.blink();
      this.surprisedTimer = null;
    }, 680);
  }

  setPeerLookTarget(dx, dy) {
    if (dx === null || dy === null) {
      this.peerLookX = null;
      this.peerLookY = null;
      return;
    }
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      this.peerLookX = 0;
      this.peerLookY = 0;
      return;
    }
    const nx = dx / Math.max(dist, 140);
    const ny = dy / Math.max(dist, 140);
    const mag = Math.hypot(nx, ny);
    const clamp = mag > 1 ? 1 / mag : 1;
    this.peerLookX = nx * clamp * 13;
    this.peerLookY = ny * clamp * 7;
  }

  _startAnimationLoop() {
    const tick = (now) => {
      const isSleeping = this.sleepState === "sleeping";
      const idleX = this.peerLookX !== null ? this.peerLookX : this.glanceX;
      const idleY = this.peerLookY !== null ? this.peerLookY : this.glanceY;

      const desiredX =
        this.isHappy || isSleeping
          ? 0
          : this.isPointerInside
          ? this.targetX
          : idleX;
      const desiredY =
        this.isHappy
          ? -2
          : isSleeping
          ? 3
          : this.isPointerInside
          ? this.targetY
          : idleY;

      const ease = 0.14;
      this.currentX += (desiredX - this.currentX) * ease;
      this.currentY += (desiredY - this.currentY) * ease;

      // 60fps Audio-Reactive Voice Equalizer & Beat Dance
      const beat = this._updateVoiceWave(now);
      this.smoothedBeat += (beat - this.smoothedBeat) * 0.25;

      // Rhythmic subtle head/eye bounce on music beat + curious head tilt
      const beatBounceY = this.isMicLive ? -this.smoothedBeat * 5.5 : 0;
      const curiousTilt = this.currentMood === "curious" ? -7 : 0;
      const beatTiltZ = this.isMicLive
        ? Math.sin(now * 0.008) * this.smoothedBeat * 6
        : curiousTilt;

      const rotY = (this.currentX / 14) * 9;
      const rotX = -(this.currentY / 8) * 7;

      this.eyesRigEl.style.transform = `translate3d(${this.currentX.toFixed(2)}px, ${(
        this.currentY + beatBounceY
      ).toFixed(2)}px, 0) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(
        2
      )}deg) rotateZ(${beatTiltZ.toFixed(2)}deg)`;

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  _updateVoiceWave(now) {
    if (this.waveBars.length === 0) return 0;

    const { playing, micActive, levels, beat } = getAudioBars(this.waveBars.length, now);
    this.isMicLive = micActive;
    this.visorEl.classList.toggle("is-speaking", playing);
    this.visorEl.classList.toggle("is-mic-live", micActive);

    if (this.soundRingsEl && !this.isAlert) {
      this.soundRingsEl.classList.toggle("is-speaking", playing || (micActive && beat > 0.35));
    }

    const active = playing || micActive || this.isAlert;
    const center = (this.waveBars.length - 1) / 2;

    for (let i = 0; i < this.waveBars.length; i++) {
      let target = 0.18;
      if (playing || micActive) {
        target = levels[i];
      } else if (this.isAlert) {
        const dist = Math.abs(i - center) / Math.max(1, center);
        const bell = 1 - dist * 0.45;
        target = (0.28 + 0.42 * Math.abs(Math.sin(now * 0.007 + i * 0.72))) * bell;
      }

      const smooth = active ? 0.34 : 0.18;
      this.smoothedBars[i] += (target - this.smoothedBars[i]) * smooth;
      this.waveBars[i].style.transform = `scale3d(1, ${this.smoothedBars[i].toFixed(3)}, 1)`;
    }

    return beat || 0;
  }

  _scheduleNextBlink() {
    const delay = 3000 + Math.random() * 3000;
    this.blinkTimer = window.setTimeout(() => {
      this.blink();
      this._scheduleNextBlink();
    }, delay);
  }

  blink() {
    if (this.isHappy || this.sleepState === "sleeping" || this.sleepState === "surprised") {
      return;
    }

    this.visorEl.classList.add("is-blinking");
    window.setTimeout(() => {
      this.visorEl.classList.remove("is-blinking");

      if (!this.isHappy && this.sleepState === "awake" && Math.random() < 0.2) {
        window.setTimeout(() => {
          if (this.isHappy || this.sleepState !== "awake") return;
          this.visorEl.classList.add("is-blinking");
          window.setTimeout(() => {
            this.visorEl.classList.remove("is-blinking");
          }, 115);
        }, 145);
      }
    }, 125);
  }

  _scheduleNextGlance() {
    const delay = 3600 + Math.random() * 3200;
    this.glanceTimer = window.setTimeout(() => {
      if (!this.isPointerInside && !this.isHappy && this.sleepState === "awake") {
        const directions = [
          { x: -10, y: -1 },
          { x: 10, y: -1 },
          { x: -8, y: -4 },
          { x: 8, y: -4 },
          { x: 0, y: -3 },
        ];
        const pick = directions[Math.floor(Math.random() * directions.length)];
        this.glanceX = pick.x;
        this.glanceY = pick.y;

        const holdMs = 1100 + Math.random() * 1100;
        window.setTimeout(() => {
          this.glanceX = 0;
          this.glanceY = 0;
        }, holdMs);
      }

      this._scheduleNextGlance();
    }, delay);
  }

  setAutoMoodEnabled(enabled) {
    this.autoMoodEnabled = Boolean(enabled);
  }

  pauseAutoMood(durationMs = 6000) {
    const until = Date.now() + durationMs;
    if (until > this.autoMoodPausedUntil) {
      this.autoMoodPausedUntil = until;
    }
  }

  _scheduleNextAutoMood() {
    const delay = 15_000 + Math.random() * 13_000;
    this.autoMoodTimer = window.setTimeout(() => {
      const canExpress =
        this.autoMoodEnabled &&
        Date.now() >= this.autoMoodPausedUntil &&
        this.sleepState === "awake" &&
        !this.isAlert &&
        !this.isFocus &&
        !this.isMicLive &&
        !this.currentMood &&
        !this.currentScene;

      if (canExpress) {
        const weightedPool = [
          "happy",
          "happy",
          "excited",
          "laugh",
          "wink",
          "starry",
          "curious",
          "love",
          "cool",
          "shy",
          "sad",
          "sad",
          "dizzy",
          "grumpy",
        ];
        const chosen = weightedPool[Math.floor(Math.random() * weightedPool.length)];
        const dur = chosen === "sad" || chosen === "cool" ? 3400 : 2500;
        this.triggerMood(chosen, dur, { source: "auto" });
      }

      this._scheduleNextAutoMood();
    }, delay);
  }

  triggerNextMood() {
    const mood = ALL_MOODS[this.moodCycleIndex % ALL_MOODS.length];
    this.moodCycleIndex += 1;
    const dur = mood === "sad" || mood === "cool" ? 3400 : 2500;
    this.triggerMood(mood, dur, { source: "manual" });
    return mood;
  }

  clearScene() {
    this.currentScene = null;
    this.visorEl.classList.remove("has-scene");
    delete this.visorEl.dataset.scene;
    if (this.sceneTimer) {
      window.clearTimeout(this.sceneTimer);
      this.sceneTimer = null;
    }
  }

  triggerScene(scene, durationMs = 2800, { muteSound = false } = {}) {
    if (this.isAlert) return;
    if (this.sleepState === "sleeping") {
      this.wakeUp(false);
    }

    this.clearMood();
    this.clearScene();
    this.currentScene = scene;
    this.visorEl.dataset.scene = scene;
    void this.visorEl.offsetWidth;
    this.visorEl.classList.add("has-scene");

    if (!muteSound) {
      switch (scene) {
        case "rock":
        case "scissors":
        case "paper":
          playSuitRevealSound(scene);
          break;
        case "flower":
          playFlowerSound();
          break;
        case "movie":
          playMovieSound();
          break;
        case "ghost":
          playSpookyGhostSound();
          break;
        case "scared":
          playScaredScreamSound();
          break;
        case "gaming":
          playArcadeGameSound();
          break;
        case "music":
          playConcertBeatSound();
          break;
        default:
          playHappyChirp();
      }
    }

    this.sceneTimer = window.setTimeout(() => {
      this.clearScene();
    }, durationMs);
  }

  clearMood() {
    this.currentMood = null;
    this.isHappy = false;
    this.visorEl.classList.remove(...MOOD_CLASSES);
    if (this.moodTimer) {
      window.clearTimeout(this.moodTimer);
      this.moodTimer = null;
    }
  }

  triggerMood(mood, durationMs = 2500, { source = "manual", muteSound = false } = {}) {
    if (this.isAlert) return;
    if (this.sleepState === "sleeping") {
      this.wakeUp(false);
    }

    this.clearScene();
    this.clearMood();
    this.currentMood = mood;
    this.isHappy = ["happy", "love", "starry", "dizzy", "shy", "laugh"].includes(mood);

    this.visorEl.classList.remove("is-blinking");
    void this.visorEl.offsetWidth;
    this.visorEl.classList.add(`state-${mood}`);

    if (!muteSound) {
      switch (mood) {
        case "happy":
          playHappyChirp();
          break;
        case "sad":
          playSadWhimper();
          break;
        case "love":
          playLoveChime();
          break;
        case "curious":
          playCuriousSound();
          break;
        case "excited":
          playGiggleSound();
          break;
        case "grumpy":
          playGrumpySound();
          break;
        case "wink":
          playWinkSound();
          break;
        case "starry":
          playStarrySound();
          break;
        case "dizzy":
          playDizzySound();
          break;
        case "cool":
          playCoolSound();
          break;
        case "shy":
          playShySound();
          break;
        case "laugh":
          playLaughSound();
          break;
        default:
          playHappyChirp();
      }
    }

    this.onMoodChange?.(mood, source);

    this.moodTimer = window.setTimeout(() => {
      this.clearMood();
    }, durationMs);
  }

  triggerHappy(durationMs = 2000) {
    this.markActivity(false);
    this.triggerMood("happy", durationMs);
  }

  setFocusMode(active) {
    this.isFocus = Boolean(active);
    if (this.isFocus) {
      this.markActivity(true);
    }
    this.visorEl.classList.toggle("state-focus", this.isFocus);
  }

  setAlertMode(active) {
    this.isAlert = Boolean(active);
    if (this.isAlert) {
      this.clearScene();
      this.clearMood();
      if (this.sleepState === "sleeping") {
        this.wakeUp(false);
      }
    }
    this.visorEl.classList.toggle("state-alert", this.isAlert);
    if (this.soundRingsEl) {
      this.soundRingsEl.classList.toggle("is-alert", this.isAlert);
      if (this.isAlert) {
        this.soundRingsEl.classList.remove("is-burst");
      }
    }
  }
}
