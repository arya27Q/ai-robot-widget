/**
 * AI Robot Reminder Widget — Main Entrypoint
 * Integrates:
 *  - 12 Expressive Moods + Sleep/Zzz + 100 Indonesian Greetings
 *  - Reminder Scheduler + Quick Daily To-Do List + Neon Confetti
 *  - Focus / Pomodoro Timer + Procedural Ambient Focus Sounds (Rain/Brown/Ocean)
 *  - Virtual Pet Mode (Energy, Electric Snack, Friendship XP Levels)
 *  - Mini Games (Suit Batu-Gunting-Kertas & Coin Flip)
 *  - Real-Time Windows PC Monitor (CPU, RAM & Battery with reactive moods)
 *  - 5 Neon Themes + Normal/Mini Size + Live Mic Vibe + Center/Top-Dock Mode
 */

import {
  getMicMode,
  initAudioUnlock,
  playCelebrationPop,
  playCoinFlipSound,
  playConfirmTick,
  playPowerUpSound,
  playReminderChime,
  setVoicePitch,
  startMicVisualizer,
  stopMicVisualizer,
} from "./audio.js";
import { RobotController } from "./robot.js";
import {
  ReminderManager,
  formatClockTime,
  formatCountdown,
} from "./reminders.js";
import { PomodoroManager } from "./pomodoro.js";
import {
  getCallName,
  getMoodLine,
  getTimeGreeting,
  getWakeLine,
  getWellnessNudge,
  isGirlTheme,
} from "./greetings.js";
import {
  getAmbientState,
  setAmbientVolume,
  startAmbient,
  stopAmbient,
} from "./ambient.js";
import { spawnNeonConfetti } from "./confetti.js";
import { TodoManager } from "./todos.js";
import { PetManager } from "./pet.js";
import { MiniGameManager } from "./games.js";
import { SystemMonitor } from "./system.js";
import { SwarmManager } from "./swarm.js";

const DOCK_STORAGE_KEY = "ai_robot_dock_mode_v1";
const PREFS_STORAGE_KEY = "ai_robot_prefs_v1";
const urlParams = new URLSearchParams(window.location.search);
const buddyInjected = window.__ROBOT_BUDDY__ || null;
const isBuddyWindow = Boolean(buddyInjected) || urlParams.has("buddy");
const buddyThemeOverride = buddyInjected?.theme || urlParams.get("theme");

// Core DOM Elements
const widgetRoot = document.getElementById("widget-root");
const floatWrapperEl = document.getElementById("robot-float-wrapper");
const visorEl = document.getElementById("robot-visor");
const eyesRigEl = document.getElementById("eyes-rig");
const voiceWaveEl = document.getElementById("voice-wave");
const soundRingsEl = document.getElementById("sound-rings");
const confettiLayer = document.getElementById("confetti-layer");

const visorClockEl = document.getElementById("visor-clock");
const visorPomoPill = document.getElementById("visor-pomo-pill");
const visorMicDot = document.getElementById("visor-mic-dot");
const visorProgressFill = document.getElementById("visor-progress-fill");

const speechBubble = document.getElementById("speech-bubble");
const bubbleLabel = document.getElementById("bubble-label");
const bubbleMessage = document.getElementById("bubble-message");
const bubbleQueue = document.getElementById("bubble-queue");
const btnReplayChime = document.getElementById("btn-replay-chime");
const btnComplete = document.getElementById("btn-complete");
const btnSnooze = document.getElementById("btn-snooze");

const greetingBubble = document.getElementById("greeting-bubble");
const greetingText = document.getElementById("greeting-text");

// Quick Action Buttons
const btnOpenAdd = document.getElementById("btn-open-add");
const btnOpenList = document.getElementById("btn-open-list");
const btnOpenFocus = document.getElementById("btn-open-focus");
const btnOpenHub = document.getElementById("btn-open-hub");
const btnVoiceTalk = document.getElementById("btn-voice-talk");
const btnOpenStyle = document.getElementById("btn-open-style");
const btnToggleDock = document.getElementById("btn-toggle-dock");
const iconDockTop = btnToggleDock.querySelector(".icon-dock-top");
const iconDockCenter = btnToggleDock.querySelector(".icon-dock-center");
const countBadge = document.getElementById("reminder-count-badge");

// Panels
const panelAdd = document.getElementById("panel-add");
const panelList = document.getElementById("panel-list");
const panelFocus = document.getElementById("panel-focus");
const panelHub = document.getElementById("panel-hub");
const panelStyle = document.getElementById("panel-style");
const closeButtons = document.querySelectorAll("[data-close-panel]");

// Reminder Form Controls
const reminderForm = document.getElementById("reminder-form");
const tabCountdown = document.getElementById("tab-countdown");
const tabClock = document.getElementById("tab-clock");
const groupCountdown = document.getElementById("group-countdown");
const groupClock = document.getElementById("group-clock");
const inputMinutes = document.getElementById("input-minutes");
const inputClock = document.getElementById("input-clock");
const inputMessage = document.getElementById("input-message");
const chips = document.querySelectorAll("#panel-add .chip");
const reminderListEl = document.getElementById("reminder-list");

// List / To-Do Tabs
const listTabBtns = document.querySelectorAll("[data-list-tab]");
const viewReminders = document.getElementById("view-reminders");
const viewTodos = document.getElementById("view-todos");
const todoForm = document.getElementById("todo-form");
const inputTodo = document.getElementById("input-todo");
const todoListEl = document.getElementById("todo-list");

// Focus / Ambient Controls
const focusTabBtns = document.querySelectorAll("[data-focus-tab]");
const viewPomodoro = document.getElementById("view-pomodoro");
const viewAmbient = document.getElementById("view-ambient");
const pomoPresetBtns = document.querySelectorAll("[data-pomo-preset]");
const pomoTimeEl = document.getElementById("pomo-time");
const pomoStatusEl = document.getElementById("pomo-status");
const btnPomoToggle = document.getElementById("btn-pomo-toggle");
const btnPomoReset = document.getElementById("btn-pomo-reset");
const ambientBtns = document.querySelectorAll("[data-ambient]");
const ambientVolSlider = document.getElementById("ambient-volume");
const btnAmbientOff = document.getElementById("btn-ambient-off");

// Hub (Pet / Game / PC) Controls
const hubTabBtns = document.querySelectorAll("[data-hub-tab]");
const viewPet = document.getElementById("view-pet");
const viewGame = document.getElementById("view-game");
const viewPc = document.getElementById("view-pc");

const petLevelBadge = document.getElementById("pet-level-badge");
const petTitleEl = document.getElementById("pet-title");
const petXpText = document.getElementById("pet-xp-text");
const petXpFill = document.getElementById("pet-xp-fill");
const petEnergyFill = document.getElementById("pet-energy-fill");
const petEnergyVal = document.getElementById("pet-energy-val");
const btnFeedSnack = document.getElementById("btn-feed-snack");

const gameResultEl = document.getElementById("game-result");
const gameScoreEl = document.getElementById("game-score");
const suitBtns = document.querySelectorAll("[data-suit]");
const buddyShowBtns = document.querySelectorAll("[data-buddy-show]");
const btnFlipCoin = document.getElementById("btn-flip-coin");

const pcCpuFill = document.getElementById("pc-cpu-fill");
const pcCpuVal = document.getElementById("pc-cpu-val");
const pcRamFill = document.getElementById("pc-ram-fill");
const pcRamVal = document.getElementById("pc-ram-val");
const pcBatFill = document.getElementById("pc-bat-fill");
const pcBatVal = document.getElementById("pc-bat-val");
const pcFootnote = document.getElementById("pc-footnote");

// Customize Controls
const swatchBtns = document.querySelectorAll("[data-theme-pick]");
const btnSpawnBuddy = document.getElementById("btn-spawn-buddy");
const btnToggleSize = document.getElementById("btn-toggle-size");
const btnToggleMic = document.getElementById("btn-toggle-mic");
const micPillLabel = document.getElementById("mic-pill-label");
const btnToggleClock = document.getElementById("btn-toggle-clock");
const btnToggleGreet = document.getElementById("btn-toggle-greet");
const btnToggleMood = document.getElementById("btn-toggle-mood");
const btnTriggerSad = document.getElementById("btn-trigger-sad");
const btnTriggerSleep = document.getElementById("btn-trigger-sleep");

// State
let activePanel = null; // null | "add" | "list" | "focus" | "hub" | "style"
let inputMode = "countdown";
let dockMode = loadSavedDockMode();
let prefs = loadPrefs();
let greetingTimer = null;
let lastPetXpAt = 0;

initAudioUnlock();

function syncVoicePitchForTheme(theme) {
  if (isGirlTheme(theme)) {
    // Pink (sakura) & Purple (violet) -> cute higher feminine robot voice
    setVoicePitch(theme === "sakura" ? 1.24 : 1.16);
  } else if (isBuddyWindow) {
    const num = Number(buddyInjected?.num || urlParams.get("buddy") || 1);
    setVoicePitch(num % 2 === 1 ? 1.06 : 0.9);
  } else {
    setVoicePitch(1.0);
  }
}

syncVoicePitchForTheme(prefs.theme);

const games = new MiniGameManager();

const robot = new RobotController({
  visorEl,
  floatWrapperEl,
  eyesRigEl,
  voiceWaveEl,
  soundRingsEl,
  onMoodChange: (mood, source) => {
    if (source === "silent") return;
    if (!prefs.autoGreet && source === "auto") return;
    if (source === "manual" || Math.random() < 0.72) {
      showGreeting(getMoodLine(mood, prefs.theme), 3200);
    }
  },
  onWake: () => {
    if (prefs.autoGreet) {
      showGreeting(getWakeLine(prefs.theme), 3400);
    }
  },
  onPet: () => {
    const now = Date.now();
    if (now - lastPetXpAt > 2500) {
      lastPetXpAt = now;
      petManager.addXp(6);
      swarm.notifyUserPet();
    }
  },
});

const swarm = new SwarmManager({
  getTheme: () => prefs.theme,
  isBusy: () =>
    Boolean(reminderManager.getActiveAlert()) ||
    pomodoro.getState().running ||
    robot.sleepState === "sleeping",
  onHoldBusy: (ms) => {
    robot.pauseAutoMood(ms);
  },
  onSpeak: (mood, text, durationMs = 2400) => {
    robot.triggerMood(mood, durationMs, { source: "silent" });
    if (text) showGreeting(text, durationMs + 250);
  },
  onScene: (scene, text, durationMs = 2200, withConfetti = false) => {
    robot.triggerScene(scene, durationMs);
    if (withConfetti) spawnNeonConfetti(confettiLayer, 18);
    if (text) showGreeting(text, durationMs + 250);
  },
  onCheer: (mood, text, durationMs = 2300) => {
    spawnNeonConfetti(confettiLayer, 16);
    robot.triggerMood(mood, durationMs, { source: "silent" });
    if (text) showGreeting(text, durationMs + 300);
  },
  onPeersUpdated: (count) => {
    if (count > 0) {
      btnSpawnBuddy.classList.add("is-active");
    } else {
      btnSpawnBuddy.classList.remove("is-active");
      robot.setPeerLookTarget(null, null);
    }
  },
});

// Mutual 60fps eye contact: smoothly glance toward the nearest buddy robot (fast 120ms)
window.setInterval(() => {
  const nearest = swarm.getNearestPeerInfo();
  if (nearest && nearest.dist < 900) {
    robot.setPeerLookTarget(nearest.dx, nearest.dy);
  } else {
    robot.setPeerLookTarget(null, null);
  }
}, 120);

const petManager = new PetManager({
  onChange: (state) => syncPetUI(state),
  onLevelUp: (state) => {
    spawnNeonConfetti(confettiLayer, 28);
    playCelebrationPop();
    robot.triggerMood("starry", 3400, { source: "silent", muteSound: true });
    showGreeting(`LEVEL UP! Lv.${state.level} — ${state.title}!`, 5200);
    swarm.notifyCelebrate();
  },
  onLowEnergy: (energy) => {
    if (!reminderManager.getActiveAlert()) {
      robot.triggerMood("sad", 3400, { source: "silent" });
      showGreeting(`Energi robot tinggal ${energy}%... kasih snack listrik dong!`, 5000);
    }
  },
});

const todoManager = new TodoManager({
  onChange: () => {
    syncBadge();
    renderTodoList();
  },
});

const reminderManager = new ReminderManager({
  onTrigger: () => {
    hideGreeting();
    playReminderChime();
    syncAlertUI();
  },
  onChange: () => {
    syncBadge();
    syncAlertUI();
    if (activePanel === "list") {
      renderReminderList();
    }
  },
});

const pomodoro = new PomodoroManager({
  onTick: (state) => syncPomodoroUI(state),
  onComplete: (finishedPreset) => {
    playReminderChime();
    robot.setFocusMode(false);
    spawnNeonConfetti(confettiLayer, 26);
    robot.triggerMood("starry", 2800, { source: "silent" });
    if (finishedPreset.kind === "focus") {
      petManager.addXp(30);
    }
    const msg =
      finishedPreset.kind === "focus"
        ? "Sesi fokus selesai! +30 XP, waktunya istirahat 5 menit."
        : "Istirahat selesai! Yuk lanjut fokus lagi.";
    showGreeting(msg, 6500);
    pomodoro.selectPreset(finishedPreset.kind === "focus" ? "break" : "focus");
  },
});

const sysMonitor = new SystemMonitor({
  onUpdate: (stats) => syncPcUI(stats),
  onHighCpu: (cpu) => {
    if (!reminderManager.getActiveAlert()) {
      robot.triggerMood("dizzy", 3200, { source: "silent" });
      showGreeting(`Waduh CPU lagi tinggi (${cpu}%), tutup tab berat yuk!`, 5000);
    }
  },
  onLowBattery: (bat) => {
    if (!reminderManager.getActiveAlert()) {
      const call = getCallName(prefs.theme);
      robot.triggerMood("sad", 3200, { source: "silent" });
      showGreeting(`Baterai laptop tinggal ${bat}%! Colok charger dulu ${call}.`, 5000);
    }
  },
  onPluggedIn: () => {
    if (!reminderManager.getActiveAlert()) {
      robot.triggerMood("excited", 2400, { source: "silent" });
      showGreeting("Yeay charger nyolok! Energi balik ngecas!", 4000);
    }
  },
});

/* ==========================================================================
   Preferences Persistence
   ========================================================================== */
function loadPrefs() {
  const defaults = {
    theme: "cyan",
    size: "normal",
    showClock: true,
    autoGreet: true,
    autoMood: true,
  };
  let loaded = defaults;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) loaded = { ...defaults, ...JSON.parse(raw) };
  } catch {
    loaded = defaults;
  }
  if (buddyThemeOverride) {
    loaded = { ...loaded, theme: buddyThemeOverride };
  }
  return loaded;
}

function savePrefs() {
  if (isBuddyWindow) return; // Buddy windows keep independent theme/size without overwriting main
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore
  }
}

function applyPrefsUI() {
  document.body.dataset.theme = prefs.theme;
  document.body.dataset.size = prefs.size;
  document.body.classList.toggle("show-clock", prefs.showClock);

  swatchBtns.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.themePick === prefs.theme);
  });

  btnToggleSize.textContent = prefs.size === "mini" ? "Mini" : "Normal";
  btnToggleClock.classList.toggle("is-on", prefs.showClock);
  btnToggleGreet.classList.toggle("is-on", prefs.autoGreet);
  btnToggleMood.classList.toggle("is-on", prefs.autoMood);
  robot.setAutoMoodEnabled(prefs.autoMood);
}

/* ==========================================================================
   Clock & Greetings
   ========================================================================== */
function updateVisorClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  visorClockEl.textContent = `${hh}:${mm}`;
}

function showGreeting(text, durationMs = 4600) {
  if (reminderManager.getActiveAlert()) return;
  greetingText.textContent = text;
  greetingBubble.classList.add("is-visible");
  greetingBubble.setAttribute("aria-hidden", "false");

  if (greetingTimer) {
    window.clearTimeout(greetingTimer);
  }
  greetingTimer = window.setTimeout(() => {
    hideGreeting();
  }, durationMs);
}

function hideGreeting() {
  greetingBubble.classList.remove("is-visible");
  greetingBubble.setAttribute("aria-hidden", "true");
  if (greetingTimer) {
    window.clearTimeout(greetingTimer);
    greetingTimer = null;
  }
}

function startClockAndGreetings() {
  updateVisorClock();
  window.setInterval(updateVisorClock, 1000);

  if (prefs.autoGreet) {
    window.setTimeout(() => {
      if (prefs.autoGreet && !reminderManager.getActiveAlert()) {
        showGreeting(getTimeGreeting(prefs.theme), 4500);
        robot.blink();
      }
    }, 1200);
  }

  window.setInterval(() => {
    if (!prefs.autoGreet || reminderManager.getActiveAlert() || pomodoro.getState().running) {
      return;
    }
    showGreeting(getWellnessNudge(prefs.theme), 5000);
  }, 18 * 60 * 1000);
}

/* ==========================================================================
   Pomodoro & Ambient UI Sync
   ========================================================================== */
function syncPomodoroUI(state) {
  pomoTimeEl.textContent = state.formatted;
  visorPomoPill.textContent = state.formatted;
  visorPomoPill.hidden = !state.running && state.remainingMs === state.totalMs;

  if (state.running) {
    pomoStatusEl.textContent =
      state.preset.kind === "focus" ? "Sedang Fokus..." : "Waktu Istirahat";
    btnPomoToggle.textContent = "Jeda";
  } else if (state.remainingMs < state.totalMs && state.remainingMs > 0) {
    pomoStatusEl.textContent = "Dijeda";
    btnPomoToggle.textContent = "Lanjutkan";
  } else {
    pomoStatusEl.textContent =
      state.preset.kind === "focus" ? "Siap Fokus" : "Siap Rehat";
    btnPomoToggle.textContent =
      state.preset.kind === "focus" ? "Mulai Fokus" : "Mulai Rehat";
  }

  pomoPresetBtns.forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.pomoPreset === state.presetKey);
  });

  const showBar = state.running || (state.remainingMs < state.totalMs && state.remainingMs > 0);
  visorEl.classList.toggle("has-progress", showBar);
  visorProgressFill.style.transform = `scaleX(${state.progress.toFixed(4)})`;

  robot.setFocusMode(state.isFocusActive);
  syncFocusButtonState();
}

function syncAmbientUI() {
  const { mode } = getAmbientState();
  ambientBtns.forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.ambient === mode);
  });
  visorEl.classList.toggle("is-raining", mode === "rain");
  syncFocusButtonState();
}

function syncFocusButtonState() {
  const active =
    activePanel === "focus" ||
    pomodoro.getState().running ||
    getAmbientState().mode !== "off";
  btnOpenFocus.classList.toggle("is-active", active);
}

/* ==========================================================================
   Pet, To-Do & PC Monitor UI Sync
   ========================================================================== */
function syncPetUI(state) {
  petLevelBadge.textContent = `Lv. ${state.level}`;
  petTitleEl.textContent = state.title;
  petXpText.textContent = `${state.xp}/${state.xpNeeded} XP`;
  petXpFill.style.width = `${state.xpPercent}%`;
  petEnergyFill.style.width = `${state.energy}%`;
  petEnergyVal.textContent = `${state.energy}%`;
}

function syncPcUI(stats) {
  if (typeof stats.cpuPercent === "number") {
    pcCpuFill.style.width = `${stats.cpuPercent}%`;
    pcCpuVal.textContent = `${stats.cpuPercent}%`;
  } else {
    pcCpuFill.style.width = "0%";
    pcCpuVal.textContent = "N/A";
  }

  if (typeof stats.ramPercent === "number") {
    pcRamFill.style.width = `${stats.ramPercent}%`;
    pcRamVal.textContent = `${stats.ramPercent}%`;
  } else {
    pcRamFill.style.width = "0%";
    pcRamVal.textContent = "N/A";
  }

  if (typeof stats.batteryPercent === "number") {
    pcBatFill.style.width = `${stats.batteryPercent}%`;
    pcBatVal.textContent = `${stats.batteryPercent}%${stats.isCharging ? "⚡" : ""}`;
  } else {
    pcBatFill.style.width = "100%";
    pcBatVal.textContent = "AC";
  }

  if (stats.native) {
    pcFootnote.textContent = `RAM ${stats.ramUsedGb} / ${stats.ramTotalGb} GB • Live Windows`;
  } else {
    pcFootnote.textContent = "CPU & RAM live aktif saat dijalankan lewat Tauri (.exe)";
  }
}

function renderTodoList() {
  const items = todoManager.getAll();
  if (items.length === 0) {
    todoListEl.innerHTML = `<div class="empty-list"><span>Belum ada tugas harian</span></div>`;
    return;
  }

  todoListEl.innerHTML = items
    .map(
      (item) => `
      <div class="todo-item ${item.done ? "is-done" : ""}">
        <button
          type="button"
          class="todo-check"
          data-todo-toggle="${escapeHtml(item.id)}"
          aria-label="Tandai selesai"
        >${item.done ? "✓" : ""}</button>
        <span class="todo-text" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</span>
        <button
          type="button"
          class="btn-delete-item"
          data-todo-delete="${escapeHtml(item.id)}"
          aria-label="Hapus tugas"
        >&times;</button>
      </div>
    `
    )
    .join("");
}

/* ==========================================================================
   Mic Visualizer & Dock Mode
   ========================================================================== */
async function toggleMicVisualizer() {
  const current = getMicMode();
  if (current !== "off") {
    stopMicVisualizer();
    syncMicUI();
    playConfirmTick();
    showGreeting("Mode Mic / Musik dimatikan.", 2600);
    return;
  }

  const res = await startMicVisualizer();
  syncMicUI();
  robot.markActivity(true);

  if (res.mode === "mic") {
    showGreeting("Mic aktif! Robot siap joget ikut musikmu.", 3600);
  } else {
    showGreeting("Mic tak terdeteksi — pakai Demo Beat Vibe!", 3600);
  }
}

function syncMicUI() {
  const mode = getMicMode();
  const active = mode !== "off";
  btnToggleMic.classList.toggle("is-on", active);
  visorMicDot.hidden = !active;
  btnVoiceTalk.classList.toggle("is-active", active);
  micPillLabel.textContent =
    mode === "mic" ? "Mic Live" : mode === "demo" ? "Beat Demo" : "Mic Vibe";
}

function loadSavedDockMode() {
  try {
    const saved = window.localStorage.getItem(DOCK_STORAGE_KEY);
    return saved === "top" ? "top" : "center";
  } catch {
    return "center";
  }
}

async function applyDockMode(mode, { syncNative = true, playSound = false } = {}) {
  dockMode = mode === "top" ? "top" : "center";

  const isTop = dockMode === "top";
  document.body.classList.toggle("mode-top-dock", isTop);
  document.body.classList.toggle("mode-center", !isTop);

  iconDockTop.hidden = isTop;
  iconDockCenter.hidden = !isTop;
  btnToggleDock.classList.toggle("is-active", isTop);
  btnToggleDock.title = isTop ? "Ngambang di Tengah Layar" : "Tempel di Layar Atas";

  try {
    window.localStorage.setItem(DOCK_STORAGE_KEY, dockMode);
  } catch {
    // Ignore
  }

  if (playSound) {
    playConfirmTick();
  }

  if (syncNative && window.__TAURI__?.core?.invoke) {
    try {
      await window.__TAURI__.core.invoke("set_dock_mode", { mode: dockMode });
    } catch {
      // Browser preview
    }
  }
}

if (window.__TAURI__?.event?.listen) {
  window.__TAURI__.event.listen("dock-mode-changed", (event) => {
    const mode = event.payload === "top" ? "top" : "center";
    applyDockMode(mode, { syncNative: false, playSound: true });
  });
}

/* ==========================================================================
   Panel & Sub-Tab Management
   ========================================================================== */
function setDefaultClockValue() {
  const future = new Date(Date.now() + 10 * 60 * 1000);
  const hh = String(future.getHours()).padStart(2, "0");
  const mm = String(future.getMinutes()).padStart(2, "0");
  inputClock.value = `${hh}:${mm}`;
}

function setActivePanel(panel) {
  robot.markActivity(true);
  activePanel = activePanel === panel ? null : panel;

  const map = {
    add: panelAdd,
    list: panelList,
    focus: panelFocus,
    hub: panelHub,
    style: panelStyle,
  };

  for (const [key, el] of Object.entries(map)) {
    const open = activePanel === key;
    el.classList.toggle("is-open", open);
    el.setAttribute("aria-hidden", String(!open));
  }

  btnOpenAdd.classList.toggle("is-active", activePanel === "add");
  btnOpenList.classList.toggle("is-active", activePanel === "list");
  btnOpenHub.classList.toggle("is-active", activePanel === "hub");
  btnOpenStyle.classList.toggle("is-active", activePanel === "style");
  syncFocusButtonState();
  widgetRoot.classList.toggle("has-panel-open", activePanel !== null);

  if (activePanel === "add") {
    if (!inputClock.value) setDefaultClockValue();
    window.setTimeout(() => inputMessage.focus(), 80);
  } else if (activePanel === "list") {
    renderReminderList();
    renderTodoList();
  } else if (activePanel === "hub") {
    syncPetUI(petManager.getState());
    syncPcUI(sysMonitor.getStats());
  }
}

function setInputMode(mode) {
  inputMode = mode;
  const isCountdown = mode === "countdown";

  tabCountdown.classList.toggle("is-active", isCountdown);
  tabCountdown.setAttribute("aria-selected", String(isCountdown));
  tabClock.classList.toggle("is-active", !isCountdown);
  tabClock.setAttribute("aria-selected", String(!isCountdown));

  groupCountdown.hidden = !isCountdown;
  groupClock.hidden = isCountdown;

  if (!isCountdown) {
    setDefaultClockValue();
  }
}

/* ==========================================================================
   Reminder UI Sync Helpers
   ========================================================================== */
function syncBadge() {
  const total = reminderManager.getUpcoming().length + todoManager.getPendingCount();
  if (total > 0) {
    countBadge.textContent = total > 9 ? "9+" : String(total);
    countBadge.hidden = false;
  } else {
    countBadge.hidden = true;
  }
}

function syncAlertUI() {
  const active = reminderManager.getActiveAlert();
  const totalQueued = reminderManager.getQueuedAlertCount();

  if (active) {
    hideGreeting();
    bubbleLabel.textContent = "PENGINGAT";
    bubbleMessage.textContent = active.message;
    if (totalQueued > 1) {
      bubbleQueue.textContent = `+${totalQueued - 1}`;
      bubbleQueue.hidden = false;
    } else {
      bubbleQueue.hidden = true;
    }
    speechBubble.classList.add("is-visible");
    speechBubble.setAttribute("aria-hidden", "false");
    robot.setAlertMode(true);
  } else {
    speechBubble.classList.remove("is-visible");
    speechBubble.setAttribute("aria-hidden", "true");
    robot.setAlertMode(false);
  }
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderReminderList() {
  const items = reminderManager.getUpcoming();
  const now = Date.now();

  if (items.length === 0) {
    reminderListEl.innerHTML = `
      <div class="empty-list">
        <span>Belum ada pengingat aktif</span>
        <button type="button" class="empty-add-link" id="empty-add-btn">+ Buat Pengingat</button>
      </div>
    `;
    const emptyBtn = document.getElementById("empty-add-btn");
    emptyBtn?.addEventListener("click", () => setActivePanel("add"));
    return;
  }

  reminderListEl.innerHTML = items
    .map((item) => {
      const remaining = formatCountdown(item.triggerAt - now);
      const clock = formatClockTime(item.triggerAt);
      return `
        <div class="reminder-item" data-id="${escapeHtml(item.id)}">
          <div class="reminder-item-info">
            <div class="reminder-item-msg" title="${escapeHtml(item.message)}">${escapeHtml(item.message)}</div>
            <div class="reminder-item-meta">
              <span>${clock}</span>
              <span>&bull;</span>
              <span class="reminder-item-countdown">${remaining}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn-delete-item"
            data-delete-id="${escapeHtml(item.id)}"
            title="Hapus pengingat"
            aria-label="Hapus pengingat"
          >&times;</button>
        </div>
      `;
    })
    .join("");
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
btnOpenAdd.addEventListener("click", () => setActivePanel("add"));
btnOpenList.addEventListener("click", () => setActivePanel("list"));
btnOpenFocus.addEventListener("click", () => setActivePanel("focus"));
btnOpenHub.addEventListener("click", () => setActivePanel("hub"));
btnOpenStyle.addEventListener("click", () => setActivePanel("style"));
closeButtons.forEach((btn) =>
  btn.addEventListener("click", () => setActivePanel(null))
);

// Sub-tab switchers
listTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.listTab;
    listTabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
    viewReminders.hidden = tab !== "reminders";
    viewTodos.hidden = tab !== "todos";
    if (tab === "todos") inputTodo.focus();
  });
});

focusTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.focusTab;
    focusTabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
    viewPomodoro.hidden = tab !== "pomodoro";
    viewAmbient.hidden = tab !== "ambient";
  });
});

hubTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.hubTab;
    hubTabBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
    viewPet.hidden = tab !== "pet";
    viewGame.hidden = tab !== "game";
    viewPc.hidden = tab !== "pc";
  });
});

// Voice & Expression Button (When a buddy is online, triggers OLED Mini-Shows, banter & solo moods!)
let voiceClickCount = 0;
btnVoiceTalk.addEventListener("click", () => {
  robot.markActivity(true);
  voiceClickCount += 1;
  if (swarm.getPeerCount() > 0) {
    if (voiceClickCount % 3 === 1) {
      swarm.startBuddyShow();
    } else if (voiceClickCount % 3 === 2) {
      swarm.startBanterWith();
    } else {
      robot.triggerNextMood();
    }
  } else {
    robot.triggerNextMood();
  }
});

btnVoiceTalk.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  toggleMicVisualizer();
});

// Dock Mode Button
btnToggleDock.addEventListener("click", () => {
  const nextMode = dockMode === "top" ? "center" : "top";
  applyDockMode(nextMode, { syncNative: true, playSound: true });
});

// To-Do Events
todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (todoManager.add(inputTodo.value)) {
    inputTodo.value = "";
    playConfirmTick();
  }
});

todoListEl.addEventListener("click", (e) => {
  const toggleBtn = e.target.closest("[data-todo-toggle]");
  if (toggleBtn) {
    const item = todoManager.toggle(toggleBtn.dataset.todoToggle);
    if (item?.done) {
      spawnNeonConfetti(confettiLayer, 20);
      playCelebrationPop();
      robot.triggerMood("starry", 2200, { source: "silent", muteSound: true });
      showGreeting("Mantap! 1 tugas beres (+15 XP)!", 3200);
      petManager.addXp(15);
      swarm.notifyCelebrate();
    } else {
      playConfirmTick();
    }
    return;
  }

  const delBtn = e.target.closest("[data-todo-delete]");
  if (delBtn) {
    todoManager.remove(delBtn.dataset.todoDelete);
  }
});

// Pomodoro & Ambient Events
pomoPresetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    pomodoro.selectPreset(btn.dataset.pomoPreset);
    playConfirmTick();
  });
});

btnPomoToggle.addEventListener("click", () => {
  pomodoro.toggle();
  playConfirmTick();
});

btnPomoReset.addEventListener("click", () => {
  pomodoro.reset();
  playConfirmTick();
});

ambientBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = startAmbient(btn.dataset.ambient);
    syncAmbientUI();
    if (next === "rain") {
      showGreeting("Suara hujan rintik aktif. Enak banget buat fokus!", 3400);
    } else if (next === "brown") {
      showGreeting("Brown Noise aktif! Deep focus mode ON.", 3400);
    } else if (next === "ocean") {
      showGreeting("Ombak santai aktif. Rileks dulu bro...", 3400);
    } else {
      showGreeting("Suara ambient dimatikan.", 2400);
    }
  });
});

ambientVolSlider.addEventListener("input", () => {
  setAmbientVolume(ambientVolSlider.value);
});

btnAmbientOff.addEventListener("click", () => {
  stopAmbient();
  syncAmbientUI();
  playConfirmTick();
});

// Pet & Mini Game Events
btnFeedSnack.addEventListener("click", () => {
  const { leveled, state } = petManager.feedSnack();
  spawnNeonConfetti(confettiLayer, 16);
  playPowerUpSound();
  if (!leveled) {
    robot.triggerMood("love", 2400, { source: "silent", muteSound: true });
    showGreeting(`Nyam-nyam! Energi jadi ${state.energy}% (+12 XP)!`, 3400);
  }
});

suitBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const res = games.playSuit(btn.dataset.suit);
    gameScoreEl.textContent = `${res.userScore} - ${res.robotScore}`;
    petManager.addXp(8);

    if (res.outcome === "win") {
      gameResultEl.textContent = `Menang! (${res.user.emoji} vs ${res.robot.emoji})`;
      spawnNeonConfetti(confettiLayer, 16);
      robot.triggerMood("grumpy", 2400, { source: "silent" });
      showGreeting(`Hmph aku kalah (${res.robot.label})! Lagi dong bro!`, 3400);
    } else if (res.outcome === "lose") {
      gameResultEl.textContent = `Kalah! (${res.user.emoji} vs ${res.robot.emoji})`;
      robot.triggerMood("cool", 2600, { source: "silent" });
      showGreeting(`Hehe aku menang pakai ${res.robot.label}! Keren kan?`, 3400);
    } else {
      gameResultEl.textContent = `Seri! (${res.user.emoji} vs ${res.robot.emoji})`;
      robot.triggerMood("curious", 2200, { source: "silent" });
      showGreeting(`Samaan ${res.robot.label}! Kita sehati nih bro!`, 3200);
    }
  });
});

buddyShowBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const showType = btn.dataset.buddyShow;
    setActivePanel(null);
    swarm.startBuddyShow(showType);
  });
});

btnFlipCoin.addEventListener("click", () => {
  const coin = games.flipCoin();
  gameResultEl.textContent = `Koin: ${coin.emoji} ${coin.side}!`;
  playCoinFlipSound();
  robot.triggerMood("wink", 2200, { source: "silent", muteSound: true });
  showGreeting(`Hasil lempar koin: ${coin.side}!`, 3400);
});

// Customize Events
btnSpawnBuddy.addEventListener("click", async () => {
  playConfirmTick();
  if (window.__TAURI__?.core?.invoke) {
    try {
      await window.__TAURI__.core.invoke("spawn_buddy_window");
      setActivePanel(null);
      return;
    } catch (err) {
      showGreeting(`Gagal tambah buddy: ${err}`, 4000);
      return;
    }
  }
  window.open(`${window.location.pathname}?buddy=1&theme=sakura`, "_blank", "width=380,height=480");
  setActivePanel(null);
});

swatchBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    prefs.theme = btn.dataset.themePick;
    savePrefs();
    applyPrefsUI();
    syncVoicePitchForTheme(prefs.theme);
    playConfirmTick();
    const personaNote = isGirlTheme(prefs.theme)
      ? "Halo bib! Mode warna manis & suara imut aktif!"
      : "Siap bro! Warna & suara baru aktif!";
    showGreeting(personaNote, 2800);
  });
});

btnToggleSize.addEventListener("click", () => {
  prefs.size = prefs.size === "normal" ? "mini" : "normal";
  savePrefs();
  applyPrefsUI();
  playConfirmTick();
});

btnToggleMic.addEventListener("click", () => toggleMicVisualizer());

btnToggleClock.addEventListener("click", () => {
  prefs.showClock = !prefs.showClock;
  savePrefs();
  applyPrefsUI();
  playConfirmTick();
});

btnToggleGreet.addEventListener("click", () => {
  prefs.autoGreet = !prefs.autoGreet;
  savePrefs();
  applyPrefsUI();
  playConfirmTick();
  if (prefs.autoGreet) {
    showGreeting(getTimeGreeting(prefs.theme), 3500);
  } else {
    hideGreeting();
  }
});

btnToggleMood.addEventListener("click", () => {
  prefs.autoMood = !prefs.autoMood;
  savePrefs();
  applyPrefsUI();
  playConfirmTick();
  showGreeting(
    prefs.autoMood
      ? "Auto Mood aktif! Robot bakal tiba-tiba berekspresi."
      : "Auto Mood dimatikan.",
    3000
  );
});

btnTriggerSad.addEventListener("click", () => {
  setActivePanel(null);
  robot.triggerMood("sad", 3800);
});

btnTriggerSleep.addEventListener("click", () => {
  setActivePanel(null);
  robot.enterSleep(true);
});

// Reminder Form Events
tabCountdown.addEventListener("click", () => setInputMode("countdown"));
tabClock.addEventListener("click", () => setInputMode("clock"));

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const mins = chip.dataset.minutes;
    inputMinutes.value = mins;
    chips.forEach((c) => c.classList.toggle("is-selected", c === chip));
  });
});

inputMinutes.addEventListener("input", () => {
  chips.forEach((c) =>
    c.classList.toggle("is-selected", c.dataset.minutes === inputMinutes.value)
  );
});

reminderForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = inputMessage.value.trim();
  if (!msg) return;

  let created = null;
  if (inputMode === "countdown") {
    created = reminderManager.addCountdown(inputMinutes.value, msg);
  } else {
    created = reminderManager.addClockTime(inputClock.value, msg);
  }

  if (created) {
    playConfirmTick();
    inputMessage.value = "";
    setActivePanel(null);
    robot.blink();
  }
});

reminderListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete-id]");
  if (!btn) return;
  reminderManager.remove(btn.dataset.deleteId);
  renderReminderList();
});

btnReplayChime.addEventListener("click", () => playReminderChime());

btnComplete.addEventListener("click", () => {
  reminderManager.completeActive();
  playConfirmTick();
  petManager.addXp(10);
  if (!reminderManager.getActiveAlert()) {
    spawnNeonConfetti(confettiLayer, 16);
    robot.triggerHappy(1600);
  }
});

btnSnooze.addEventListener("click", () => {
  reminderManager.snoozeActive(5);
  playConfirmTick();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activePanel !== null) {
    setActivePanel(null);
  }
});

window.addEventListener("contextmenu", (e) => {
  if (e.target.tagName !== "INPUT") {
    e.preventDefault();
  }
});

// Initialize Everything
setDefaultClockValue();
applyPrefsUI();
syncBadge();
syncAlertUI();
syncPomodoroUI(pomodoro.getState());
syncAmbientUI();
syncPetUI(petManager.getState());
syncPcUI(sysMonitor.getStats());
syncMicUI();
renderTodoList();
applyDockMode(dockMode, { syncNative: !isBuddyWindow, playSound: false });
startClockAndGreetings();
