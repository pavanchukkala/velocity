let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let muted = false;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function getmaster(): GainNode {
  getCtx();
  return masterGain!;
}

// ── Low-level helpers ────────────────────────────────────────────────────────

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  gainPeak: number,
  freqEnd?: number,
  delayStart = 0
) {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(getmaster());
  osc.type = type;
  const now = c.currentTime + delayStart;
  osc.frequency.setValueAtTime(freq, now);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.01), now + duration);
  }
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function playNoise(duration: number, gainPeak: number, filterFreq = 2000) {
  if (muted) return;
  const c = getCtx();
  const bufSize = c.sampleRate * duration;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;
  const g = c.createGain();
  src.connect(filter);
  filter.connect(g);
  g.connect(getmaster());
  const now = c.currentTime;
  g.gain.setValueAtTime(gainPeak, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.start(now);
  src.stop(now + duration + 0.05);
}

// ── Sound library ─────────────────────────────────────────────────────────────

export type SoundId =
  | 'start'
  | 'over'
  | 'hit'
  | 'powerup'
  | 'spawn'
  | 'levelup'
  | 'nearmiss'
  | 'combobreak'
  | 'collect'
  | 'tap_drop'
  | 'emp'
  | 'swarm'
  | 'firewall'
  | 'shield_ping'
  | 'boost_activate'
  | 'victory'
  | 'defeat';

export function playSound(id: SoundId) {
  if (muted) return;
  switch (id) {
    case 'start':
      playTone(220, 'square', 0.08, 0.08, 330);
      playTone(330, 'square', 0.08, 0.06, 440, 0.08);
      playTone(440, 'square', 0.12, 0.07, 660, 0.16);
      break;

    case 'over':
      playTone(400, 'sawtooth', 0.6, 0.18, 30);
      playNoise(0.4, 0.05, 300);
      break;

    case 'hit':
      playTone(180, 'sawtooth', 0.18, 0.22, 50);
      playNoise(0.15, 0.12, 800);
      break;

    case 'powerup':
      playTone(400, 'sine', 0.05, 0.12, 600);
      playTone(600, 'sine', 0.05, 0.08, 900, 0.05);
      playTone(900, 'sine', 0.1, 0.06, 1200, 0.1);
      break;

    case 'spawn':
      playTone(900, 'sine', 0.08, 0.05, 200);
      break;

    case 'levelup':
      [440, 554, 659, 880].forEach((f, i) => playTone(f, 'square', 0.1, 0.07, f * 1.1, i * 0.09));
      break;

    case 'nearmiss':
      playTone(1600, 'sine', 0.05, 0.06, 2200);
      break;

    case 'combobreak':
      playTone(440, 'sawtooth', 0.3, 0.09, 110);
      break;

    case 'collect':
      playTone(700, 'triangle', 0.08, 0.1, 1400);
      break;

    case 'tap_drop':
      playTone(600, 'square', 0.06, 0.07, 200);
      playNoise(0.05, 0.06, 1200);
      break;

    case 'emp':
      playNoise(0.4, 0.15, 400);
      playTone(80, 'sine', 0.4, 0.12, 40);
      break;

    case 'swarm':
      for (let i = 0; i < 5; i++) {
        playTone(500 + Math.random() * 300, 'sawtooth', 0.06, 0.04, 100, i * 0.04);
      }
      break;

    case 'firewall':
      playNoise(0.3, 0.12, 1500);
      playTone(200, 'sawtooth', 0.3, 0.1, 600);
      break;

    case 'shield_ping':
      playTone(1200, 'sine', 0.15, 0.07, 1600);
      break;

    case 'boost_activate':
      playTone(300, 'sine', 0.08, 0.08, 900);
      playTone(900, 'sine', 0.08, 0.05, 1800, 0.07);
      break;

    case 'victory':
      [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'square', 0.15, 0.09, f * 1.05, i * 0.12));
      break;

    case 'defeat':
      playTone(300, 'sawtooth', 0.8, 0.2, 30);
      playNoise(0.5, 0.08, 200);
      break;
  }
}

// ── Ambient ───────────────────────────────────────────────────────────────────

export function startAmbient() {
  if (muted) return;
  stopAmbient();
  const c = getCtx();
  const freqs = [50, 100, 150];
  ambientNodes = freqs.map((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, c.currentTime);
    g.gain.setValueAtTime(0.008 - i * 0.002, c.currentTime);
    osc.connect(g);
    g.connect(getmaster());
    osc.start();
    return { osc, gain: g };
  });
}

export function stopAmbient() {
  ambientNodes.forEach(({ osc }) => { try { osc.stop(); } catch (_) {} });
  ambientNodes = [];
}

// ── Master volume ─────────────────────────────────────────────────────────────

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.7;
  if (m) stopAmbient();
}

export function getMuted() { return muted; }

// Call this on first user interaction to unlock audio context
export function unlockAudio() { getCtx(); }
