import * as THREE from 'three';

const MAX = 1500;

/** Poeira sem física: pontos com gravidade fraca e vida curta. */
export class Dust {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private grav: Float32Array;
  private col: Float32Array;
  private head = 0;
  private alive = 0;

  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.col = new Float32Array(MAX * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: 0.09,
      toneMapped: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'dust';
  }

  burst(x: number, y: number, z: number, n: number, color: number, spread = 1.4, opts: { life?: number; up?: number; bright?: number; gravity?: number } = {}): void {
    const c = new THREE.Color(color);
    const life = opts.life ?? 1;
    const up = opts.up ?? 0.9;
    const bright = opts.bright ?? 1;
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.1;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.1;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.1;
      this.vel[i * 3] = (Math.random() - 0.5) * spread;
      this.vel[i * 3 + 1] = Math.random() * spread * up + 0.3;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      this.life[i] = (0.6 + Math.random() * 0.9) * life;
      this.grav[i] = opts.gravity ?? 3.5;
      const t = (0.85 + Math.random() * 0.3) * bright;
      this.col[i * 3] = c.r * t;
      this.col[i * 3 + 1] = c.g * t;
      this.col[i * 3 + 2] = c.b * t;
    }
    this.alive = Math.min(MAX, this.alive + n);
  }

  /** Jato: partículas saindo de um ponto numa direção (água, faíscas de solda). */
  stream(x: number, y: number, z: number, dx: number, dy: number, dz: number, speed: number, n: number, color: number, life = 0.6, gravity = 6): void {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      const j = 0.18;
      this.vel[i * 3] = (dx + (Math.random() - 0.5) * j) * speed;
      this.vel[i * 3 + 1] = (dy + (Math.random() - 0.5) * j) * speed;
      this.vel[i * 3 + 2] = (dz + (Math.random() - 0.5) * j) * speed;
      this.life[i] = life * (0.7 + Math.random() * 0.6);
      this.grav[i] = gravity;
      const t = 0.8 + Math.random() * 0.4;
      this.col[i * 3] = c.r * t;
      this.col[i * 3 + 1] = c.g * t;
      this.col[i * 3 + 2] = c.b * t;
    }
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.vel[i * 3] *= 0.96;
      this.vel[i * 3 + 2] *= 0.96;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] = 0;
      }
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -10;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, any ? MAX : 0);
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
