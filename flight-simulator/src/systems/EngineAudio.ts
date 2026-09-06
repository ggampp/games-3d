/**
 * Áudio sintetizado via Web Audio: motor contínuo (ruído filtrado + zumbido) que
 * acompanha a manete, mais sinais curtos para anel, erro e fim de missão.
 * Nada é carregado da rede.
 */
export class EngineAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private hum: OscillatorNode | null = null;
  private humB: OscillatorNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private running = false;
  private enabled = false;
  private targetThrottle = 0;
  private currentThrottle = 0;

  constructor() {
    const unlock = () => void this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  get isRunning(): boolean {
    return this.running;
  }

  async unlock(): Promise<void> {
    if (this.context) {
      if (this.context.state !== 'running') await this.context.resume().catch(() => undefined);
      return;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.context = new Ctor();
      await this.context.resume();
    } catch {
      this.context = null;
      return;
    }
    this.build();
    if (this.enabled) this.start();
  }

  private build(): void {
    const ctx = this.context;
    if (!ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.master);

    // ruído branco em buffer de 2 s, em loop, filtrado passa-banda (rugido)
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04; // ruído marrom suave
      data[i] = last * 6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 180;
    this.noiseFilter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.7;
    noise.connect(this.noiseFilter).connect(noiseGain).connect(this.engineGain);
    noise.start();

    // zumbido de turbina: dois osciladores levemente desafinados
    this.hum = ctx.createOscillator();
    this.hum.type = 'sawtooth';
    this.hum.frequency.value = 55;
    this.humB = ctx.createOscillator();
    this.humB.type = 'triangle';
    this.humB.frequency.value = 110.5;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 420;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.16;
    this.hum.connect(humFilter);
    this.humB.connect(humFilter);
    humFilter.connect(humGain).connect(this.engineGain);
    this.hum.start();
    this.humB.start();
  }

  /** Liga o motor (modo piloto). */
  start(): void {
    this.enabled = true;
    if (!this.context || !this.engineGain) return;
    this.running = true;
    this.engineGain.gain.cancelScheduledValues(this.context.currentTime);
    this.engineGain.gain.setTargetAtTime(0.35, this.context.currentTime, 0.4);
  }

  /** Desliga o motor (modo assistir). */
  stop(): void {
    this.enabled = false;
    this.running = false;
    if (!this.context || !this.engineGain) return;
    this.engineGain.gain.cancelScheduledValues(this.context.currentTime);
    this.engineGain.gain.setTargetAtTime(0, this.context.currentTime, 0.3);
  }

  setThrottle(throttle01: number): void {
    this.targetThrottle = Math.max(0, Math.min(1, throttle01));
  }

  update(dt: number): void {
    if (!this.context || !this.running || !this.hum || !this.humB || !this.noiseFilter || !this.engineGain) return;
    this.currentThrottle += (this.targetThrottle - this.currentThrottle) * Math.min(1, dt * 1.6);
    const t = this.currentThrottle;
    const now = this.context.currentTime;
    this.hum.frequency.setTargetAtTime(48 + t * 95, now, 0.1);
    this.humB.frequency.setTargetAtTime(96 + t * 190, now, 0.1);
    this.noiseFilter.frequency.setTargetAtTime(150 + t * 900, now, 0.1);
    this.engineGain.gain.setTargetAtTime(0.18 + t * 0.42, now, 0.15);
  }

  /** Sino curto ao passar por um anel; o índice sobe o tom. */
  ringPass(index: number, precision01: number): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const base = 520 + index * 40;
    for (const [mult, delay] of [
      [1, 0],
      [1.5, 0.08],
      [2, 0.16],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * mult, now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.22 + precision01 * 0.12, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
      osc.connect(gain).connect(this.master);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    }
  }

  /** Zumbido grave descendente ao perder um anel. */
  ringMiss(): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /** Acorde curto de fim de missão (maior se sucesso, menor se falha). */
  missionEnd(success: boolean): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const notes = success ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23, 311.13];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + i * 0.13;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 1);
    });
  }

  /** Estalo curto ao entrar em turbulência forte. */
  turbulenceHit(): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  dispose(): void {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
