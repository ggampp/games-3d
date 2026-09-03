const FILES = {
  ambience: 'desert-ambience.mp3',
  shotgun: 'shotgun.mp3',
  bullet: 'pistol.mp3',
  rifle: 'rifle.mp3',
  bomb: 'explosion.mp3',
  laser: 'laser.mp3',
  break: 'wood-break.mp3',
  click: 'ui-click.mp3',
  'step-sand': 'step-sand.mp3',
  'step-wood': 'step-wood.mp3',
  'step-stone': 'step-stone.mp3',
  jump: 'jump.mp3',
  land: 'land.mp3',
  glass: 'glass-break.mp3',
  stone: 'stone-break.mp3',
  metal: 'metal-hit.mp3',
  bell: 'bell.mp3',
  hay: 'hay.mp3',
  creak: 'creak.mp3',
  collapse: 'collapse.mp3',
  coin: 'coin.mp3',
  wagon: 'wagon-roll.mp3',
  fire: 'fire-loop.mp3',
  extinguish: 'extinguish.mp3',
  spray: 'water-spray.mp3',
  'hook-fire': 'hook-fire.mp3',
  'hook-hit': 'hook-hit.mp3',
  reload: 'reload.mp3',
  pickup: 'ammo-pickup.mp3',
  'target-hit': 'target-hit.mp3',
  'target-up': 'target-up.mp3',
  detonator: 'detonator.mp3',
  empty: 'empty-click.mp3',
  fuse: 'fuse.mp3',
} as const;

export type SoundId = keyof typeof FILES;

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private ambienceSource: AudioBufferSourceNode | null = null;
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private lastPlay = new Map<string, number>();
  private listener = { x: 0, y: 0, z: 0 };
  muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.7;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    void this.loadAll();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  setListener(x: number, y: number, z: number): void {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.z = z;
  }

  private async loadAll(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const base = import.meta.env.BASE_URL;
    await Promise.all(Object.entries(FILES).map(async ([id, file]) => {
      try {
        const res = await fetch(`${base}assets/audio/${file}`);
        if (!res.ok) return;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(id, buf);
      } catch {
        // fallback silencioso — o jogo continua jogável
      }
    }));
    this.startAmbience();
  }

  private startAmbience(): void {
    const ctx = this.ctx;
    const master = this.master;
    const buf = this.buffers.get('ambience');
    if (!ctx || !master || !buf || this.ambienceSource) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.28;
    src.connect(gain).connect(master);
    src.start();
    this.ambienceSource = src;
  }

  /** Toca um som; com posição, atenua pela distância ao ouvinte. */
  play(id: SoundId, volume = 1, at?: { x: number; y: number; z: number }, minGap = 0): void {
    const ctx = this.ctx;
    const master = this.master;
    const buf = this.buffers.get(id);
    if (!ctx || !master || !buf) return;
    if (minGap > 0) {
      const now = performance.now();
      const last = this.lastPlay.get(id) ?? -Infinity;
      if (now - last < minGap) return;
      this.lastPlay.set(id, now);
    }
    let v = volume;
    let pan = 0;
    if (at) {
      const dx = at.x - this.listener.x;
      const dy = at.y - this.listener.y;
      const dz = at.z - this.listener.z;
      const d = Math.hypot(dx, dy, dz);
      v *= 1 / (1 + d * d * 0.03);
      pan = Math.max(-0.8, Math.min(0.8, dx / Math.max(3, d)));
    }
    if (v < 0.02) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const gain = ctx.createGain();
    gain.gain.value = v;
    let node: AudioNode = src;
    if (typeof ctx.createStereoPanner === 'function' && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      node = src.connect(panner);
    }
    node.connect(gain).connect(master);
    src.start();
  }

  playBreak(kind: 'wood' | 'stone' | 'metal' | 'glass' | 'hay' | 'bell' | 'coin', at?: { x: number; y: number; z: number }): void {
    const id: SoundId = kind === 'wood' ? 'break' : kind;
    this.play(id, kind === 'bell' ? 0.9 : 0.7, at, 90);
  }

  /** Som em loop com volume alvo (0 desliga). Posicional se `at` for dado. */
  setLoop(id: SoundId, volume: number, at?: { x: number; y: number; z: number } | null): void {
    const ctx = this.ctx;
    const master = this.master;
    const buf = this.buffers.get(id);
    if (!ctx || !master || !buf) return;
    let ch = this.loops.get(id);
    if (!ch) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(master);
      src.start();
      ch = { src, gain };
      this.loops.set(id, ch);
    }
    let v = volume;
    if (at) {
      const d = Math.hypot(at.x - this.listener.x, at.y - this.listener.y, at.z - this.listener.z);
      v = volume / (1 + d * d * 0.06);
    } else if (at === null) {
      v = 0;
    }
    ch.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
  }

  /** Rangido contínuo do moinho: volume pela distância. */
  setCreak(at: { x: number; y: number; z: number } | null): void {
    this.setLoop('creak', 0.35, at ?? null);
  }

  stopAmbience(): void {
    this.ambienceSource?.stop();
    this.ambienceSource = null;
  }
}
