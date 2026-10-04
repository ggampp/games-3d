/**
 * Procedural Web Audio Sound Engine for Acrobatic Train 3D
 * Synthesizes all SFX in real time without external audio files.
 */

class SoundEngine {
  constructor() {
    this.actx = null;
    this.master = null;
    this.noiseBuf = null;
    this.soundOn = true;
    this.volume = 0.5;

    // Auto unlock on first user interaction
    const unlock = () => {
      const a = this.getAudioContext();
      if (a && a.state !== 'running') a.resume();
    };
    ['pointerdown', 'touchend', 'keydown'].forEach((evt) => {
      document.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  getAudioContext() {
    if (this.actx) return this.actx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    this.actx = new AudioCtx();
    this.master = this.actx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.actx.destination);

    // Generate 1-second white noise buffer for wind, friction, and crash impacts
    this.noiseBuf = this.actx.createBuffer(1, this.actx.sampleRate, this.actx.sampleRate);
    const channelData = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    return this.actx;
  }

  isReady() {
    return this.soundOn && this.actx && this.actx.state === 'running';
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    return this.soundOn;
  }

  playTone(type, f0, f1, duration, vol, delay = 0) {
    if (!this.isReady()) return;
    const ctx = this.actx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playNoise(filterType, f0, f1, duration, vol, delay = 0, q = 1) {
    if (!this.isReady()) return;
    const ctx = this.actx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const bq = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = this.noiseBuf;
    bq.type = filterType;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(bq).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.02);
  }

  // Rail switch hop swoosh
  hop() {
    this.playNoise('bandpass', 700, 2600, 0.18, 0.28, 0, 1.5);
  }

  // Regular rail landing
  land() {
    this.playTone('sine', 150, 55, 0.14, 0.55);
    this.playNoise('highpass', 3500, 2500, 0.06, 0.18);
    this.playTone('square', 950, 720, 0.06, 0.05, 0.01);
  }

  // Stunt jump takeoff
  launch(spin) {
    this.playNoise('bandpass', 400, 3200, spin ? 0.45 : 0.35, 0.38, 0, 1.2);
    this.playTone('sawtooth', 180, 620, 0.25, 0.08);
  }

  // Heavy landing after aerial stunt
  bigLand() {
    this.playTone('sine', 115, 38, 0.3, 0.85);
    this.playNoise('lowpass', 1400, 300, 0.28, 0.45);
    this.playTone('square', 520, 470, 0.16, 0.06, 0.01);
    this.playTone('square', 780, 700, 0.14, 0.05, 0.02);
  }

  // Ring collection chime
  point(level = 0) {
    const baseFreqs = [880, 1047, 1319];
    const base = baseFreqs[Math.min(level, baseFreqs.length - 1)];
    this.playTone('triangle', base, base, 0.08, 0.24);
    this.playTone('triangle', base * 1.5, base * 1.5, 0.14, 0.22, 0.06);
  }

  // Stunt completed triumphant chord
  stunt() {
    this.playTone('triangle', 523.25, 659.25, 0.18, 0.3, 0);
    this.playTone('triangle', 659.25, 783.99, 0.22, 0.3, 0.08);
    this.playTone('triangle', 783.99, 1046.50, 0.35, 0.35, 0.16);
  }

  // Drift Combo multiplier step sound
  driftComboRise(step = 1) {
    const freqs = [440, 554.37, 659.25, 880];
    const f = freqs[Math.min(step - 1, freqs.length - 1)];
    this.playTone('sine', f, f * 1.25, 0.12, 0.22);
  }

  // Multi-chime pneumatic locomotive horn (Nathan K5LA / Typhon train chime)
  horn() {
    this.playTone('sawtooth', 311.13, 307, 0.75, 0.22, 0);
    this.playTone('sawtooth', 370.00, 365, 0.75, 0.20, 0);
    this.playTone('sawtooth', 415.30, 410, 0.75, 0.18, 0);
    this.playTone('sawtooth', 523.25, 517, 0.75, 0.14, 0);
    this.playNoise('bandpass', 1100, 750, 0.75, 0.16, 0, 1.4);
  }

  // Derailment or crash blast
  crash() {
    this.playNoise('lowpass', 3000, 250, 0.9, 0.8);
    this.playTone('sawtooth', 320, 40, 0.6, 0.25);
    [0, 0.09, 0.2, 0.33].forEach((d, i) => {
      this.playTone('square', 600 + i * 170, 420, 0.12, 0.07, d);
    });
  }

  // Rhythmic wheel joint clack
  clack() {
    this.playNoise('bandpass', 1600, 1200, 0.035, 0.14, 0, 2);
    this.playTone('sine', 190, 120, 0.05, 0.16);
  }
}

export const sound = new SoundEngine();
