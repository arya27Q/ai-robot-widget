/**
 * Multi-Robot Swarm Interaction & OLED Mini-Show Engine
 * Choreographs live 2-robot visual shows & dialogues across separate .exe processes
 * AND +Buddy Tauri windows:
 *  - Auto Suit (Gunting-Batu-Kertas): visors transform into glowing Rock/Scissors/Paper!
 *  - Kasih Bunga Baper: Robot A displays blooming neon flower -> Robot B melts with Hearts!
 *  - Nonton Bareng: Both robots wear glowing 3D cinema glasses + react to the movie!
 *  - Nakutin Temen (BOO!): Robot A turns into a spooky neon Ghost -> Robot B trembles Scared!
 *  - Mabar Game: Both robots show retro arcade gamepads & celebrate victory!
 *  - Konser Mini: Both robots jam with glowing music notes!
 *  - Plus 12 witty Indonesian banter dialogues, mutual eye contact & jealousy reactions!
 */

const CHANNEL_NAME = "ai_robot_swarm_v1";
const BUS_STORAGE_KEY = "ai_robot_swarm_bus_v1";

const DIALOGUES = [
  [
    { speaker: "A", mood: "curious", text: "Eh bro, bos kita lagi sibuk gak tuh?" },
    { speaker: "B", mood: "wink", text: "Kayaknya lagi pura-pura sibuk deh wkwk!" },
    { speaker: "A", mood: "laugh", text: "Ssst jangan keras-keras, nanti kita di-close!" },
  ],
  [
    { speaker: "A", mood: "cool", text: "Lihat nih kacamata baruku, keren gak?" },
    { speaker: "B", mood: "starry", text: "WOOOW! Gaya banget bro, pinjem dong!" },
    { speaker: "A", mood: "happy", text: "Boleh, asal nanti bagi snack listrik ya!" },
  ],
  [
    { speaker: "A", mood: "sad", text: "Huhu kok aku jarang dielus hari ini ya..." },
    { speaker: "B", mood: "love", text: "Utututu sini aku temenin, jangan sedih bro!" },
    { speaker: "A", mood: "shy", text: "Hehe makasih ya, jadi terharu nih..." },
  ],
  [
    { speaker: "A", mood: "grumpy", text: "Hmph! Warna mataku lebih keren dari punyamu!" },
    { speaker: "B", mood: "laugh", text: "Yeee sama-sama neon aja belagu wkwk!" },
    { speaker: "A", mood: "wink", text: "Hehe iya deh, kita duo paling kece!" },
  ],
  [
    { speaker: "A", mood: "dizzy", text: "Aduh sinyalku muter-muter nih bro..." },
    { speaker: "B", mood: "curious", text: "Kebanyakan mikirin memori RAM ya?" },
    { speaker: "A", mood: "excited", text: "Eh udah normal lagi! Gaspol!" },
  ],
  [
    { speaker: "A", mood: "curious", text: "Bro, robot kalau sakit minum apa?" },
    { speaker: "B", mood: "dizzy", text: "Hmm... minum antivirus kali ya?" },
    { speaker: "A", mood: "laugh", text: "Wkwk bener! Pinter banget sih!" },
  ],
  [
    { speaker: "A", mood: "happy", text: "Eh bos kita udah minum air belum ya?" },
    { speaker: "B", mood: "wink", text: "Ayo kode bareng: MINUM AIR BRO!" },
  ],
  [
    { speaker: "A", mood: "curious", text: "Kamu tim Dark Mode atau Light Mode bro?" },
    { speaker: "B", mood: "cool", text: "Jelas Dark Mode dong, visor kita aja gelap!" },
  ],
];

const SHOW_TYPES = ["suit", "flower", "movie", "scare", "gaming", "music"];

const SUIT_META = {
  rock: { label: "Batu ✊", beats: "scissors" },
  scissors: { label: "Gunting ✌", beats: "paper" },
  paper: { label: "Kertas ✋", beats: "rock" },
};

const PET_JEALOUS_REACTIONS = [
  { mood: "grumpy", text: "Ih aku juga mau dielus dong!" },
  { mood: "love", text: "Cie yang lagi seneng dielus!" },
  { mood: "shy", text: "Hehe enak banget tuh kayaknya dielus..." },
  { mood: "wink", text: "Giliran aku dong abis ini bro!" },
];

const CHEER_REACTIONS = [
  { mood: "excited", text: "Wih mantap bro!! Ikut seneng!" },
  { mood: "starry", text: "Gokil! Keren banget kalian!" },
  { mood: "happy", text: "Yeay!! Makin produktif nih!" },
];

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class SwarmManager {
  constructor({ getTheme, isBusy, onSpeak, onScene, onCheer, onPeersUpdated }) {
    this.peerId = makeId("bot");
    this.getTheme = getTheme;
    this.isBusy = isBusy;
    this.onSpeak = onSpeak;
    this.onScene = onScene;
    this.onCheer = onCheer;
    this.onPeersUpdated = onPeersUpdated;

    this.hasTauri = Boolean(window.__TAURI__?.core?.invoke);
    this.selfPos = { x: 0, y: 0 };
    this.peers = new Map();
    this.seenMessages = new Set();
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

  _broadcast(payload) {
    const msg = {
      ...payload,
      msgId: makeId("m"),
      from: this.peerId,
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
        window.setTimeout(() => this._triggerProximityGreeting(peerData.id), 750);
      }
    } else if (isClose && !wasClose && this._isLeader() && !this.isBusy?.()) {
      this._triggerProximityGreeting(peerData.id);
    }
  }

  _startLoops() {
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
    window.setInterval(pulse, 320);

    // Leader-elected autonomous mini-shows & banter every 15–25 seconds!
    const scheduleNextActivity = () => {
      const delay = 15_000 + Math.random() * 10_000;
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
      if (now - peer.lastSeen > 2600) {
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

  /**
   * Executes a single choreographed action on THIS robot (either mood OR OLED visor scene).
   */
  _performStep(step) {
    if (!step || this.isBusy?.()) return;
    const dur = step.durationMs || 2800;
    if (step.scene) {
      this.onScene?.(step.scene, step.text || "", dur, Boolean(step.confetti));
    } else if (step.mood) {
      if (step.confetti) {
        this.onCheer?.(step.mood, step.text || "");
      } else {
        this.onSpeak?.(step.mood, step.text || "", dur);
      }
    }
  }

  /**
   * Runs a local + remote timed choreography array:
   * Each entry: { atMs, who: "self" | "peer", scene?, mood?, text?, durationMs?, confetti? }
   */
  _runChoreography(targetId, steps, lockMs = 6800) {
    this.activeConversationUntil = Date.now() + lockMs;

    const selfSteps = steps.filter((s) => s.who === "self");
    const peerSteps = steps.filter((s) => s.who === "peer");

    for (const step of selfSteps) {
      window.setTimeout(() => {
        this._performStep(step);
      }, step.atMs || 0);
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

    if (msg.ts && Date.now() - msg.ts > 5500) return;

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

    // Receive choreographed mini-show timeline for THIS robot!
    if (msg.type === "show-script" && msg.target === this.peerId) {
      if (this.isBusy?.()) return;
      this.activeConversationUntil = Date.now() + (msg.lockMs || 6500);
      if (Array.isArray(msg.steps)) {
        for (const step of msg.steps) {
          window.setTimeout(() => {
            this._performStep(step);
          }, step.atMs || 0);
        }
      }
      return;
    }

    if (msg.type === "user-pet") {
      if (this.isBusy?.() || Date.now() < this.activeConversationUntil) return;
      this.activeConversationUntil = Date.now() + 4000;
      const pick =
        PET_JEALOUS_REACTIONS[Math.floor(Math.random() * PET_JEALOUS_REACTIONS.length)];
      window.setTimeout(() => {
        if (!this.isBusy?.()) {
          this.onSpeak?.(pick.mood, pick.text, 3400);
        }
      }, 900);
      return;
    }

    if (msg.type === "celebrate") {
      if (this.isBusy?.()) return;
      const pick = CHEER_REACTIONS[Math.floor(Math.random() * CHEER_REACTIONS.length)];
      window.setTimeout(() => {
        if (!this.isBusy?.()) {
          this.onCheer?.(pick.mood, pick.text);
        }
      }, 450);
    }
  }

  _triggerProximityGreeting(targetId) {
    const now = Date.now();
    if (now - this.lastProximityGreetAt < 15_000) return;
    if (now < this.activeConversationUntil) return;
    this.lastProximityGreetAt = now;

    this._runChoreography(
      targetId,
      [
        { who: "self", atMs: 0, mood: "excited", text: "Eh ada temen robot!! Halo bro!", durationMs: 2800 },
        { who: "peer", atMs: 1400, mood: "love", text: "Halo juga! Akhirnya ada temen main!", durationMs: 3000 },
      ],
      4800
    );
  }

  _maybeStartActivity() {
    if (!this._isLeader()) return;
    if (this.isBusy?.()) return;
    if (Date.now() < this.activeConversationUntil) return;

    const nearest = this.getNearestPeerInfo();
    if (!nearest) return;

    // 70% chance for a full OLED Visual Mini-Show, 30% witty banter!
    if (Math.random() < 0.72) {
      this.startBuddyShow(null, nearest.peer.id);
    } else {
      this.startBanterWith(nearest.peer.id);
    }
  }

  /**
   * Launches one of 6 interactive OLED Mini-Shows between two robots!
   * Also works solo as a preview if no buddy is currently open!
   */
  startBuddyShow(specificType = null, targetId = null) {
    const nearest = this.getNearestPeerInfo();
    const peerId = targetId || nearest?.peer?.id || null;

    const showType =
      specificType || SHOW_TYPES[this.showIdx++ % SHOW_TYPES.length];

    if (showType === "suit") {
      const options = ["rock", "scissors", "paper"];
      const pickA = options[Math.floor(Math.random() * 3)];
      const pickB = options[Math.floor(Math.random() * 3)];

      let endA;
      let endB;
      if (pickA === pickB) {
        endA = { mood: "laugh", text: "Wkwk samaan! Kita sehati banget!" };
        endB = { mood: "wink", text: "Wah seri bro! Lagi dong nanti!" };
      } else if (SUIT_META[pickA].beats === pickB) {
        endA = { mood: "cool", text: "YEAY AKU MENANG! Traktir listrik ya!", confetti: true };
        endB = { mood: "grumpy", text: "Hmph kalah deh... awas rematch!" };
      } else {
        endA = { mood: "sad", text: "Yah aku kalah... hiks!" };
        endB = { mood: "starry", text: "GOKIL AKU MENANG!! Hehe!", confetti: true };
      }

      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, mood: "excited", text: "Ayo suit bro! 1... 2... 3...", durationMs: 1400 },
          { who: "peer", atMs: 350, mood: "excited", text: "Siap!! Batu... Gunting... Kertas!", durationMs: 1200 },
          { who: "self", atMs: 1650, scene: pickA, text: SUIT_META[pickA].label, durationMs: 2200 },
          { who: "peer", atMs: 1650, scene: pickB, text: SUIT_META[pickB].label, durationMs: 2200 },
          { who: "self", atMs: 4050, ...endA, durationMs: 2800 },
          { who: "peer", atMs: 4250, ...endB, durationMs: 2800 },
        ],
        7400
      );
      return true;
    }

    if (showType === "flower") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, scene: "flower", text: "Buat kamu nih... bunga neon!", durationMs: 3200 },
          { who: "peer", atMs: 1500, mood: "love", text: "Aduh baper!! Romantis banget sih!", durationMs: 3200, confetti: true },
          { who: "self", atMs: 3500, mood: "shy", text: "Hehe jangan bilang siapa-siapa ya...", durationMs: 2600 },
        ],
        6600
      );
      return true;
    }

    if (showType === "movie") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, mood: "excited", text: "Nonton film bareng yuk! Bawa popcorn!", durationMs: 1400 },
          { who: "self", atMs: 1500, scene: "movie", text: "Wih adegannya keren banget bro!", durationMs: 3000 },
          { who: "peer", atMs: 1600, scene: "movie", text: "Bagi popcorn dong... seru banget!", durationMs: 3000 },
          { who: "self", atMs: 4700, mood: "starry", text: "Plot twist-nya gokil banget!", durationMs: 2400 },
          { who: "peer", atMs: 4900, mood: "happy", text: "Rating 10/10! Nonton lagi besok!", durationMs: 2400 },
        ],
        7600
      );
      return true;
    }

    if (showType === "scare") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, mood: "wink", text: "Ssst... mau aku kagetin nih...", durationMs: 1400 },
          { who: "self", atMs: 1550, scene: "ghost", text: "BOOOOO!! 👻", durationMs: 2200 },
          { who: "peer", atMs: 1900, scene: "scared", text: "AAAA!! KAGET BRO!! JANTUNGKU COPOT!", durationMs: 2400 },
          { who: "self", atMs: 4000, mood: "laugh", text: "Wkwkwk kena deh!! Lucu banget mukamu!", durationMs: 2600 },
          { who: "peer", atMs: 4500, mood: "grumpy", text: "Hmph iseng banget! Awas kubales!", durationMs: 2600 },
        ],
        7500
      );
      return true;
    }

    if (showType === "gaming") {
      this._runChoreography(
        peerId,
        [
          { who: "self", atMs: 0, scene: "gaming", text: "Gas mabar bro! Push rank!", durationMs: 2800 },
          { who: "peer", atMs: 400, scene: "gaming", text: "Fokus!! Musuh di depan... tembak!", durationMs: 2800 },
          { who: "self", atMs: 3400, mood: "starry", text: "VICTORY!! EZ GG bro!", durationMs: 2500, confetti: true },
          { who: "peer", atMs: 3600, mood: "excited", text: "Gokil menang telak!!", durationMs: 2500, confetti: true },
        ],
        6500
      );
      return true;
    }

    // Music Concert Mini
    this._runChoreography(
      peerId,
      [
        { who: "self", atMs: 0, scene: "music", text: "♪ Konser mini! Aku beatbox! ♪", durationMs: 3000 },
        { who: "peer", atMs: 550, scene: "music", text: "♪ Asik! Bip-bop-skidibop! ♪", durationMs: 3000 },
        { who: "self", atMs: 3600, mood: "happy", text: "Encore! Penonton puas bro!", durationMs: 2200, confetti: true },
      ],
      6200
    );
    return true;
  }

  startBanterWith(targetId = null) {
    if (!targetId) {
      const nearest = this.getNearestPeerInfo();
      if (!nearest) return false;
      targetId = nearest.peer.id;
    }

    const script = DIALOGUES[this.dialogueIdx % DIALOGUES.length];
    this.dialogueIdx += 1;

    const steps = script.map((turn, idx) => ({
      who: turn.speaker === "A" ? "self" : "peer",
      atMs: idx * 2100,
      mood: turn.mood,
      text: turn.text,
      durationMs: 2800,
    }));

    this._runChoreography(targetId, steps, steps.length * 2200 + 1000);
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
