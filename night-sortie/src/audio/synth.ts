import { settings } from '../settings';

/** All sound is synthesised with the Web Audio API. No audio files. */
export class Synth {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private eng!: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filt: BiquadFilterNode; noise: AudioBufferSourceNode; nGain: GainNode; nFilt: BiquadFilterNode };
  private ab!: { gain: GainNode; filt: BiquadFilterNode; crackle: GainNode };
  private wind!: { gain: GainNode; filt: BiquadFilterNode };
  private noiseBuf!: AudioBuffer;
  private started = false;
  private gunT = 0;

  ensure() {
    if (this.started) { if (this.ctx?.state === 'suspended') void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = settings.sound ? settings.volume : 0; this.master.connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // turbine
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 60;
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 121;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 2;
    const gain = ctx.createGain(); gain.gain.value = 0;
    osc.connect(filt); osc2.connect(filt); filt.connect(gain); gain.connect(this.master);
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nFilt = ctx.createBiquadFilter(); nFilt.type = 'bandpass'; nFilt.frequency.value = 900; nFilt.Q.value = 0.7;
    const nGain = ctx.createGain(); nGain.gain.value = 0;
    noise.connect(nFilt); nFilt.connect(nGain); nGain.connect(this.master);
    osc.start(); osc2.start(); noise.start();
    this.eng = { osc, osc2, gain, filt, noise, nGain, nFilt };
    // afterburner: roaring noise + crackle
    const abN = ctx.createBufferSource(); abN.buffer = buf; abN.loop = true;
    const abF = ctx.createBiquadFilter(); abF.type = 'lowpass'; abF.frequency.value = 250; abF.Q.value = 1.2;
    const abG = ctx.createGain(); abG.gain.value = 0;
    const crackle = ctx.createGain(); crackle.gain.value = 1;
    abN.connect(abF); abF.connect(crackle); crackle.connect(abG); abG.connect(this.master); abN.start();
    this.ab = { gain: abG, filt: abF, crackle };
    // wind / airframe hiss
    const wN = ctx.createBufferSource(); wN.buffer = buf; wN.loop = true;
    const wF = ctx.createBiquadFilter(); wF.type = 'highpass'; wF.frequency.value = 1500;
    const wG = ctx.createGain(); wG.gain.value = 0;
    wN.connect(wF); wF.connect(wG); wG.connect(this.master); wN.start();
    this.wind = { gain: wG, filt: wF };
    this.started = true;
  }
  setMuted(m: boolean) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : settings.volume, this.ctx!.currentTime, 0.05); }
  applyVolume() { this.setMuted(!settings.sound); }

  /** n2 0..1, ab 0..1, speedKt, alpha buffet 0..1 */
  update(dt: number, n2: number, ab: number, speedKt: number, buffet: number) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const e = this.eng;
    e.osc.frequency.setTargetAtTime(40 + n2 * 140, t, 0.1);
    e.osc2.frequency.setTargetAtTime(80 + n2 * 300 + buffet * 20, t, 0.1);
    e.filt.frequency.setTargetAtTime(200 + n2 * 1400, t, 0.1);
    e.gain.gain.setTargetAtTime(0.02 + n2 * 0.11, t, 0.1);
    e.nGain.gain.setTargetAtTime(0.01 + n2 * n2 * 0.16, t, 0.1);
    e.nFilt.frequency.setTargetAtTime(500 + n2 * 2500, t, 0.1);
    this.ab.gain.gain.setTargetAtTime(ab * 0.35, t, 0.08);
    this.ab.filt.frequency.setTargetAtTime(150 + ab * 400, t, 0.1);
    // crackle: random gain modulation
    if (ab > 0.05) this.ab.crackle.gain.setTargetAtTime(0.6 + Math.random() * 0.8, t, 0.01);
    const w = Math.min(1, speedKt / 650);
    this.wind.gain.gain.setTargetAtTime(w * w * 0.12 + buffet * 0.08, t, 0.1);
    this.wind.filt.frequency.setTargetAtTime(3000 - w * 2200, t, 0.1);
    this.gunT -= dt;
  }
  private burst(freq: number, q: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.05);
  }
  gun() { if (this.gunT > 0) return; this.gunT = 0.045; this.burst(700, 1.2, 0.07, 0.5, 'lowpass'); this.burst(2200, 2, 0.03, 0.2); }
  hitSpark() { this.burst(3200, 4, 0.08, 0.25); }
  private ping(freq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  kill() { this.ping(1800, 0.5, 0.3, 'triangle'); this.burst(1200, 1, 0.3, 0.35, 'lowpass'); setTimeout(() => this.ping(2600, 0.35, 0.2), 90); }
  lock() { this.ping(1400, 0.06, 0.15, 'square'); }
  uiMove() { this.ping(900, 0.05, 0.08, 'square'); }
  uiConfirm() { this.ping(1200, 0.12, 0.14, 'triangle'); setTimeout(() => this.ping(1800, 0.14, 0.12, 'triangle'), 70); }
  gate() { this.ping(1000, 0.18, 0.2, 'triangle'); setTimeout(() => this.ping(1500, 0.2, 0.18, 'triangle'), 60); }
  warn() { this.ping(600, 0.25, 0.2, 'square'); }
  shield() { this.burst(300, 0.8, 0.4, 0.6, 'lowpass'); this.ping(300, 0.4, 0.3, 'sawtooth'); }
  crash() { this.burst(120, 0.5, 1.2, 0.9, 'lowpass'); }
  reload() { this.ping(500, 0.1, 0.12, 'square'); }
  touchdown() { this.burst(200, 0.6, 0.3, 0.5, 'lowpass'); }
}
