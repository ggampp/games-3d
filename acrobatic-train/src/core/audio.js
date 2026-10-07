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
    if (typeof document !== 'undefined') {
      ['pointerdown', 'touchend', 'keydown'].forEach((evt) => {
        document.addEventListener(evt, unlock, { once: true, passive: true });
      });
    }
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

  dispose() {
    this.master?.disconnect();
    this.actx?.close().catch(() => {});
    this.actx = null; this.master = null; this.noiseBuf = null;
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

  // Steam locomotive high-pressure whistle with realistic steam hiss and harmonic intervals
  steamWhistle() {
    if (!this.isReady()) return;
    // Classic 3-chime Crosby steam whistle (D5, F#5, A5)
    this.playTone('sine', 587.33, 595, 0.95, 0.28, 0);
    this.playTone('triangle', 739.99, 746, 0.95, 0.24, 0);
    this.playTone('sine', 880.00, 892, 0.95, 0.20, 0);
    this.playNoise('bandpass', 1400, 2600, 0.95, 0.15, 0, 2.5);
    // Second short trailing puff
    this.playTone('sine', 587.33, 590, 0.45, 0.24, 0.2);
    this.playTone('triangle', 739.99, 742, 0.45, 0.20, 0.2);
    this.playNoise('bandpass', 1800, 1200, 0.45, 0.12, 0.2, 2.0);
  }

  // Passenger express diesel/electric horn
  passengerHorn() {
    this.playTone('sawtooth', 293.66, 290, 0.8, 0.26, 0);
    this.playTone('sawtooth', 369.99, 365, 0.8, 0.24, 0);
    this.playTone('sawtooth', 440.00, 435, 0.8, 0.18, 0);
    this.playNoise('bandpass', 950, 750, 0.8, 0.14, 0, 1.5);
  }

  // British Rail / Southeastern Class 395 signature two-tone horn ("Doo-Daa" chime)
  britishTwoToneHorn() {
    if (!this.isReady()) return;
    // High note
    this.playTone('sawtooth', 440.00, 438, 0.38, 0.26, 0);
    this.playTone('sine', 440.00, 438, 0.38, 0.18, 0);
    this.playNoise('bandpass', 1200, 950, 0.38, 0.12, 0, 1.8);
    // Low note
    this.playTone('sawtooth', 349.23, 347, 0.48, 0.26, 0.35);
    this.playTone('sine', 349.23, 347, 0.48, 0.18, 0.35);
    this.playNoise('bandpass', 1050, 800, 0.48, 0.12, 0.35, 1.8);
  }

  // Procedural steam exhaust puff (chuff-chuff) scaled with train velocity
  steamChuff(speedKmh = 50) {
    if (!this.isReady()) return;
    const intensity = Math.min(0.25, 0.08 + (speedKmh / 100) * 0.12);
    this.playNoise('bandpass', 450, 220, 0.065, intensity, 0, 1.2);
    this.playTone('triangle', 95, 45, 0.05, intensity * 0.8, 0);
  }

  // Celebratory register & chime when unlocking a train in the Train Store
  storePurchase() {
    if (!this.isReady()) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((f, idx) => {
      this.playTone('triangle', f, f, 0.15, 0.22, idx * 0.06);
      this.playTone('sine', f * 2, f * 2, 0.12, 0.08, idx * 0.06);
    });
    this.playNoise('highpass', 4000, 2000, 0.25, 0.15, 0.15, 1.5);
  }

  // Play appropriate whistle based on train type
  playWhistle(trainType = 'cyber') {
    switch (trainType) {
      case 'steam':
        this.steamWhistle();
        break;
      case 'passenger':
        this.passengerHorn();
        break;
      case 'class395':
      case 'british':
        this.britishTwoToneHorn();
        break;
      default:
        this.horn();
        break;
    }
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
