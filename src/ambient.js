/**
 * Procedural Ambient Focus Soundscapes (Pure Web Audio API — Zero MP3/Internet)
 * Supports:
 *  - "rain"  : Gentle rain patter + soft droplet shimmer
 *  - "brown" : Deep warm Brown Noise for deep focus/coding
 *  - "ocean" : Slow rhythmic ocean wave swells
 */

let ambCtx = null;
let currentMode = "off"; // "off" | "rain" | "brown" | "ocean"
let volume = 0.35;
let activeNodes = [];
let masterGainNode = null;
let dropInterval = null;

function ensureContext() {
  if (!ambCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ambCtx = new AC();
  }
  if (ambCtx.state === "suspended") {
    ambCtx.resume().catch(() => {});
  }
  return ambCtx;
}

function createNoiseBuffer(ctx, type = "white", seconds = 3) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * seconds;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "brown") {
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.2;
    }
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
  } else {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  return buffer;
}

export function stopAmbient() {
  if (dropInterval) {
    window.clearInterval(dropInterval);
    dropInterval = null;
  }

  const nodesToStop = activeNodes;
  activeNodes = [];

  if (ambCtx && masterGainNode) {
    const now = ambCtx.currentTime;
    try {
      masterGainNode.gain.cancelScheduledValues(now);
      masterGainNode.gain.setTargetAtTime(0.0001, now, 0.08);
    } catch {
      // Ignore
    }
    const oldMaster = masterGainNode;
    masterGainNode = null;
    window.setTimeout(() => {
      nodesToStop.forEach((n) => {
        try {
          if (typeof n.stop === "function") n.stop();
          n.disconnect();
        } catch {
          // Ignore
        }
      });
      try {
        oldMaster.disconnect();
      } catch {
        // Ignore
      }
    }, 320);
  }

  currentMode = "off";
}

export function setAmbientVolume(val) {
  volume = Math.max(0.05, Math.min(1, Number(val) || 0.35));
  if (ambCtx && masterGainNode) {
    masterGainNode.gain.setTargetAtTime(volume * 0.45, ambCtx.currentTime, 0.08);
  }
}

export function getAmbientState() {
  return { mode: currentMode, volume };
}

export function startAmbient(mode) {
  if (mode === "off" || mode === currentMode) {
    stopAmbient();
    return "off";
  }

  stopAmbient();
  const ctx = ensureContext();
  if (!ctx) return "off";

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.linearRampToValueAtTime(volume * 0.45, ctx.currentTime + 0.55);
  master.connect(ctx.destination);
  masterGainNode = master;

  if (mode === "rain") {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, "pink", 4);
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 380;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(master);
    src.start();
    activeNodes.push(src, hp, lp);

    // Subtle soft distant raindrop plinks
    dropInterval = window.setInterval(() => {
      if (!ambCtx || !masterGainNode || Math.random() > 0.55) return;
      try {
        const now = ambCtx.currentTime;
        const osc = ambCtx.createOscillator();
        const env = ambCtx.createGain();
        const f = 900 + Math.random() * 1400;
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.35, now + 0.05);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.045, now + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        osc.connect(env);
        env.connect(masterGainNode);
        osc.start(now);
        osc.stop(now + 0.09);
      } catch {
        // Ignore
      }
    }, 380);
  } else if (mode === "brown") {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, "brown", 4);
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 360;

    src.connect(lp);
    lp.connect(master);
    src.start();
    activeNodes.push(src, lp);
  } else if (mode === "ocean") {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, "pink", 4);
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 720;

    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.65;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.12; // ~8s gentle wave cycle

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.35;

    const lfoFilterDepth = ctx.createGain();
    lfoFilterDepth.gain.value = 380;

    lfo.connect(lfoDepth);
    lfoDepth.connect(swellGain.gain);
    lfo.connect(lfoFilterDepth);
    lfoFilterDepth.connect(lp.frequency);

    src.connect(lp);
    lp.connect(swellGain);
    swellGain.connect(master);

    src.start();
    lfo.start();
    activeNodes.push(src, lp, swellGain, lfo, lfoDepth, lfoFilterDepth);
  }

  currentMode = mode;
  return currentMode;
}
