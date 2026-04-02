// DRAGON MINE — Web Audio API sounds (no external files)

let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
  }
  return audioCtx;
}

export function setMuted(m: boolean) {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

function createGain(ctx: AudioContext, value: number, at = 0): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, at);
  return g;
}

// Soft ascending ping — safe tile reveal
export function playTileFlip() {
  if (muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);

    const reverb = ctx.createConvolver();
    const bufLen = ctx.sampleRate * 0.4;
    const buf = ctx.createBuffer(2, bufLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen) ** 3;
      }
    }
    reverb.buffer = buf;

    const gain = createGain(ctx, 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(reverb);
    reverb.connect(ctx.destination);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (_) {
    /* ignore */
  }
}

// Deep growl + descending screech — dragon hit
export function playDragonHit() {
  if (muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Low rumble
    const rumble = ctx.createOscillator();
    rumble.type = "sawtooth";
    rumble.frequency.setValueAtTime(80, now);
    rumble.frequency.exponentialRampToValueAtTime(30, now + 0.6);

    const rumbleGain = createGain(ctx, 0.4, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    // Screech
    const screech = ctx.createOscillator();
    screech.type = "sawtooth";
    screech.frequency.setValueAtTime(600, now + 0.05);
    screech.frequency.exponentialRampToValueAtTime(120, now + 0.5);

    const screechGain = createGain(ctx, 0.28, now + 0.05);
    screechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    // Distortion
    const wave = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((Math.PI + 300) * x) / (Math.PI + 300 * Math.abs(x));
    }
    wave.curve = curve;

    rumble.connect(wave);
    wave.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    screech.connect(screechGain);
    screechGain.connect(ctx.destination);

    rumble.start(now);
    rumble.stop(now + 0.8);
    screech.start(now + 0.05);
    screech.stop(now + 0.65);
  } catch (_) {
    /* ignore */
  }
}

// Coins + ascending chord — cashout success
export function playCashout() {
  if (muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const freqs = [523, 659, 784, 1047];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.07);

      const g = createGain(ctx, 0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(0.25, now + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.5);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.55);
    });

    // Coin shimmer noise
    for (let c = 0; c < 6; c++) {
      const bufLen = ctx.sampleRate * 0.08;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen) ** 2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 4000;

      const g = createGain(ctx, 0.1, now + c * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + c * 0.055 + 0.1);

      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start(now + c * 0.055);
    }
  } catch (_) {
    /* ignore */
  }
}

// Short launch blip — game start
export function playGameStart() {
  if (muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.16);

    const g = createGain(ctx, 0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch (_) {
    /* ignore */
  }
}

// Very soft tick — tile hover
export function playHoverTile() {
  if (muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);

    const g = createGain(ctx, 0.04, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch (_) {
    /* ignore */
  }
}
