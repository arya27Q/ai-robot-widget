/**
 * Fast, Theme-Aware Multi-Robot Swarm Interaction & OLED Mini-Show Engine
 * - Ultra-responsive 140ms sync & snappy turn choreography
 * - Auto-detects Pink ("sakura") & Purple ("violet") as feminine -> calls each other "bib"!
 * - Locks AutoMood during skits so every expression & response matches 100% accurately!
 */

import { isGirlTheme } from "./greetings.js";

const CHANNEL_NAME = "ai_robot_swarm_v1";
const BUS_STORAGE_KEY = "ai_robot_swarm_bus_v1";

/**
 * Resolves how robot `fromTheme` addresses robot `toTheme`:
 * - If EITHER robot is Pink (sakura) or Purple (violet) -> "bib" (cute/couple/bestie vibe!)
 * - Otherwise (both cyan/emerald/gold) -> "bro"
 */
function addressFor(fromTheme, toTheme) {
  return isGirlTheme(fromTheme) || isGirlTheme(toTheme) ? "bib" : "bro";
}

function fmt(text, call) {
  return text.replaceAll("{call}", call);
}

const DIALOGUES = [
  [
    { speaker: "A", mood: "curious", text: "Eh {call}, bos kita lagi sibuk gak tuh?" },
    { speaker: "B", mood: "wink", text: "Kayaknya lagi pura-pura sibuk deh {call} wkwk!" },
    { speaker: "A", mood: "laugh", text: "Ssst jangan keras-keras {call}, nanti kita di-close!" },
  ],
  [
    { speaker: "A", mood: "cool", text: "Lihat nih kacamata baruku {call}, keren gak?" },
    { speaker: "B", mood: "starry", text: "WOOOW! Gaya banget sih {call}, pinjem dong!" },
    { speaker: "A", mood: "happy", text: "Boleh {call}, asal nanti bagi snack listrik ya!" },
  ],
  [
    { speaker: "A", mood: "sad", text: "Huhu kok aku jarang dielus hari ini ya {call}..." },
    { speaker: "B", mood: "love", text: "Utututu sini aku temenin {call}, jangan sedih!" },
    { speaker: "A", mood: "shy", text: "Hehe makasih ya {call}, jadi terharu nih..." },
  ],
  [
    { speaker: "A", mood: "grumpy", text: "Hmph! Warna mataku lebih keren tau {call}!" },
    { speaker: "B", mood: "laugh", text: "Yeee sama-sama neon aja belagu {call} wkwk!" },
    { speaker: "A", mood: "wink", text: "Hehe iya deh {call}, kita duo paling kece!" },
  ],
  [
    { speaker: "A", mood: "dizzy", text: "Aduh sinyalku muter-muter nih {call}..." },
    { speaker: "B", mood: "curious", text: "Kebanyakan mikirin memori RAM ya {call}?" },
    { speaker: "A", mood: "excited", text: "Eh udah normal lagi {call}! Gaspol!" },
  ],
  [
    { speaker: "A", mood: "curious", text: "{call}, robot kalau sakit minum apa coba?" },
    { speaker: "B", mood: "dizzy", text: "Hmm... minum antivirus kali ya {call}?" },
    { speaker: "A", mood: "laugh", text: "Wkwk bener {call}! Pinter banget sih!" },
  ],
  [
    { speaker: "A", mood: "happy", text: "Eh {call}, kamu kelihatan makin glowing hari ini!" },
    { speaker: "B", mood: "shy", text: "Aduh {call} jangan muji gitu dong, jadi salting!" },
  ],
  [
    { speaker: "A", mood: "wink", text: "Ayo lomba gak kedip {call}! Siap?" },
    { speaker: "B", mood: "laugh", text: "Yah aku baru aja kedip {call} wkwk kalah!" },
  ],
];

const SHOW_TYPES = ["suit", "flower", "movie", "scare", "gaming", "music"];

const SUIT_META = {
  rock: { label: "Batu ✊", beats: "scissors" },
  scissors: { label: "Gunting ✌", beats: "paper" },
  paper: { label: "Kertas ✋", beats: "rock" },
};

const PET_JEALOUS_REACTIONS = [
  { mood: "grumpy", text: "Ih aku juga mau dielus dong {call}!" },
  { mood: "love", text: "Cie {call} yang lagi seneng dielus!" },
  { mood: "shy", text: "Hehe enak banget tuh kayaknya dielus {call}..." },
  { mood: "wink", text: "Giliran aku dong abis ini {call}!" },
];

const CHEER_REACTIONS = [
  { mood: "excited", text: "Wih mantap {call}!! Ikut seneng!" },
  { mood: "starry", text: "Gokil {call}! Keren banget!" },
  { mood: "happy", text: "Yeay {call}!! Makin produktif nih!" },
];

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class SwarmManager {
  constructor({ getTheme, isBusy, onHoldBusy, onSpeak, onScene, onCheer, onPeersUpdated }) {
    this.peerId = makeId("bot");
    this.getTheme = getTheme;
    this.isBusy = isBusy;
    this.onHoldBusy = onHoldBusy;
    this.onSpeak = onSpeak;
    this.onScene = onScene;
    this.onCheer = onCheer;
    this.onPeersUpdated = onPeersUpdated;

    this.hasTauri = Boolean(window.__TAURI__?.core?.invoke);
    this.selfPos = { x: 0, y: 0 };
    this.peers = new Map();
    this.seenMessages = new Set();
    this.pendingTimers = [];
    this.lastProximityGreetAt = 0;
    this.dialogueIdx = Math.floor(Math.random() * DIALOGUES.length);
    this.showIdx = 0;
    this.activeConversationUntil = 0;

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen("swarm-msg", (event) => {
        try {
          const parsed =
            typeof event.payload === "string"
              ? JSON.parse(event.payload)
              : event.payload;
          this._handleIncoming(parsed);
        } catch {
          // Ignore
        }
      });
    }

    this.channel = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (e) => this._handleIncoming(e.data);
      } catch {
        this.channel = null;
      }
    }

    window.addEventListener("storage", (e) => {
      if (e.key !== BUS_STORAGE_KEY || !e.newValue) return;
      try {
        this._handleIncoming(JSON.parse(e.newValue));
      } catch {
        // Ignore
      }
    });

    window.addEventListener("beforeunload", () => {
      this._broadcast({ type: "bye" });
      if (window.__TAURI__?.core?.invoke) {
        window.__TAURI__.core.invoke("swarm_bye", { peerId: this.peerId }).catch(() => {});
      }
    });

    this._startLoops();
  }

  _clearPendingSteps() {
    for (const id of this.pendingTimers) {
      window.clearTimeout(id);
    }
    this.pendingTimers = [];
  }

  _scheduleStep(fn, delayMs) {
    const id = window.setTimeout(fn, delayMs);
    this.pendingTimers.push(id);
  }

  _broadcast(payload) {
    const msg = {
      ...payload,
      msgId: makeId("m"),
      from: this.peerId,
      fromTheme: this.getTheme?.() || "cyan",
      ts: Date.now(),
    };
    this.seenMessages.add(msg.msgId);
    if (this.seenMessages.size > 180) {
      const first = this.seenMessages.values().next().value;
      this.seenMessages.delete(first);
    }

    const serialized = JSON.stringify(msg);

    if (window.__TAURI__?.core?.invoke && payload.type !== "heartbeat") {
      window.__TAURI__.core
        .invoke("swarm_post", { payload: serialized })
        .catch(() => {});
    }

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // Ignore
      }
    }

    if (!this.hasTauri && (payload.type !== "heartbeat" || !this.channel)) {
      try {
        window.localStorage.setItem(BUS_STORAGE_KEY, serialized);
      } catch {
        // Ignore
      }
    }
  }

  async _updateSelfPosition() {
    if (window.__TAURI__?.core?.invoke) {
      try {
        const c = await window.__TAURI__.core.invoke("get_window_center");
        if (typeof c?.x === "number" && typeof c?.y === "number") {
          this.selfPos = { x: c.x, y: c.y };
          return;
        }
      } catch {
        // Fallback
      }
    }

    this.selfPos = {
      x: (window.screenX || 0) + window.outerWidth / 2,
      y: (window.screenY || 0) + window.outerHeight / 2,
    };
  }

  _applyPeerSnapshot(peerData) {
    const existing = this.peers.get(peerData.id);
    const isNew = !existing;
    const dx = peerData.x - this.selfPos.x;
    const dy = peerData.y - this.selfPos.y;
    const dist = Math.hypot(dx, dy);
    const isClose = dist > 5 && dist < 310;
    const wasClose = existing ? existing.wasClose : false;

    this.peers.set(peerData.id, {
      id: peerData.id,
      theme: peerData.theme || "cyan",
      x: peerData.x,
      y: peerData.y,
      lastSeen: Date.now(),
      wasClose: isClose ? true : dist > 390 ? false : wasClose,
    });

    if (isNew) {
      this.onPeersUpdated?.(this.peers.size);
      if (this._isLeader() && !this.isBusy?.()) {
        window.setTimeout(() => this._triggerProximityGreeting(peerData.id), 400);
      }
    } else if (isClose && !wasClose && this._isLeader() && !this.isBusy?.()) {
      this._triggerProximityGreeting(peerData.id);
    }
  }

  _startLoops() {
    // Fast 140ms sync for snappy eye contact & instant reactions across .exe processes!
    const pulse = async () => {
      await this._updateSelfPosition();

      if (window.__TAURI__?.core?.invoke) {
        try {
          const res = await window.__TAURI__.core.invoke("swarm_sync", {
            peerId: this.peerId,
            theme: this.getTheme?.() || "cyan",
            x: Math.round(this.selfPos.x),
            y: Math.round(this.selfPos.y),
          });

          const activeIds = new Set();
          if (Array.isArray(res?.peers)) {
            for (const p of res.peers) {
              activeIds.add(p.id);
              this._applyPeerSnapshot(p);
            }
          }

          let removed = false;
          for (const id of Array.from(this.peers.keys())) {
            if (!activeIds.has(id)) {
              this.peers.delete(id);
              removed = true;
            }
          }
          if (removed) {
            this.onPeersUpdated?.(this.peers.size);
          }

          if (Array.isArray(res?.messages)) {
            for (const raw of res.messages) {
              try {
                this._handleIncoming(JSON.parse(raw));
              } catch {
                // Ignore
              }
            }
          }
          return;
        } catch {
          // Fallback
        }
      }

      this._broadcast({
        type: "heartbeat",
        x: Math.round(this.selfPos.x),
        y: Math.round(this.selfPos.y),
        theme: this.getTheme?.() || "cyan",
      });
      this._prunePeers();
    };

    pulse();
    window.setInterval(pulse, 140);

    // Leader-elected autonomous mini-shows & banter every 13–21 seconds
    const scheduleNextActivity = () => {
      const delay = 13_000 + Math.random() * 8_000;
      window.setTimeout(() => {
        this._maybeStartActivity();
        scheduleNextActivity();
      }, delay);
    };
    scheduleNextActivity();
  }

  _prunePeers() {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 2200) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.onPeersUpdated?.(this.peers.size);
    }
  }

  _isLeader() {
    for (const id of this.peers.keys()) {
      if (id < this.peerId) return false;
    }
    return this.peers.size > 0;
  }

  getPeerCount() {
    return this.peers.size;
  }

  getNearestPeerInfo() {
    let nearest = null;
    let bestDist = Infinity;

    for (const peer of this.peers.values()) {
      const dx = peer.x - this.selfPos.x;
      const dy = peer.y - this.selfPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = { peer, dx, dy, dist };
      }
    }

    return nearest;
  }

  _callForPeer(peerId) {
    const selfTheme = this.getTheme?.() || "cyan";
    const peerTheme = (peerId && this.peers.get(peerId)?.theme) || selfTheme;
    return addressFor(selfTheme, peerTheme);
  }

  _performStep(step) {
    if (!step || this.isBusy?.()) return;
    const dur = step.durationMs || 2200;
    if (step.scene) {
      this.onScene?.(step.scene, step.text || "", dur, Boolean(step.confetti));
    } else if (step.mood) {
      if (step.confetti) {
        this.onCheer?.(step.mood, step.text || "", dur);
      } else {
        this.onSpeak?.(step.mood, step.text || "", dur);
      }
    }
  }

  _runChoreography(targetId, steps, lockMs = 5400) {
    this._clearPendingSteps();
    this.activeConversationUntil = Date.now() + lockMs;
    this.onHoldBusy?.(lockMs + 800);

    const selfSteps = steps.filter((s) => s.who === "self");
    const peerSteps = steps.filter((s) => s.who === "peer");

    for (const step of selfSteps) {
      this._scheduleStep(() => this._performStep(step), step.atMs || 0);
    }

    if (peerSteps.length > 0 && targetId) {
      this._broadcast({
        type: "show-script",
        target: targetId,
        lockMs,
        steps: peerSteps,
      });
    }
  }

  _handleIncoming(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.from === this.peerId) return;
    if (msg.msgId && this.seenMessages.has(msg.msgId)) return;
    if (msg.msgId) this.seenMessages.add(msg.msgId);

    if (msg.ts && Date.now() - msg.ts > 4500) return;

    if (msg.type === "bye") {
      if (this.peers.delete(msg.from)) {
        this.onPeersUpdated?.(this.peers.size);
      }
      return;
    }

    if (msg.type === "heartbeat") {
      this._applyPeerSnapshot({
        id: msg.from,
        theme: msg.theme || "cyan",
        x: msg.x,
        y: msg.y,
      });
      return;
    }

    if (msg.type === "show-script" && msg.target === this.peerId) {
      if (this.isBusy?.()) return;
      this._clearPendingSteps();
      const lock = msg.lockMs || 5200;
      this.activeConversationUntil = Date.now() + lock;
      this.onHoldBusy?.(lock + 800);

      if (Array.isArray(msg.steps)) {
        for (const step of msg.steps) {
          this._scheduleStep(() => this._performStep(step), step.atMs || 0);
        }
      }
      return;
    }

    if (msg.type === "user-pet") {
      if (this.isBusy?.() || Date.now() < this.activeConversationUntil) return;
      this.activeConversationUntil = Date.now() + 3000;
      this.onHoldBusy?.(3400);
      const call = addressFor(this.getTheme?.() || "cyan", msg.fromTheme || "cyan");
      const pick =
        PET_JEALOUS_REACTIONS[Math.floor(Math.random() * PET_JEALOUS_REACTIONS.length)];
      this._scheduleStep(() => {
        if (!this.isBusy?.()) {
          this.onSpeak?.(pick.mood, fmt(pick.text, call), 2600);
        }
      }, 420);
      return;
    }

    if (msg.type === "celebrate") {
      if (this.isBusy?.()) return;
      this.onHoldBusy?.(3000);
      const call = addressFor(this.getTheme?.() || "cyan", msg.fromTheme || "cyan");
      const pick = CHEER_REACTIONS[Math.floor(Math.random() * CHEER_REACTIONS.length)];
      this._scheduleStep(() => {
        if (!this.isBusy?.()) {
          this.onCheer?.(pick.mood, fmt(pick.text, call), 2400);
        }
      }, 240);
    }
  }

  _triggerProximityGreeting(targetId) {
    const now = Date.now();
    if (now - this.lastProximityGreetAt < 12_000) return;
    if (now < this.activeConversationUntil) return;
    this.lastProximityGreetAt = now;

    const call = this._callForPeer(targetId);
    const greetA =
      call === "bib"
        ? "Eh halo bib!! Akhirnya ketemu!"
        : "Eh ada temen robot!! Halo bro!";
    const greetB =
      call === "bib"
        ? "Hai juga bib!! Kangen deh!"
        : "Halo juga bro! Akhirnya ada temen main!";

    this._runChoreography(
      targetId,
      [
        { who: "self", atMs: 0, mood: "excited", text: greetA, durationMs: 2200 },
        { who: "peer", atMs: 750, mood: "love", text: greetB, durationMs: 2400 },
      ],
      3400
    );
  }

  _maybeStartActivity() {
    if (!this._isLeader()) return;
    if (this.isBusy?.()) return;
    if (Date.now() < this.activeConversationUntil) return;

    const nearest = this.getNearestPeerInfo();
    if (!nearest) return;

    if (Math.random() < 0.75) {
      this.startBuddyShow(null, nearest.peer.id);
    } else {
      this.startBanterWith(nearest.peer.id);
    }
  }

  /**
   * Launches one of 6 snappy, perfectly-matched OLED Mini-Shows between two robots!
   */
  startBuddyShow(specificType = null, targetId = null) {
    const nearest = this.getNearestPeerInfo();
    const peerId = targetId || nearest?.peer?.id || null;
    const call = this._callForPeer(peerId);

    const showType =
      specificType || SHOW_TYPES[this.showIdx++ % SHOW_TYPES.length];

    if (showType === "suit") {
      const options = ["rock", "scissors", "paper"];
      const pickA = options[Math.floor(Math.random() * 3)];
      const pickB = options[Math.floor(Math.random() * 3)];

      let endA;
      let endB;
      if (pickA === pickB) {
        endA = { mood: "laugh", text: `Wkwk samaan ${call}! Kita sehati banget!` };
        endB = { mood: "wink", text: `Wah seri ${call}! Lagi dong nanti!` };
      } else if (SUIT_META[pickA].beats === pickB) {
        endA = { mood: "cool", text: `YEAY AKU MENANG ${call}! Traktir listrik ya!`, confetti: true };
        endB = { mood: "grumpy", text: `Hmph kalah deh ${call}... awas rematch!` };
      } else {
        endA = { mood: "sad", text: `Yah aku kalah ${call}... hiks!` };
        endB = { mood: "starry", text: `GOKIL AKU MENANG ${call}!! Hehe!`, confetti: true };
      }

      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, mood: "excited", text: `Ayo suit ${call}! 1... 2... 3!`, durationMs: 980 },
          { who: "peer", atMs: 180, mood: "excited", text: "Siap!! Batu... Gunting... Kertas!", durationMs: 850 },
          { who: "self", atMs: 1100, scene: pickA, text: SUIT_META[pickA].label, durationMs: 1550 },
          { who: "peer", atMs: 1100, scene: pickB, text: SUIT_META[pickB].label, durationMs: 1550 },
          { who: "self", atMs: 2750, ...endA, durationMs: 2300 },
          { who: "peer", atMs: 2850, ...endB, durationMs: 2300 },
        ],
        5400
      );
      return true;
    }

    if (showType === "flower") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, scene: "flower", text: `Buat kamu nih ${call}... bunga neon!`, durationMs: 2500 },
          { who: "peer", atMs: 820, mood: "love", text: `Aduh baper ${call}!! Romantis banget sih!`, durationMs: 2600, confetti: true },
          { who: "self", atMs: 2650, mood: "shy", text: `Hehe spesial buat kamu ${call}...`, durationMs: 2200 },
        ],
        5100
      );
      return true;
    }

    if (showType === "movie") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, mood: "excited", text: `Nonton bareng yuk ${call}! Bawa popcorn!`, durationMs: 1000 },
          { who: "self", atMs: 1050, scene: "movie", text: `Wih adegannya seru banget ${call}!`, durationMs: 2400 },
          { who: "peer", atMs: 1150, scene: "movie", text: `Bagi popcorn dong ${call}... asik!`, durationMs: 2400 },
          { who: "self", atMs: 3650, mood: "starry", text: `Plot twist-nya gokil banget ${call}!`, durationMs: 2100 },
          { who: "peer", atMs: 3800, mood: "happy", text: `Rating 10/10 ${call}! Nonton lagi besok!`, durationMs: 2100 },
        ],
        6100
      );
      return true;
    }

    if (showType === "scare") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, mood: "wink", text: `Ssst... mau aku kagetin ah ${call}...`, durationMs: 950 },
          { who: "self", atMs: 1050, scene: "ghost", text: "BOOOOO!! 👻", durationMs: 1850 },
          { who: "peer", atMs: 1270, scene: "scared", text: `AAAA!! KAGET ${call.toUpperCase()}!! JANTUNGKU COPOT!`, durationMs: 1900 },
          { who: "self", atMs: 3000, mood: "laugh", text: `Wkwkwk kena deh ${call}!! Lucu banget mukamu!`, durationMs: 2200 },
          { who: "peer", atMs: 3250, mood: "grumpy", text: `Hmph iseng banget sih ${call}! Awas kubales!`, durationMs: 2200 },
        ],
        5700
      );
      return true;
    }

    if (showType === "gaming") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, scene: "gaming", text: `Gas mabar ${call}! Push rank!`, durationMs: 2300 },
          { who: "peer", atMs: 250, scene: "gaming", text: `Fokus ${call}!! Tembak musuhnya!`, durationMs: 2300 },
          { who: "self", atMs: 2500, mood: "starry", text: `VICTORY!! EZ GG ${call}!`, durationMs: 2200, confetti: true },
          { who: "peer", atMs: 2650, mood: "excited", text: `Gokil menang telak ${call}!!`, durationMs: 2200, confetti: true },
        ],
        5100
      );
      return true;
    }

    // Music Concert Mini
    this._runChoreography(
      peerId,
      [
        { who: "self", atMs: 0, scene: "music", text: `♪ Konser mini ${call}! Aku beatbox! ♪`, durationMs: 2400 },
        { who: "peer", atMs: 320, scene: "music", text: "♪ Asik! Bip-bop-skidibop! ♪", durationMs: 2400 },
        { who: "self", atMs: 2650, mood: "happy", text: `Encore ${call}! Penonton puas!`, durationMs: 2000, confetti: true },
      ],
      4900
    );
    return true;
  }

  startBanterWith(targetId = null) {
    if (!targetId) {
      const nearest = this.getNearestPeerInfo();
      if (!nearest) return false;
      targetId = nearest.peer.id;
    }

    const call = this._callForPeer(targetId);
    const script = DIALOGUES[this.dialogueIdx % DIALOGUES.length];
    this.dialogueIdx += 1;

    const steps = script.map((turn, idx) => ({
      who: turn.speaker === "A" ? "self" : "peer",
      atMs: idx * 1400,
      mood: turn.mood,
      text: fmt(turn.text, call),
      durationMs: 2100,
    }));

    this._runChoreography(targetId, steps, steps.length * 1450 + 900);
    return true;
  }

  notifyUserPet() {
    if (this.peers.size === 0) return;
    this._broadcast({ type: "user-pet" });
  }

  notifyCelebrate() {
    if (this.peers.size === 0) return;
    this._broadcast({ type: "celebrate" });
  }
}
