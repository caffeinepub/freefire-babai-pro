let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  gain: number,
  decay?: number,
) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + (decay ?? duration),
  );
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, gain: number, filterFreq?: number) {
  const ctx = getCtx();
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    src.connect(f);
    f.connect(g);
  } else {
    src.connect(g);
  }
  g.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + duration);
}

export const SoundEngine = {
  setMuted(m: boolean) {
    muted = m;
  },
  isMuted() {
    return muted;
  },

  shoot(weaponType: string) {
    if (weaponType === "bat") return playNoise(0.08, 0.4, 800);
    if (weaponType === "pistol") return playNoise(0.06, 0.5, 2000);
    if (weaponType === "rifle") return playNoise(0.04, 0.7, 3000);
    if (weaponType === "shotgun") return playNoise(0.1, 0.9, 1000);
    if (weaponType === "rocket") return playNoise(0.15, 0.8, 600);
    playNoise(0.05, 0.6, 2500);
  },

  explosion() {
    playNoise(0.6, 1.0, 300);
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.8, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  },

  jump() {
    playTone(320, "sine", 0.15, 0.3, 0.12);
  },

  footstep() {
    playNoise(0.04, 0.12, 400);
  },

  hit() {
    playNoise(0.08, 0.5, 1500);
  },

  death() {
    const ctx = getCtx();
    if (!ctx) return;
    [440, 330, 220, 165].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  },

  victory() {
    [523, 659, 784, 1047].forEach((f, i) => {
      const ctx2 = getCtx();
      if (!ctx2) return;
      const osc = ctx2.createOscillator();
      const g = ctx2.createGain();
      osc.connect(g);
      g.connect(ctx2.destination);
      osc.type = "triangle";
      osc.frequency.value = f;
      const t = ctx2.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  },

  safeZoneWarning() {
    const ctx = getCtx();
    if (!ctx) return;
    [440, 440, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  },

  pickup() {
    playTone(880, "sine", 0.1, 0.2, 0.08);
  },

  vehicleEngine(active: boolean) {
    if (!active) return;
    playNoise(0.08, 0.06, 200);
  },
};
