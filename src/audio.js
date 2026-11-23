/**
 * Characterful Multi-Engine Web Audio Synthesizer (WALL-E / EMO / Vector Inspired)
 * Combines:
 *  - Dual-Filter Vocal Formant Synthesis (real vowel timbres: "a/e/i/o/u" robot speech!)
 *  - Per-Robot Voice Pitch Personality (so Buddy robots have distinct voices!)
 *  - Tactile Foley Effects (Scissors snip-snip, Paper fwish, Rock thud, Popcorn pops, Kiss mwah, Beatbox!)
 *  - FM Celesta / Metallic Bells, Filtered Sawtooth/Square, LFO Wobble & Shaped Noise
 *  - Real-Time AnalyserNode for 60fps Equalizer & Live Mic/Music Visualizer
 */

let audioCtx = null;
let masterGain = null;
let analyser = null;
let freqData = null;
let noiseBufferCache = null;

// Distinct voice pitch multiplier (1.0 = main robot, 1.18 = cute high buddy, 0.88 = cool deep buddy)
let voicePitch = 1.0;

// Live Mic / Music Visualizer state
let micMode = "off"; // "off" | "mic" | "demo"
let micStream = null;
let micSource = null;
let micAnalyser = null;
let micFreqData = null;
let avgBassEnergy = 0.15;

let soundActiveUntil = 0;
let activeSoundStyle = "cyan";
const variationCounters = new Map();
const listeners = new Set();

export function setVoicePitch(multiplier = 1.0) {
  const num = Number(multiplier);
  if (Number.isFinite(num) && num >= 0.65 && num <= 1.5) {
    voicePitch = num;
  }
}

function p(freq) {
  return freq * voicePitch;
}

function nextVariant(key, count) {
  const idx = variationCounters.get(key) || 0;
  variationCounters.set(key, (idx + 1) % count);
  return idx;
}

function ensureAudioGraph() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.65;
    freqData = new Uint8Array(analyser.frequencyBinCount);

    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return { ctx: audioCtx, destination: masterGain };
}

function getNoiseBuffer(ctx) {
  if (noiseBufferCache && noiseBufferCache.sampleRate === ctx.sampleRate) {
    return noiseBufferCache;
  }
  const len = ctx.sampleRate * 1.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBufferCache = buf;
  return buf;
}

function markSoundActive(durationMs, style = "cyan") {
  const until = performance.now() + durationMs;
  if (until > soundActiveUntil) {
    soundActiveUntil = until;
  }
  activeSoundStyle = style;
  for (const fn of listeners) {
    try {
      fn({ durationMs, style });
    } catch {
      // Ignore
    }
  }
}

export function onSoundPlay(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getMicMode() {
  return micMode;
}

/* ==========================================================================
   LIVE MICROPHONE / MUSIC VISUALIZER
   ========================================================================== */
export async function startMicVisualizer() {
  stopMicVisualizer();
  const graph = ensureAudioGraph();

  if (navigator.mediaDevices?.getUserMedia && graph) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      micSource = graph.ctx.createMediaStreamSource(micStream);
      micAnalyser = graph.ctx.createAnalyser();
      micAnalyser.fftSize = 128;
      micAnalyser.smoothingTimeConstant = 0.72;
      micFreqData = new Uint8Array(micAnalyser.frequencyBinCount);
      micSource.connect(micAnalyser);
      micMode = "mic";
      return { mode: "mic" };
    } catch {
      micMode = "demo";
      return { mode: "demo" };
    }
  }

  micMode = "demo";
  return { mode: "demo" };
}

export function stopMicVisualizer() {
  if (micSource) {
    try {
      micSource.disconnect();
    } catch {
      // Ignore
    }
    micSource = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
  micAnalyser = null;
  micFreqData = null;
  micMode = "off";
}

export function getAudioBars(barCount = 9, timeMs = performance.now()) {
  const synthPlaying = timeMs < soundActiveUntil;
  const micActive = micMode !== "off";
  const levels = new Array(barCount).fill(0.18);

  if (!synthPlaying && !micActive) {
    return { playing: false, micActive: false, levels, beat: 0, style: activeSoundStyle };
  }

  const center = (barCount - 1) / 2;

  if (micActive && !synthPlaying) {
    if (micMode === "mic" && micAnalyser && micFreqData) {
      micAnalyser.getByteFrequencyData(micFreqData);
      let bassSum = 0;
      for (let b = 1; b <= 6; b++) {
        bassSum += micFreqData[b] / 255;
      }
      const bass = bassSum / 6;
      avgBassEnergy = avgBassEnergy * 0.92 + bass * 0.08;
      const beat = bass > avgBassEnergy * 1.25 && bass > 0.14 ? Math.min(1, bass * 1.4) : 0;

      for (let i = 0; i < barCount; i++) {
        const dist = Math.abs(i - center) / Math.max(1, center);
        const bin = Math.min(micFreqData.length - 1, 2 + Math.round(dist * 18) + (i % 2) * 2);
        const raw = micFreqData[bin] / 255;
        levels[i] = Math.max(0.18, Math.min(1, Math.pow(raw * 1.85, 0.8)));
      }
      return { playing: false, micActive: true, levels, beat, style: "cyan" };
    }

    const beatPhase = (timeMs % 500) / 500;
    const kick = Math.pow(Math.max(0, 1 - beatPhase * 3.2), 2);
    for (let i = 0; i < barCount; i++) {
      const dist = Math.abs(i - center) / Math.max(1, center);
      const bell = 1 - dist * 0.4;
      const wave = 0.25 + 0.42 * Math.abs(Math.sin(timeMs * 0.008 + i * 0.9)) + kick * 0.55;
      levels[i] = Math.max(0.18, Math.min(1, wave * bell));
    }
    return { playing: false, micActive: true, levels, beat: kick, style: "cyan" };
  }

  const remaining = Math.max(0, soundActiveUntil - timeMs);
  const tailFade = Math.min(1, remaining / 240);

  let hasLiveSignal = false;
  if (analyser && freqData && audioCtx && audioCtx.state === "running") {
    analyser.getByteFrequencyData(freqData);
    let peak = 0;
    for (let i = 0; i < freqData.length; i++) {
      if (freqData[i] > peak) peak = freqData[i];
    }
    hasLiveSignal = peak > 4;
  }

  let energySum = 0;
  for (let i = 0; i < barCount; i++) {
    const distFromCenter = Math.abs(i - center) / Math.max(1, center);
    const bellWeight = 1 - distFromCenter * 0.38;

    let value = 0;
    if (hasLiveSignal) {
      const binIndex = Math.min(
        freqData.length - 1,
        2 + Math.round(distFromCenter * 11) + (i % 2) * 2
      );
      const raw = freqData[binIndex] / 255;
      value = Math.min(1, Math.pow(raw * 2.7, 0.72)) * bellWeight;
    }

    const phase = timeMs * 0.018 + i * 0.85;
    const harmonic = (0.42 + 0.52 * Math.abs(Math.sin(phase))) * bellWeight;
    const blended = hasLiveSignal
      ? Math.max(value, harmonic * 0.42)
      : harmonic * 0.92;

    const finalVal = Math.max(0.18, Math.min(1, blended * tailFade));
    levels[i] = finalVal;
    energySum += finalVal;
  }

  return {
    playing: true,
    micActive,
    levels,
    beat: (energySum / barCount) * 0.55,
    style: activeSoundStyle,
  };
}

export function initAudioUnlock() {
  const unlock = () => {
    ensureAudioGraph();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/* ==========================================================================
   SYNTHESIS ENGINES (Vocal Formants + FM + Filtered Synth + Vibrato + Foley)
   ========================================================================== */

const VOWELS = {
  a: [780, 1280],
  e: [520, 1920],
  i: [340, 2400],
  o: [480, 920],
  u: [330, 740],
};

/**
 * WALL-E / EMO Vocal Formant Synthesizer:
 * Shapes a pitched robotic voice through 2 parallel vocal tract bandpass filters
 * morphing from vowel `v1` -> `v2` with optional expressive vibrato!
 */
function playVocalFormant(
  ctx,
  dest,
  start,
  {
    f1,
    f2 = f1,
    v1 = "o",
    v2 = "a",
    dur = 0.28,
    gain = 0.14,
    vibRate = 0,
    vibDepth = 0,
    wave = "sawtooth",
  }
) {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(p(f1), start);
  if (f2 !== f1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, p(f2)), start + dur * 0.88);
  }

  let lfo = null;
  if (vibRate > 0 && vibDepth > 0) {
    lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.setValueAtTime(vibRate, start);
    lfoG.gain.setValueAtTime(vibDepth, start);
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.04);
  }

  const [f1a, f2a] = VOWELS[v1] || VOWELS.o;
  const [f1b, f2b] = VOWELS[v2] || VOWELS.a;

  const filt1 = ctx.createBiquadFilter();
  filt1.type = "bandpass";
  filt1.Q.value = 5.5;
  filt1.frequency.setValueAtTime(f1a * Math.sqrt(voicePitch), start);
  filt1.frequency.exponentialRampToValueAtTime(f1b * Math.sqrt(voicePitch), start + dur * 0.85);

  const filt2 = ctx.createBiquadFilter();
  filt2.type = "bandpass";
  filt2.Q.value = 7.0;
  filt2.frequency.setValueAtTime(f2a * Math.sqrt(voicePitch), start);
  filt2.frequency.exponentialRampToValueAtTime(f2b * Math.sqrt(voicePitch), start + dur * 0.85);

  const g2 = ctx.createGain();
  g2.gain.value = 0.72;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + Math.min(0.028, dur * 0.22));
  env.gain.setValueAtTime(gain * 0.88, start + dur * 0.72);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(filt1);
  osc.connect(filt2);
  filt1.connect(env);
  filt2.connect(g2);
  g2.connect(env);
  env.connect(dest);

  osc.start(start);
  osc.stop(start + dur + 0.04);
}

/** FM Bell / Metallic Celesta Tone */
function playFMTone(ctx, dest, start, { freq, modRatio = 2.75, modIndex = 140, dur = 0.45, gain = 0.1 }) {
  const f = p(freq);
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const env = ctx.createGain();

  carrier.type = "sine";
  carrier.frequency.setValueAtTime(f, start);

  mod.type = "sine";
  mod.frequency.setValueAtTime(f * modRatio, start);
  modGain.gain.setValueAtTime(modIndex, start);
  modGain.gain.exponentialRampToValueAtTime(1, start + dur * 0.8);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(env);
  env.connect(dest);

  carrier.start(start);
  mod.start(start);
  carrier.stop(start + dur + 0.04);
  mod.stop(start + dur + 0.04);
}

/** Filtered Sawtooth / Square / Sine Synth */
function playFilteredSynth(
  ctx,
  dest,
  start,
  { f1, f2 = f1, type = "sawtooth", cutoffStart = 1800, cutoffEnd = 420, q = 3.5, dur = 0.3, gain = 0.09, applyPitch = true }
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();

  const startF = applyPitch ? p(f1) : f1;
  const endF = applyPitch ? p(f2) : f2;

  osc.type = type;
  osc.frequency.setValueAtTime(startF, start);
  if (f2 !== f1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, endF), start + dur * 0.88);
  }

  filter.type = "lowpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(cutoffStart, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoffEnd), start + dur);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + Math.min(0.02, dur * 0.2));
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(filter);
  filter.connect(env);
  env.connect(dest);

  osc.start(start);
  osc.stop(start + dur + 0.04);
}

/** LFO Vibrato / Wobble Tone */
function playVibratoTone(
  ctx,
  dest,
  start,
  { f1, f2 = f1, type = "sine", lfoRate = 7, lfoDepth = 18, dur = 0.45, gain = 0.095 }
) {
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(p(f1), start);
  if (f2 !== f1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, p(f2)), start + dur * 0.9);
  }

  lfo.type = "sine";
  lfo.frequency.setValueAtTime(lfoRate, start);
  lfoGain.gain.setValueAtTime(lfoDepth, start);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.025);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(env);
  env.connect(dest);

  osc.start(start);
  lfo.start(start);
  osc.stop(start + dur + 0.04);
  lfo.stop(start + dur + 0.04);
}

/** Shaped Bandpass Noise Burst (Swoosh, Snip, Paper, Pop, Breath) */
function playNoiseBurst(
  ctx,
  dest,
  start,
  { freqStart = 1200, freqEnd = 2600, q = 2.2, dur = 0.16, gain = 0.06 }
) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freqStart, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, freqEnd), start + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + Math.min(0.015, dur * 0.25));
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  src.connect(filter);
  filter.connect(env);
  env.connect(dest);

  src.start(start);
  src.stop(start + dur + 0.03);
}

/** Plucked Kalimba / Marimba Pop */
function playPluck(ctx, dest, start, { freq, dur = 0.24, gain = 0.11 }) {
  const f = p(freq);
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const env = ctx.createGain();
  const subGain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(f * 1.03, start);
  osc.frequency.exponentialRampToValueAtTime(f, start + 0.022);

  sub.type = "sine";
  sub.frequency.setValueAtTime(f * 2, start);
  subGain.gain.setValueAtTime(0.28, start);
  subGain.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.45);

  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(env);
  sub.connect(subGain);
  subGain.connect(env);
  env.connect(dest);

  osc.start(start);
  sub.start(start);
  osc.stop(start + dur + 0.03);
  sub.stop(start + dur + 0.03);
}

/* ==========================================================================
   12 ULTRA-EXPRESSIVE CHARACTER VOICES (Vocal Formants + Foley!)
   ========================================================================== */

/** 1. HAPPY (^ ^) — Expressive vocal "Ya-hoo! / Wee-hee!" + kalimba bounce */
export function playHappyChirp() {
  markSoundActive(980, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;
    const v = nextVariant("happy", 3);

    if (v === 0) {
      // Cute "Ya-hooo!" vocal cheer
      playVocalFormant(ctx, destination, now, { f1: 310, f2: 460, v1: "i", v2: "a", dur: 0.16, gain: 0.16 });
      playVocalFormant(ctx, destination, now + 0.15, { f1: 480, f2: 720, v1: "u", v2: "o", dur: 0.32, gain: 0.17, vibRate: 11, vibDepth: 16 });
      playFMTone(ctx, destination, now + 0.24, { freq: 1318.5, modRatio: 2, modIndex: 70, dur: 0.36, gain: 0.07 });
    } else if (v === 1) {
      // Bouncy kalimba + happy "wee!"
      playPluck(ctx, destination, now, { freq: 587.33, dur: 0.2, gain: 0.11 });
      playPluck(ctx, destination, now + 0.1, { freq: 739.99, dur: 0.2, gain: 0.11 });
      playVocalFormant(ctx, destination, now + 0.2, { f1: 420, f2: 680, v1: "u", v2: "i", dur: 0.28, gain: 0.16 });
    } else {
      // Double cheerful "Bip-yay!"
      playVocalFormant(ctx, destination, now, { f1: 360, f2: 520, v1: "e", v2: "i", dur: 0.14, gain: 0.15 });
      playVocalFormant(ctx, destination, now + 0.16, { f1: 440, f2: 640, v1: "a", v2: "e", dur: 0.26, gain: 0.16 });
      playPluck(ctx, destination, now + 0.32, { freq: 1174.66, dur: 0.24, gain: 0.09 });
    }
  } catch {
    // Ignore
  }
}

/** 2. SAD (Teardrop) — Heartfelt vocal "Aww-ooo..." sigh + watery teardrop "bloop!" */
export function playSadWhimper() {
  markSoundActive(1400, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;
    const v = nextVariant("sad", 2);

    // Gentle breathy exhale
    playNoiseBurst(ctx, destination, now + 0.04, {
      freqStart: 880,
      freqEnd: 340,
      q: 3.5,
      dur: 0.45,
      gain: 0.04,
    });

    if (v === 0) {
      // WALL-E style emotional "Aww... oooo..." falling formant whine
      playVocalFormant(ctx, destination, now, {
        f1: 390,
        f2: 280,
        v1: "a",
        v2: "o",
        dur: 0.44,
        gain: 0.15,
        vibRate: 5.5,
        vibDepth: 8,
      });
      playVocalFormant(ctx, destination, now + 0.42, {
        f1: 295,
        f2: 185,
        v1: "o",
        v2: "u",
        dur: 0.62,
        gain: 0.14,
        vibRate: 4.8,
        vibDepth: 7,
      });
      // Crisp watery teardrop "bloop!"
      playFilteredSynth(ctx, destination, now + 0.84, {
        f1: 460,
        f2: 1080,
        type: "sine",
        cutoffStart: 1600,
        cutoffEnd: 2400,
        q: 1,
        dur: 0.11,
        gain: 0.085,
      });
    } else {
      // Soft whimpering "Huuu-uuu..." + minor music box
      playVocalFormant(ctx, destination, now, {
        f1: 340,
        f2: 220,
        v1: "u",
        v2: "o",
        dur: 0.56,
        gain: 0.15,
        vibRate: 6,
        vibDepth: 9,
      });
      playFMTone(ctx, destination, now + 0.4, { freq: 466.16, modRatio: 2, modIndex: 25, dur: 0.42, gain: 0.065 });
      playFMTone(ctx, destination, now + 0.66, { freq: 392.0, modRatio: 2, modIndex: 20, dur: 0.52, gain: 0.065 });
    }
  } catch {
    // Ignore
  }
}

/** 3. LOVE (♥ ♥) — Cute "Mwah!" kiss pop + heartbeat "lub-dub" + warm dreamy harp */
export function playLoveChime() {
  markSoundActive(1350, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Heartbeat "lub-dub"
    playFilteredSynth(ctx, destination, now, {
      f1: 120,
      f2: 64,
      type: "sine",
      cutoffStart: 280,
      cutoffEnd: 110,
      q: 1,
      dur: 0.14,
      gain: 0.15,
      applyPitch: false,
    });
    playFilteredSynth(ctx, destination, now + 0.16, {
      f1: 142,
      f2: 72,
      type: "sine",
      cutoffStart: 300,
      cutoffEnd: 110,
      q: 1,
      dur: 0.15,
      gain: 0.12,
      applyPitch: false,
    });

    // Adorable cartoon kiss pop "Mwah!"
    playNoiseBurst(ctx, destination, now + 0.28, { freqStart: 2400, freqEnd: 5200, q: 4, dur: 0.06, gain: 0.075 });
    playVocalFormant(ctx, destination, now + 0.31, { f1: 360, f2: 560, v1: "u", v2: "a", dur: 0.26, gain: 0.15 });

    // Dreamy Fmaj7 glass harp shimmer
    [698.46, 880.0, 1046.5, 1318.51].forEach((f, idx) => {
      playFMTone(ctx, destination, now + 0.32 + idx * 0.085, {
        freq: f,
        modRatio: 3,
        modIndex: 55,
        dur: 0.68,
        gain: 0.062,
      });
    });
  } catch {
    // Ignore
  }
}

/** 4. CURIOUS (?) — Expressive WALL-E "Hmm... ooo?" / "Bweep?" vocal question */
export function playCuriousSound() {
  markSoundActive(980, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;
    const v = nextVariant("curious", 2);

    if (v === 0) {
      // Thinking "Hmm..." -> curious rising "ooo?"
      playVocalFormant(ctx, destination, now, { f1: 260, f2: 290, v1: "u", v2: "o", dur: 0.22, gain: 0.15 });
      playVocalFormant(ctx, destination, now + 0.25, { f1: 310, f2: 640, v1: "o", v2: "i", dur: 0.34, gain: 0.17 });
    } else {
      // Cheeky R2-D2 question whistle
      playVocalFormant(ctx, destination, now, { f1: 420, f2: 330, v1: "e", v2: "u", dur: 0.15, gain: 0.14 });
      playFilteredSynth(ctx, destination, now + 0.18, {
        f1: 660,
        f2: 1640,
        type: "sine",
        cutoffStart: 1200,
        cutoffEnd: 3800,
        q: 6,
        dur: 0.34,
        gain: 0.1,
      });
    }
  } catch {
    // Ignore
  }
}

/** 5. EXCITED — Enthusiastic "Weee-haa!" vocal cheer + retro chiptune sparkle */
export function playGiggleSound() {
  markSoundActive(1200, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, { f1: 350, f2: 680, v1: "u", v2: "i", dur: 0.24, gain: 0.16 });
    playVocalFormant(ctx, destination, now + 0.24, { f1: 480, f2: 760, v1: "e", v2: "a", dur: 0.28, gain: 0.16, vibRate: 14, vibDepth: 18 });

    [659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => {
      playFilteredSynth(ctx, destination, now + 0.26 + i * 0.065, {
        f1: f,
        f2: f * 1.03,
        type: "square",
        cutoffStart: 2400,
        cutoffEnd: 950,
        q: 2.5,
        dur: 0.12,
        gain: 0.048,
      });
    });
  } catch {
    // Ignore
  }
}

/** 6. GRUMPY (Ngambek) — Funny nasal "Grrr-hmpf!" vocal growl + stubborn huff */
export function playGrumpySound() {
  markSoundActive(980, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Rolling vocal "Grrrr..."
    playVocalFormant(ctx, destination, now, {
      f1: 165,
      f2: 135,
      v1: "o",
      v2: "u",
      dur: 0.3,
      gain: 0.17,
      vibRate: 26,
      vibDepth: 16,
    });
    // Exasperated "Hmpf!"
    playVocalFormant(ctx, destination, now + 0.33, {
      f1: 230,
      f2: 120,
      v1: "a",
      v2: "u",
      dur: 0.26,
      gain: 0.16,
    });
    playNoiseBurst(ctx, destination, now + 0.34, {
      freqStart: 900,
      freqEnd: 320,
      q: 2.2,
      dur: 0.2,
      gain: 0.055,
    });
  } catch {
    // Ignore
  }
}

/** 7. WINK (• ^) — Playful "Chik-DING!" wink click + sparkling bell glint */
export function playWinkSound() {
  markSoundActive(760, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Cheeky tongue-click / wink snap
    playNoiseBurst(ctx, destination, now, { freqStart: 3200, freqEnd: 6200, q: 5, dur: 0.045, gain: 0.08 });
    playVocalFormant(ctx, destination, now + 0.04, { f1: 460, f2: 640, v1: "i", v2: "e", dur: 0.12, gain: 0.13 });
    // High metallic crystal "DING!"
    playFMTone(ctx, destination, now + 0.14, {
      freq: 2349.32,
      modRatio: 3.14,
      modIndex: 185,
      dur: 0.52,
      gain: 0.085,
    });
  } catch {
    // Ignore
  }
}

/** 8. STARRY (✦ ✦) — Awe-struck vocal "Woooow!" + fairy-dust celesta glissando */
export function playStarrySound() {
  markSoundActive(1400, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Expressive awe-struck "Woooow!"
    playVocalFormant(ctx, destination, now, {
      f1: 310,
      f2: 520,
      v1: "u",
      v2: "a",
      dur: 0.45,
      gain: 0.15,
      vibRate: 7,
      vibDepth: 10,
    });
    // Magical celesta sparkle glissando
    [1046.5, 1174.66, 1318.51, 1479.98, 1567.98, 1975.53, 2093.0].forEach((f, idx) => {
      playFMTone(ctx, destination, now + 0.12 + idx * 0.072, {
        freq: f,
        modRatio: 4,
        modIndex: 155,
        dur: 0.55,
        gain: 0.06,
      });
    });
    playNoiseBurst(ctx, destination, now + 0.2, { freqStart: 4200, freqEnd: 7800, q: 3, dur: 0.42, gain: 0.028 });
  } catch {
    // Ignore
  }
}

/** 9. DIZZY (Spiral) — Hilarious wobbling vocal "Woaaah-wub-wub!" cartoon spin */
export function playDizzySound() {
  markSoundActive(1300, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, {
      f1: 480,
      f2: 220,
      v1: "o",
      v2: "u",
      dur: 0.65,
      gain: 0.16,
      vibRate: 13,
      vibDepth: 65,
    });
    playVibratoTone(ctx, destination, now + 0.56, {
      f1: 280,
      f2: 490,
      type: "triangle",
      lfoRate: 11.5,
      lfoDepth: 55,
      dur: 0.48,
      gain: 0.08,
    });
  } catch {
    // Ignore
  }
}

/** 10. COOL (Cyber Shades) — Shades air-swoosh + talkbox "Yeah!" + funky synth brass */
export function playCoolSound() {
  markSoundActive(1100, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Cyber shades sliding down swoosh
    playNoiseBurst(ctx, destination, now, { freqStart: 3600, freqEnd: 620, q: 2.6, dur: 0.18, gain: 0.075 });

    // Confident deep talkbox "Yeah!"
    playVocalFormant(ctx, destination, now + 0.13, {
      f1: 240,
      f2: 195,
      v1: "e",
      v2: "a",
      dur: 0.36,
      gain: 0.15,
    });

    // Slick lo-fi synth chord
    [110, 220, 329.63, 392.0, 493.88].forEach((f, idx) => {
      playFilteredSynth(ctx, destination, now + 0.14, {
        f1: f,
        f2: f * 1.004,
        type: "sawtooth",
        cutoffStart: 2200,
        cutoffEnd: 380,
        q: 2.8,
        dur: 0.7,
        gain: idx === 0 ? 0.065 : 0.035,
      });
    });
  } catch {
    // Ignore
  }
}

/** 11. SHY (> <) — Ultra-cute fluttery "Eee-hihi..." bashful vocal squeak */
export function playShySound() {
  markSoundActive(950, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, {
      f1: 520,
      f2: 640,
      v1: "i",
      v2: "e",
      dur: 0.17,
      gain: 0.13,
      vibRate: 14,
      vibDepth: 16,
    });
    playVocalFormant(ctx, destination, now + 0.2, {
      f1: 580,
      f2: 430,
      v1: "e",
      v2: "u",
      dur: 0.25,
      gain: 0.125,
      vibRate: 11,
      vibDepth: 12,
    });
    playPluck(ctx, destination, now + 0.48, { freq: 1046.5, dur: 0.18, gain: 0.065 });
  } catch {
    // Ignore
  }
}

/** 12. LAUGH (Ngakak) — Genuine bouncing vocal "Ha-ha-ha-he-he!" robot laugh */
export function playLaughSound() {
  markSoundActive(1380, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    const syllables = [
      { t: 0.0, f1: 380, f2: 490, v: "a" },
      { t: 0.15, f1: 420, f2: 540, v: "a" },
      { t: 0.3, f1: 460, f2: 590, v: "e" },
      { t: 0.45, f1: 500, f2: 640, v: "e" },
      { t: 0.62, f1: 540, f2: 720, v: "i" },
    ];
    for (const s of syllables) {
      playVocalFormant(ctx, destination, now + s.t, {
        f1: s.f1,
        f2: s.f2,
        v1: s.v,
        v2: "a",
        dur: 0.12,
        gain: 0.16,
      });
      playNoiseBurst(ctx, destination, now + s.t, {
        freqStart: 1900,
        freqEnd: 3100,
        q: 3,
        dur: 0.055,
        gain: 0.032,
      });
    }
  } catch {
    // Ignore
  }
}

/* ==========================================================================
   OLED MINI-SHOW FOLEY & CHARACTER SOUNDS
   ========================================================================== */

/** Distinct Foley for Suit: Rock (heavy BAM!), Scissors (SNIP-SNIP!), Paper (FWISH!) */
export function playSuitRevealSound(pick = "rock") {
  markSoundActive(680, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    if (pick === "scissors") {
      // Crisp metallic double "SNIP-SNIP!"
      playNoiseBurst(ctx, destination, now, { freqStart: 3800, freqEnd: 7400, q: 6, dur: 0.07, gain: 0.11 });
      playFMTone(ctx, destination, now, { freq: 2600, modRatio: 2.9, modIndex: 280, dur: 0.09, gain: 0.075 });
      playNoiseBurst(ctx, destination, now + 0.14, { freqStart: 4200, freqEnd: 8000, q: 6, dur: 0.08, gain: 0.11 });
      playFMTone(ctx, destination, now + 0.14, { freq: 2950, modRatio: 2.9, modIndex: 280, dur: 0.11, gain: 0.08 });
    } else if (pick === "paper") {
      // Crisp airy paper "FWISH-SNAP!"
      playNoiseBurst(ctx, destination, now, { freqStart: 1200, freqEnd: 4600, q: 1.8, dur: 0.18, gain: 0.12 });
      playNoiseBurst(ctx, destination, now + 0.15, { freqStart: 2800, freqEnd: 1400, q: 2.5, dur: 0.12, gain: 0.08 });
      playPluck(ctx, destination, now + 0.16, { freq: 880, dur: 0.16, gain: 0.075 });
    } else {
      // Heavy punchy Rock "BAM!"
      playFilteredSynth(ctx, destination, now, {
        f1: 180,
        f2: 46,
        type: "triangle",
        cutoffStart: 500,
        cutoffEnd: 90,
        q: 1.5,
        dur: 0.24,
        gain: 0.18,
        applyPitch: false,
      });
      playNoiseBurst(ctx, destination, now, { freqStart: 420, freqEnd: 180, q: 1.5, dur: 0.1, gain: 0.12 });
    }
  } catch {
    // Ignore
  }
}

/** Sweet romantic celesta music-box bloom for Flower scene */
export function playFlowerSound() {
  markSoundActive(1400, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;
    playVocalFormant(ctx, destination, now, { f1: 420, f2: 520, v1: "u", v2: "a", dur: 0.26, gain: 0.12 });
    [659.25, 783.99, 987.77, 1318.51, 1567.98].forEach((f, idx) => {
      playFMTone(ctx, destination, now + 0.08 + idx * 0.11, {
        freq: f,
        modRatio: 2,
        modIndex: 45,
        dur: 0.68,
        gain: 0.07,
      });
    });
  } catch {
    // Ignore
  }
}

/** Movie Night: Popcorn "pop-pop-pop!" foley + retro cinema intro chord */
export function playMovieSound() {
  markSoundActive(1250, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Cute popcorn popping pops!
    [0.0, 0.13, 0.22, 0.36].forEach((t, i) => {
      playFilteredSynth(ctx, destination, now + t, {
        f1: 280 + i * 70,
        f2: 960 + i * 110,
        type: "sine",
        cutoffStart: 1800,
        cutoffEnd: 2600,
        q: 2,
        dur: 0.055,
        gain: 0.095,
      });
    });

    // Warm retro cinema chord
    [392.0, 493.88, 587.33, 783.99].forEach((f, idx) => {
      playFilteredSynth(ctx, destination, now + 0.4 + idx * 0.08, {
        f1: f,
        f2: f,
        type: "sawtooth",
        cutoffStart: 1500,
        cutoffEnd: 520,
        q: 2,
        dur: 0.48,
        gain: 0.045,
      });
    });
  } catch {
    // Ignore
  }
}

/** Spooky hollow vocal ghost howl "BOOOOO-oooo!" + eerie minor organ */
export function playSpookyGhostSound() {
  markSoundActive(1450, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, {
      f1: 420,
      f2: 210,
      v1: "u",
      v2: "o",
      dur: 1.05,
      gain: 0.18,
      vibRate: 7.5,
      vibDepth: 26,
    });
    playFilteredSynth(ctx, destination, now + 0.05, {
      f1: 155.56,
      f2: 146.83,
      type: "sawtooth",
      cutoffStart: 580,
      cutoffEnd: 210,
      q: 4,
      dur: 0.95,
      gain: 0.055,
      applyPitch: false,
    });
  } catch {
    // Ignore
  }
}

/** Hilarious panicked vocal shriek "AAA-EEK!" + fast chattering teeth */
export function playScaredScreamSound() {
  markSoundActive(1050, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, {
      f1: 460,
      f2: 920,
      v1: "a",
      v2: "i",
      dur: 0.42,
      gain: 0.17,
      vibRate: 24,
      vibDepth: 42,
    });
    // Rapid cartoon trembling clicks
    for (let i = 0; i < 5; i++) {
      playNoiseBurst(ctx, destination, now + 0.44 + i * 0.07, {
        freqStart: 2200,
        freqEnd: 3800,
        q: 5,
        dur: 0.035,
        gain: 0.05,
      });
    }
  } catch {
    // Ignore
  }
}

/** 8-bit Arcade Mabar: Laser "pew-pew!" + retro coin "ba-ding!" */
export function playArcadeGameSound() {
  markSoundActive(1200, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    // Two arcade laser pews
    playFilteredSynth(ctx, destination, now, { f1: 1400, f2: 280, type: "square", cutoffStart: 3000, cutoffEnd: 600, q: 3, dur: 0.14, gain: 0.065 });
    playFilteredSynth(ctx, destination, now + 0.18, { f1: 1550, f2: 320, type: "square", cutoffStart: 3000, cutoffEnd: 600, q: 3, dur: 0.14, gain: 0.065 });
    // Classic coin collect ba-ding!
    playFilteredSynth(ctx, destination, now + 0.38, { f1: 987.77, f2: 987.77, type: "square", cutoffStart: 2600, cutoffEnd: 1600, q: 1.5, dur: 0.1, gain: 0.055 });
    playFilteredSynth(ctx, destination, now + 0.49, { f1: 1318.51, f2: 1318.51, type: "square", cutoffStart: 2600, cutoffEnd: 1400, q: 1.5, dur: 0.32, gain: 0.055 });
  } catch {
    // Ignore
  }
}

/** Mini Concert: Robot Beatbox ("Boots-ts-kats-ts!") + upbeat synth groove */
export function playConcertBeatSound() {
  markSoundActive(1450, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    const groove = [0, 0.18, 0.36, 0.54, 0.72, 0.9];
    groove.forEach((t, i) => {
      if (i % 2 === 0) {
        // Kick "Boots!"
        playFilteredSynth(ctx, destination, now + t, {
          f1: 145,
          f2: 48,
          type: "sine",
          cutoffStart: 320,
          cutoffEnd: 85,
          q: 1,
          dur: 0.13,
          gain: 0.15,
          applyPitch: false,
        });
      } else {
        // Crisp snare/hat "Ts-kat!"
        playNoiseBurst(ctx, destination, now + t, { freqStart: 2400, freqEnd: 6800, q: 2, dur: 0.08, gain: 0.08 });
      }
      playPluck(ctx, destination, now + t + 0.06, {
        freq: [523.25, 659.25, 783.99, 659.25, 880.0, 1046.5][i],
        dur: 0.18,
        gain: 0.085,
      });
    });
  } catch {
    // Ignore
  }
}

/* ==========================================================================
   SYSTEM & INTERACTION SOUNDS
   ========================================================================== */

/** Gentle sleepy yawn vocal + lullaby when entering Sleep (Zzz) */
export function playSleepLullaby() {
  markSoundActive(1100, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, { f1: 360, f2: 210, v1: "a", v2: "u", dur: 0.55, gain: 0.12 });
    playFMTone(ctx, destination, now + 0.25, { freq: 523.25, modRatio: 2, modIndex: 20, dur: 0.4, gain: 0.055 });
    playFMTone(ctx, destination, now + 0.48, { freq: 392.0, modRatio: 2, modIndex: 15, dur: 0.52, gain: 0.05 });
  } catch {
    // Ignore
  }
}

/** Cartoon spring jump + startled "Bwoah!" when woken from Sleep */
export function playWakeSurprise() {
  markSoundActive(780, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playVocalFormant(ctx, destination, now, { f1: 240, f2: 680, v1: "u", v2: "a", dur: 0.28, gain: 0.17, vibRate: 16, vibDepth: 28 });
    playPluck(ctx, destination, now + 0.28, { freq: 1174.66, dur: 0.2, gain: 0.09 });
  } catch {
    // Ignore
  }
}

/** Electric Snack / Battery Charge Power-Up Sound */
export function playPowerUpSound() {
  markSoundActive(1080, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playFilteredSynth(ctx, destination, now, {
      f1: 240,
      f2: 1320,
      type: "sawtooth",
      cutoffStart: 500,
      cutoffEnd: 3600,
      q: 4,
      dur: 0.48,
      gain: 0.075,
    });
    playFMTone(ctx, destination, now + 0.46, { freq: 1318.5, modRatio: 2.5, modIndex: 110, dur: 0.35, gain: 0.09 });
    playFMTone(ctx, destination, now + 0.58, { freq: 1760.0, modRatio: 2.5, modIndex: 120, dur: 0.45, gain: 0.09 });
  } catch {
    // Ignore
  }
}

/** Confetti Party Popper Snap + Bright Celebration Triad */
export function playCelebrationPop() {
  markSoundActive(950, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    playNoiseBurst(ctx, destination, now, { freqStart: 2200, freqEnd: 5800, q: 1.4, dur: 0.09, gain: 0.12 });
    [783.99, 987.77, 1174.66, 1567.98].forEach((f, idx) => {
      playPluck(ctx, destination, now + 0.07 + idx * 0.075, { freq: f, dur: 0.34, gain: 0.095 });
    });
  } catch {
    // Ignore
  }
}

/** Metallic Spinning Coin Clinks -> Crisp Landing Ring */
export function playCoinFlipSound() {
  markSoundActive(880, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    const now = ctx.currentTime;

    [0.0, 0.1, 0.21, 0.34].forEach((t, i) => {
      playFMTone(ctx, destination, now + t, {
        freq: 2400 + i * 220,
        modRatio: 2.71,
        modIndex: 220,
        dur: 0.11,
        gain: 0.065,
      });
    });
    playFMTone(ctx, destination, now + 0.48, {
      freq: 3135.96,
      modRatio: 2.71,
      modIndex: 190,
      dur: 0.42,
      gain: 0.085,
    });
  } catch {
    // Ignore
  }
}

/** Gentle crystalline bell arpeggio for reminder & Pomodoro completion */
export function playReminderChime() {
  markSoundActive(1850, "alert");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;

    const now = ctx.currentTime;
    const notes = [
      { freq: 1046.5, start: 0.0, dur: 0.95, gain: 0.12 },
      { freq: 1318.51, start: 0.14, dur: 1.0, gain: 0.115 },
      { freq: 1567.98, start: 0.28, dur: 1.15, gain: 0.12 },
      { freq: 2093.0, start: 0.44, dur: 1.3, gain: 0.085 },
    ];

    for (const n of notes) {
      playFMTone(ctx, destination, now + n.start, {
        freq: n.freq,
        modRatio: 2,
        modIndex: 65,
        dur: n.dur,
        gain: n.gain,
      });
    }
  } catch {
    // Ignore
  }
}

/** Crisp tactile UI confirmation tick */
export function playConfirmTick() {
  markSoundActive(340, "cyan");
  try {
    const graph = ensureAudioGraph();
    if (!graph) return;
    const { ctx, destination } = graph;
    playPluck(ctx, destination, ctx.currentTime, { freq: 1120, dur: 0.12, gain: 0.075 });
  } catch {
    // Ignore
  }
}
