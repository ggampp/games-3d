export type SfxName =
  | 'place'
  | 'pack'
  | 'complete'
  | 'click'
  | 'asleep'
  | 'discard'
  | 'undo'
  | 'hover'
  | 'star'
  | 'unlock'
  | 'quest';

const SFX_NAMES: SfxName[] = [
  'place',
  'pack',
  'complete',
  'click',
  'asleep',
  'discard',
  'undo',
  'hover',
  'star',
  'unlock',
  'quest',
];

/** Fallback sintetizado por nome, caso o mp3 gerado não carregue. */
const BLIPS: Record<SfxName, [number, number, number, OscillatorType, number]> = {
  place: [220, 420, 0.16, 'triangle', 0.07],
  pack: [180, 520, 0.22, 'sine', 0.06],
  complete: [330, 660, 0.28, 'triangle', 0.08],
  click: [520, 280, 0.08, 'square', 0.03],
  asleep: [240, 120, 0.32, 'sine', 0.05],
  discard: [300, 180, 0.12, 'triangle', 0.05],
  undo: [180, 360, 0.14, 'sine', 0.05],
  hover: [700, 720, 0.03, 'sine', 0.015],
  star: [660, 990, 0.2, 'triangle', 0.06],
  unlock: [260, 780, 0.4, 'triangle', 0.07],
  quest: [440, 660, 0.18, 'triangle', 0.06],
};

export type AudioSettings = {
  music: boolean;
  musicVolume: number;
  sfxVolume: number;
  voice: boolean;
};

/**
 * Áudio do jogo: SFX (Web Audio, com fallback sintetizado), trilha por estação com crossfade,
 * ambiente em loop e narração (HTMLAudio). Tudo destrava no primeiro toque/tecla.
 */
export class Sfx {
  private context: AudioContext | null = null;
  private unlocked = false;
  private readonly buffers = new Map<string, AudioBuffer>();
  private ambience: HTMLAudioElement | null = null;
  private musicA: HTMLAudioElement | null = null;
  private musicB: HTMLAudioElement | null = null;
  private currentTrack: string | null = null;
  private pendingTrack: string | null = null;
  private voiceEl: HTMLAudioElement | null = null;
  private fadeTimer = 0;
  private settings: AudioSettings = { music: true, musicVolume: 0.6, sfxVolume: 0.8, voice: true };
  private lastHover = 0;

  constructor() {
    const unlock = () => {
      void this.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  apply(settings: AudioSettings): void {
    this.settings = { ...settings };
    this.syncVolumes();
  }

  get enabled(): boolean {
    return this.settings.music;
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
    this.ambience = new Audio('/audio/ambience.mp3');
    this.ambience.loop = true;
    this.ambience.preload = 'auto';
    void this.loadSamples();
    this.syncVolumes();
    if (this.pendingTrack) this.playMusic(this.pendingTrack);
  }

  play(name: SfxName): void {
    if (name === 'hover') {
      const now = performance.now();
      if (now - this.lastHover < 90) return;
      this.lastHover = now;
    }
    if (!this.settings.music || !this.context || this.context.state !== 'running') return;
    const volume = this.settings.sfxVolume;
    if (volume <= 0) return;
    const sample = this.buffers.get(name);
    if (sample) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = sample;
      gain.gain.value = 0.55 * volume * (name === 'hover' ? 0.35 : 1);
      source.connect(gain).connect(this.context.destination);
      source.start();
      return;
    }
    const [from, to, duration, type, gainValue] = BLIPS[name];
    this.blip(from, to, duration, type, gainValue * volume);
  }

  place(): void {
    this.play('place');
  }
  pack(): void {
    this.play('pack');
  }
  complete(): void {
    this.play('complete');
  }
  click(): void {
    this.play('click');
  }
  asleep(): void {
    this.play('asleep');
  }

  /** Troca a trilha (por estação) com crossfade curto. */
  playMusic(track: string | null): void {
    this.pendingTrack = track;
    if (!this.unlocked) return;
    if (track === this.currentTrack) return;
    this.currentTrack = track;
    const outgoing = this.musicA;
    this.musicA = null;
    if (track) {
      const el = new Audio(`/audio/music/${track}.mp3`);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      this.musicA = el;
      if (this.settings.music) void el.play().catch(() => undefined);
    }
    if (outgoing) {
      this.musicB?.pause();
      this.musicB = outgoing;
    }
    this.startFade();
  }

  /** Narração curta: interrompe a anterior. */
  speak(name: string): void {
    if (!this.settings.music || !this.settings.voice || !this.unlocked) return;
    this.voiceEl?.pause();
    const el = new Audio(`/audio/voice/${name}.mp3`);
    el.volume = Math.min(1, 0.9 * this.settings.sfxVolume + 0.1);
    this.voiceEl = el;
    void el.play().catch(() => undefined);
  }

  stopVoice(): void {
    this.voiceEl?.pause();
    this.voiceEl = null;
  }

  dispose(): void {
    window.clearInterval(this.fadeTimer);
    this.ambience?.pause();
    this.musicA?.pause();
    this.musicB?.pause();
    this.voiceEl?.pause();
    this.ambience = null;
    this.musicA = null;
    this.musicB = null;
    this.voiceEl = null;
    void this.context?.close();
    this.context = null;
  }

  private startFade(): void {
    window.clearInterval(this.fadeTimer);
    this.fadeTimer = window.setInterval(() => {
      const target = this.settings.music ? this.settings.musicVolume : 0;
      let busy = false;
      if (this.musicA) {
        const next = Math.min(target, this.musicA.volume + 0.04);
        this.musicA.volume = next;
        busy = busy || next < target;
      }
      if (this.musicB) {
        const next = Math.max(0, this.musicB.volume - 0.06);
        this.musicB.volume = next;
        if (next <= 0) {
          this.musicB.pause();
          this.musicB = null;
        } else busy = true;
      }
      if (!busy) window.clearInterval(this.fadeTimer);
    }, 60);
  }

  private async loadSamples(): Promise<void> {
    if (!this.context) return;
    await Promise.all(
      SFX_NAMES.map(async (name) => {
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
  }

  private syncVolumes(): void {
    const on = this.settings.music;
    if (this.ambience) {
      this.ambience.volume = 0.22 * this.settings.musicVolume;
      if (on) void this.ambience.play().catch(() => undefined);
      else this.ambience.pause();
    }
    if (this.musicA) {
      if (on) {
        void this.musicA.play().catch(() => undefined);
        this.musicA.volume = this.settings.musicVolume;
      } else this.musicA.pause();
    }
    if (!on) this.stopVoice();
  }

  private blip(from: number, to: number, duration: number, type: OscillatorType, gainValue: number): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
