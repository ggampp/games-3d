export class Sfx {
  private context: AudioContext | null = null;
  private unlocked = false;
  private readonly buffers = new Map<string, AudioBuffer>();
  private ambience: HTMLAudioElement | null = null;
  private enabled = true;

  constructor() {
    const unlock = () => {
      void this.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  get music(): boolean {
    return this.enabled;
  }

  set music(value: boolean) {
    this.enabled = value;
    this.syncAmbience();
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.context = new Ctor();
    await this.context.resume();
    this.unlocked = true;
    await this.loadSamples();
    this.syncAmbience();
  }

  place(): void {
    this.play('place', 220, 420, 0.16, 'triangle', 0.07);
  }

  pack(): void {
    this.play('pack', 180, 520, 0.22, 'sine', 0.06);
  }

  complete(): void {
    this.play('complete', 330, 660, 0.28, 'triangle', 0.08);
  }

  click(): void {
    this.play('click', 520, 280, 0.08, 'square', 0.03);
  }

  asleep(): void {
    this.play('asleep', 240, 120, 0.32, 'sine', 0.05);
  }

  dispose(): void {
    this.ambience?.pause();
    this.ambience = null;
    void this.context?.close();
    this.context = null;
  }

  private async loadSamples(): Promise<void> {
    if (!this.context) return;
    const names = ['place', 'pack', 'complete', 'click', 'asleep'] as const;
    await Promise.all(
      names.map(async (name) => {
        try {
          const response = await fetch(`/audio/${name}.mp3`);
          if (!response.ok) return;
          const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
          this.buffers.set(name, buffer);
        } catch {
          // oscillator fallback
        }
      }),
    );
    this.ambience = new Audio('/audio/ambience.mp3');
    this.ambience.loop = true;
    this.ambience.volume = 0.28;
  }

  private syncAmbience(): void {
    if (!this.ambience) return;
    if (this.enabled) {
      void this.ambience.play().catch(() => undefined);
    } else {
      this.ambience.pause();
    }
  }

  private play(
    name: string,
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const sample = this.buffers.get(name);
    if (sample) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = sample;
      gain.gain.value = 0.55;
      source.connect(gain).connect(this.context.destination);
      source.start();
      return;
    }
    this.blip(from, to, duration, type, gainValue);
  }

  private blip(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
