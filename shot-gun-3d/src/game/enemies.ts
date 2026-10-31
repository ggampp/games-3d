import * as THREE from 'three';
import type { Agent, PhysicsSim } from '../physics/sim.ts';
import type { VoxelGrid } from '../voxels/grid.ts';
import { voxelRaycast } from '../voxels/connectivity.ts';
import { VOXEL_SIZE } from '../voxels/types.ts';
import type { Voxel } from '../voxels/types.ts';
import { PLAY_RADIUS } from '../voxels/town.ts';

type Vec = { x: number; y: number; z: number };
type RigidBody = ReturnType<PhysicsSim['spawnGib']>;

export type BanditKind = 'gunman' | 'dynamiter' | 'brute';

interface KindDef {
  hp: number;
  speed: number;
  scale: number;
  /** Distância preferida do jogador (m). */
  near: number;
  far: number;
  range: number;
  aim: number;
  cooldown: [number, number];
  damage: number;
  pellets: number;
  score: number;
  colors: { shirt: number; vest: number; pants: number; hat: number; bandana: number };
}

const KINDS: Record<BanditKind, KindDef> = {
  gunman: {
    hp: 100, speed: 2.7, scale: 1, near: 7, far: 15, range: 26, aim: 0.75, cooldown: [1.3, 2.3], damage: 9, pellets: 1, score: 100,
    colors: { shirt: 0x7a5a3c, vest: 0x2e2420, pants: 0x3a4250, hat: 0x3a2a1c, bandana: 0xa02020 },
  },
  dynamiter: {
    hp: 80, speed: 3.0, scale: 0.96, near: 8, far: 14, range: 17, aim: 0.9, cooldown: [3.6, 5.0], damage: 0, pellets: 0, score: 150,
    colors: { shirt: 0x9a3a2a, vest: 0x4a3a28, pants: 0x4a3a2a, hat: 0x6a5236, bandana: 0x2a2a2a },
  },
  brute: {
    hp: 240, speed: 2.0, scale: 1.2, near: 3, far: 7, range: 11, aim: 0.55, cooldown: [1.6, 2.2], damage: 5, pellets: 6, score: 250,
    colors: { shirt: 0x4a5a6a, vest: 0x262a2e, pants: 0x2a2a30, hat: 0x1e1a18, bandana: 0x2a4a8a },
  },
};

/** Dano dos tiros do jogador nos bandidos, por pellet. */
export const ENEMY_DAMAGE: Record<string, number> = {
  bullet: 45, shotgun: 18, rifle: 95, laser: 3.5, hook: 15, water: 0,
};

const GRAVITY = 18;
const EYE = 1.55;

interface Parts {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  hat: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  prop: THREE.Object3D;
  flash: THREE.Mesh;
  burn: THREE.Mesh;
}

export interface Enemy {
  id: number;
  kind: BanditKind;
  def: KindDef;
  hp: number;
  agent: Agent;
  parts: Parts;
  vy: number;
  yaw: number;
  state: 'move' | 'aim';
  stateT: number;
  cooldown: number;
  side: number;
  sideT: number;
  stuckT: number;
  lastPos: Vec;
  los: boolean;
  losT: number;
  walk: number;
  flinch: number;
  burning: number;
  push: Vec;
  dead: boolean;
}

interface Gib {
  mesh: THREE.Object3D;
  body: RigidBody;
  life: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
}

export interface EnemyHost {
  grid(): VoxelGrid;
  isStatic(v: Voxel): boolean;
  /** Olho do jogador e estado de movimento. */
  player(): { eye: Vec; speed: number; crouched: boolean; alive: boolean };
  hurtPlayer(damage: number, from: Vec): void;
  /** Tiro errado: o projétil segue e lasca o cenário. */
  missHit(origin: Vec, dir: Vec, range: number): void;
  throwBomb(origin: Vec, vel: Vec): void;
  sound(id: 'bullet' | 'shotgun' | 'fuse' | 'land' | 'hay', volume: number, at: Vec): void;
  dust(x: number, y: number, z: number, n: number, color: number, spread: number, opts?: { life?: number; up?: number; bright?: number; gravity?: number }): void;
  killed(e: Enemy, headshot: boolean): void;
}

function part(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function mat(color: number, rough = 0.85, metal = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });
}

const SKIN = mat(0xb07850, 0.8);
const BOOT = mat(0x2a1a10, 0.7);
const BELT = mat(0x3a2414, 0.7);
const BUCKLE = mat(0xd0a040, 0.35, 0.8);
const GUNMETAL = mat(0x30343a, 0.4, 0.8);
const GRIP = mat(0x5a3820, 0.8);
const EYES = mat(0x111111, 0.5);
const DYNAMITE = mat(0xc0281e, 0.7);
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0, depthWrite: false });
const BURN = new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0, depthWrite: false });

/** Bandido low-poly montado em caixas, de frente para +Z, pés em y = 0. */
function makeBandit(kind: BanditKind): Parts {
  const c = KINDS[kind].colors;
  const shirt = mat(c.shirt);
  const vest = mat(c.vest);
  const pants = mat(c.pants);
  const hatM = mat(c.hat, 0.9);
  const band = mat(c.bandana);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const leg = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0.86, 0);
    part(g, 0.15, 0.62, 0.17, 0, -0.33, 0, pants);
    part(g, 0.16, 0.22, 0.24, 0, -0.75, 0.03, BOOT);
    body.add(g);
    return g;
  };
  const legL = leg(-0.11);
  const legR = leg(0.11);

  const torso = new THREE.Group();
  torso.position.set(0, 0.86, 0);
  body.add(torso);
  part(torso, 0.42, 0.6, 0.24, 0, 0.3, 0, shirt);
  part(torso, 0.14, 0.5, 0.02, -0.13, 0.33, 0.125, vest);
  part(torso, 0.14, 0.5, 0.02, 0.13, 0.33, 0.125, vest);
  part(torso, 0.44, 0.5, 0.2, 0, 0.33, -0.03, vest).scale.set(1, 1, 1);
  part(torso, 0.45, 0.07, 0.26, 0, 0.04, 0, BELT);
  part(torso, 0.08, 0.06, 0.02, 0, 0.04, 0.135, BUCKLE);

  const head = new THREE.Group();
  head.position.set(0, 0.66, 0);
  torso.add(head);
  part(head, 0.1, 0.06, 0.1, 0, 0.02, 0, SKIN);
  part(head, 0.24, 0.24, 0.24, 0, 0.16, 0, SKIN);
  part(head, 0.25, 0.11, 0.25, 0, 0.09, 0.005, band);
  part(head, 0.045, 0.03, 0.01, -0.055, 0.19, 0.122, EYES);
  part(head, 0.045, 0.03, 0.01, 0.055, 0.19, 0.122, EYES);
  const hat = new THREE.Group();
  hat.position.set(0, 0.28, 0);
  head.add(hat);
  part(hat, 0.46, 0.03, 0.42, 0, 0, 0, hatM);
  part(hat, 0.27, 0.15, 0.25, 0, 0.08, 0, hatM);
  part(hat, 0.28, 0.03, 0.26, 0, 0.03, 0, BELT);

  const arm = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0.56, 0);
    part(g, 0.12, 0.42, 0.13, 0, -0.2, 0, shirt);
    part(g, 0.11, 0.12, 0.12, 0, -0.47, 0, SKIN);
    torso.add(g);
    return g;
  };
  const armL = arm(-0.28);
  const armR = arm(0.28);

  let prop: THREE.Object3D;
  if (kind === 'dynamiter') {
    const g = new THREE.Group();
    part(g, 0.06, 0.2, 0.06, 0, -0.5, 0.04, DYNAMITE);
    part(g, 0.015, 0.06, 0.015, 0, -0.38, 0.04, BELT);
    armR.add(g);
    // cinto de bananas no peito
    for (let i = 0; i < 4; i++) part(torso, 0.05, 0.16, 0.05, -0.12 + i * 0.08, 0.36, 0.14, DYNAMITE);
    prop = g;
  } else {
    const g = new THREE.Group();
    const long = kind === 'brute';
    part(g, 0.05, 0.07, long ? 0.5 : 0.22, 0, -0.5, long ? 0.22 : 0.1, GUNMETAL);
    part(g, 0.045, 0.12, 0.06, 0, -0.56, 0.0, GRIP);
    if (long) part(g, 0.06, 0.08, 0.2, 0, -0.52, -0.08, GRIP);
    armR.add(g);
    prop = g;
  }
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), FLASH.clone());
  flash.position.set(0, -0.5, kind === 'brute' ? 0.5 : 0.24);
  armR.add(flash);
  const burn = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), BURN.clone());
  burn.position.set(0, 0.9, 0);
  burn.scale.set(0.9, 1.6, 0.9);
  root.add(burn);

  const s = KINDS[kind].scale;
  root.scale.setScalar(s);
  return { root, body, torso, head, hat, armL, armR, legL, legR, prop, flash, burn };
}

/** Raio vs cilindro vertical finito (só a parede lateral). */
function rayCylinder(o: Vec, d: Vec, cx: number, cz: number, r: number, y0: number, y1: number, max: number): number | null {
  const ox = o.x - cx;
  const oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return null;
  const b = ox * d.x + oz * d.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / a, (-b + sq) / a]) {
    if (t < 0 || t > max) continue;
    const y = o.y + d.y * t;
    if (y >= y0 && y <= y1) return t;
  }
  return null;
}

function raySphere(o: Vec, d: Vec, c: Vec, r: number, max: number): number | null {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 && t <= max ? t : null;
}

export interface EnemyHit {
  enemy: Enemy;
  dist: number;
  point: Vec;
  head: boolean;
}

/**
 * Bandidos em ondas. Andam com character controller, desviam de paredes com
 * sondas de voxel, atiram quando enxergam o jogador (com aviso no cano) e
 * viram pedaços com física quando morrem.
 */
export class Enemies {
  readonly group = new THREE.Group();
  readonly list: Enemy[] = [];
  enabled = true;
  wave = 0;
  /** Bandidos ainda por nascer nesta onda. */
  private queue: BanditKind[] = [];
  private spawnT = 0;
  breakT = 4;
  private nextId = 1;
  private gibs: Gib[] = [];
  private tracers: Tracer[] = [];
  private physics: PhysicsSim;
  private host: EnemyHost;
  private tmp = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  constructor(physics: PhysicsSim, host: EnemyHost) {
    this.physics = physics;
    this.host = host;
    this.group.name = 'enemies';
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe09a, transparent: true, opacity: 0.85, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), tracerMat.clone());
      m.visible = false;
      this.group.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
  }

  get alive(): number {
    return this.list.length;
  }

  /** Quantos faltam na onda (vivos + por nascer). */
  get remaining(): number {
    return this.list.length + this.queue.length;
  }

  clear(): void {
    for (const e of this.list) {
      this.physics.removeAgent(e.agent);
      this.group.remove(e.parts.root);
    }
    this.list.length = 0;
    for (const g of this.gibs) {
      this.physics.removeBody(g.body);
      this.group.remove(g.mesh);
    }
    this.gibs.length = 0;
    this.queue.length = 0;
  }

  /** Recomeça do zero (reset da vila). */
  restart(): void {
    this.clear();
    this.wave = 0;
    this.breakT = 5;
  }

  /** Jogador morreu: some com os vivos e repete a onda atual. */
  retryWave(): void {
    this.clear();
    this.wave = Math.max(0, this.wave - 1);
    this.breakT = 4;
  }

  private buildWave(n: number): BanditKind[] {
    const out: BanditKind[] = [];
    const total = 2 + n;
    for (let i = 0; i < total; i++) {
      if (n >= 3 && i % 4 === 3) out.push('brute');
      else if (n >= 2 && i % 3 === 2) out.push('dynamiter');
      else out.push('gunman');
    }
    return out;
  }

  /** Devolve mensagens para o HUD (nova onda / onda limpa). */
  update(dt: number): string | null {
    let msg: string | null = null;
    if (this.enabled) {
      if (this.list.length === 0 && this.queue.length === 0) {
        if (this.breakT > 0) {
          this.breakT -= dt;
          if (this.breakT <= 0) {
            this.wave += 1;
            this.queue = this.buildWave(this.wave);
            this.spawnT = 0;
            msg = `Onda ${this.wave}: ${this.queue.length} bandidos chegando!`;
          }
        }
      }
      if (this.queue.length > 0) {
        this.spawnT -= dt;
        const cap = Math.min(6, 3 + Math.floor(this.wave / 2));
        if (this.spawnT <= 0 && this.list.length < cap) {
          if (this.spawn(this.queue[0])) this.queue.shift();
          this.spawnT = 1.6 + Math.random() * 1.4;
        }
      }
    }
    const pl = this.host.player();
    for (const e of this.list) this.think(e, dt, pl);
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].dead) {
        const e = this.list[i];
        this.physics.removeAgent(e.agent);
        this.group.remove(e.parts.root);
        this.list.splice(i, 1);
        if (this.enabled && this.list.length === 0 && this.queue.length === 0) {
          this.breakT = 7;
          msg = `Onda ${this.wave} limpa!`;
        }
      }
    }
    this.updateGibs(dt);
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life / 0.08) * 0.85;
      if (t.life <= 0) t.mesh.visible = false;
    }
    return msg;
  }

  private spawn(kind: BanditKind): boolean {
    const pl = this.host.player().eye;
    const grid = this.host.grid();
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = PLAY_RADIUS - 2.5 - Math.random() * 3;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - pl.x, z - pl.z) < 13) continue;
      // Espaço livre em volta (sem voxel estático no corpo).
      let blocked = false;
      const ix = Math.round(x / VOXEL_SIZE);
      const iz = Math.round(z / VOXEL_SIZE);
      for (let dy = 0; dy < 22 && !blocked; dy += 3) {
        for (let dz = -5; dz <= 5 && !blocked; dz += 2) {
          for (let dx = -5; dx <= 5; dx += 2) {
            if (grid.get(ix + dx, dy, iz + dz)) { blocked = true; break; }
          }
        }
      }
      if (blocked) continue;
      const def = KINDS[kind];
      const radius = 0.3 * def.scale;
      const halfH = 0.55 * def.scale;
      const agent = this.physics.createAgent(x, halfH + radius + 0.05, z, radius, halfH);
      const parts = makeBandit(kind);
      parts.root.position.set(x, 0, z);
      this.group.add(parts.root);
      const e: Enemy = {
        id: this.nextId++, kind, def, hp: def.hp, agent, parts, vy: 0, yaw: Math.atan2(pl.x - x, pl.z - z),
        state: 'move', stateT: 0, cooldown: 1 + Math.random() * 1.5, side: Math.random() < 0.5 ? -1 : 1, sideT: 2,
        stuckT: 0, lastPos: { x, y: 0, z }, los: false, losT: Math.random() * 0.3, walk: Math.random() * 6,
        flinch: 0, burning: 0, push: { x: 0, y: 0, z: 0 }, dead: false,
      };
      this.list.push(e);
      this.host.dust(x, 0.3, z, 18, 0xc9b28a, 1.4, { life: 1.2, up: 1.2, gravity: 1 });
      return true;
    }
    return false;
  }

  /** Pés do bandido (centro da cápsula menos a meia-altura). */
  feet(e: Enemy): Vec {
    const t = e.agent.body.translation();
    return { x: t.x, y: t.y - e.agent.halfHeight - e.agent.radius, z: t.z };
  }

  private blocked(from: Vec, dir: Vec, dist: number): boolean {
    const hit = voxelRaycast(this.host.grid(), from, dir, dist, VOXEL_SIZE, (v) => this.host.isStatic(v));
    return hit !== null;
  }

  private hasLos(e: Enemy, eye: Vec): boolean {
    const f = this.feet(e);
    const o = { x: f.x, y: f.y + EYE * e.def.scale, z: f.z };
    const dx = eye.x - o.x, dy = eye.y - o.y, dz = eye.z - o.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3) return true;
    const hit = voxelRaycast(this.host.grid(), o, { x: dx / d, y: dy / d, z: dz / d }, d, VOXEL_SIZE, (v) => this.host.isStatic(v));
    return !hit || hit.dist > d - 0.25;
  }

  /** Escolhe uma direção livre perto da desejada (sondas no joelho e no peito). */
  private steer(e: Enemy, f: Vec, want: number): number {
    const probe = (a: number) => {
      const d = { x: Math.sin(a), y: 0, z: Math.cos(a) };
      const look = 1.1 * e.def.scale;
      return !this.blocked({ x: f.x, y: f.y + 0.45, z: f.z }, d, look) && !this.blocked({ x: f.x, y: f.y + 1.25, z: f.z }, d, look);
    };
    if (probe(want)) return want;
    for (const off of [0.6, 1.1, 1.6, 2.2]) {
      const a = want + off * e.side;
      if (probe(a)) return a;
      const b = want - off * e.side;
      if (probe(b)) { e.side = -e.side; return b; }
    }
    return want + Math.PI;
  }

  private think(e: Enemy, dt: number, pl: ReturnType<EnemyHost['player']>): void {
    const def = e.def;
    const f = this.feet(e);
    const dx = pl.eye.x - f.x;
    const dz = pl.eye.z - f.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);

    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.2 + Math.random() * 0.1;
      e.los = pl.alive && dist < def.range + 6 && this.hasLos(e, pl.eye);
    }
    e.cooldown -= dt;
    e.flinch = Math.max(0, e.flinch - dt * 4);
    e.sideT -= dt;
    if (e.sideT <= 0) { e.sideT = 1.5 + Math.random() * 2.5; if (Math.random() < 0.4) e.side = -e.side; }

    if (e.burning > 0) {
      e.burning -= dt;
      this.damage(e, 14 * dt, { x: 0, y: 1, z: 0 }, false, true);
      if (Math.random() < 0.4) this.host.dust(f.x, f.y + 1 + Math.random() * 0.6, f.z, 1, 0xff7a20, 0.4, { life: 0.4, up: 1.6, bright: 2.4, gravity: -2 });
      if (e.dead) return;
    }

    // Decide se para para atirar.
    let moveDir: number | null = null;
    let speed = def.speed;
    if (e.state === 'aim') {
      e.stateT -= dt;
      e.yaw = lerpAngle(e.yaw, toPlayer, Math.min(1, dt * 10));
      const k = 1 - Math.max(0, e.stateT) / def.aim;
      (e.parts.flash.material as THREE.MeshBasicMaterial).opacity = e.kind === 'dynamiter' ? 0 : k > 0.7 ? 0.35 + 0.3 * Math.sin(k * 40) : 0;
      if (e.kind === 'brute') { moveDir = toPlayer; speed *= 0.4; }
      if (e.stateT <= 0) {
        if (e.los && pl.alive) this.fire(e, pl);
        e.state = 'move';
        e.cooldown = def.cooldown[0] + Math.random() * (def.cooldown[1] - def.cooldown[0]);
        (e.parts.flash.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    } else {
      const canShoot = e.los && pl.alive && e.cooldown <= 0 && dist < def.range && (e.kind !== 'dynamiter' || dist > 4.5);
      if (canShoot) {
        e.state = 'aim';
        e.stateT = def.aim;
      } else if (dist > def.far || !e.los) {
        moveDir = toPlayer;
      } else if (dist < def.near) {
        moveDir = toPlayer + Math.PI + e.side * 0.5;
      } else {
        moveDir = toPlayer + e.side * Math.PI / 2; // anda de lado
        speed *= 0.6;
      }
    }

    let vx = 0, vz = 0;
    if (moveDir !== null) {
      const a = this.steer(e, f, moveDir);
      vx = Math.sin(a) * speed;
      vz = Math.cos(a) * speed;
      if (e.state !== 'aim') e.yaw = lerpAngle(e.yaw, e.los ? toPlayer : a, Math.min(1, dt * 7));
    }
    // empurrões (tiro, explosão, gancho)
    vx += e.push.x; vz += e.push.z;
    e.vy += e.push.y;
    const damp = Math.exp(-dt * 5);
    e.push.x *= damp; e.push.z *= damp; e.push.y = 0;

    e.vy -= GRAVITY * dt;
    const res = this.physics.moveAgent(e.agent, { x: vx * dt, y: e.vy * dt, z: vz * dt });
    if (res.grounded && e.vy < 0) e.vy = -0.5;

    // Preso: troca de lado.
    const moved = Math.hypot(res.moved.x, res.moved.z) / Math.max(dt, 1e-4);
    if (moveDir !== null && moved < speed * 0.2) {
      e.stuckT += dt;
      if (e.stuckT > 0.8) { e.side = -e.side; e.stuckT = 0; e.push.x += Math.sin(toPlayer + e.side * 1.5) * 2; e.push.z += Math.cos(toPlayer + e.side * 1.5) * 2; }
    } else e.stuckT = 0;
    if (f.y < -3) { e.dead = true; return; }

    this.animate(e, dt, moved, dist, pl.eye.y - (f.y + 1.4 * def.scale));
  }

  private animate(e: Enemy, dt: number, speed: number, dist: number, dy: number): void {
    const p = e.parts;
    const f = this.feet(e);
    p.root.position.set(f.x, f.y, f.z);
    p.root.rotation.y = e.yaw;
    e.walk += dt * (3 + speed * 2.4) * (speed > 0.3 ? 1 : 0);
    const sw = speed > 0.3 ? Math.sin(e.walk) * Math.min(0.7, speed * 0.25) : 0;
    p.legL.rotation.x = sw;
    p.legR.rotation.x = -sw;
    p.body.position.y = Math.abs(Math.cos(e.walk)) * 0.03 * Math.min(1, speed / 2);
    p.armL.rotation.x = -sw * 0.8;
    const aiming = e.state === 'aim' || e.los;
    const pitch = Math.atan2(dy, Math.max(dist, 0.5));
    if (e.kind === 'dynamiter' && e.state === 'aim') {
      // braço sobe para trás e arremessa
      const k = 1 - Math.max(0, e.stateT) / e.def.aim;
      p.armR.rotation.x = -Math.PI * (0.6 + k * 0.5);
    } else {
      const target = aiming ? -Math.PI / 2 - pitch : sw * 0.8;
      p.armR.rotation.x += (target - p.armR.rotation.x) * Math.min(1, dt * 12);
    }
    if (e.kind === 'brute' && aiming) {
      p.armL.rotation.x = -Math.PI / 2.4 - pitch;
      p.armL.rotation.z = -0.5;
    } else p.armL.rotation.z = 0;
    p.torso.rotation.x = -e.flinch * 0.5;
    p.head.rotation.x = -pitch * 0.5;
    const bm = p.burn.material as THREE.MeshBasicMaterial;
    bm.opacity = e.burning > 0 ? 0.25 + Math.random() * 0.2 : 0;
  }

  private muzzle(e: Enemy): Vec {
    e.parts.flash.getWorldPosition(this.tmp);
    return { x: this.tmp.x, y: this.tmp.y, z: this.tmp.z };
  }

  private fire(e: Enemy, pl: ReturnType<EnemyHost['player']>): void {
    const o = this.muzzle(e);
    if (e.kind === 'dynamiter') {
      const tx = pl.eye.x + (Math.random() - 0.5) * 1.6;
      const tz = pl.eye.z + (Math.random() - 0.5) * 1.6;
      const dx = tx - o.x, dz = tz - o.z;
      const d = Math.hypot(dx, dz);
      const T = Math.min(1.35, Math.max(0.7, d / 9));
      const vy = (0.15 - o.y + 0.5 * 9.81 * T * T) / T;
      this.host.throwBomb(o, { x: dx / T, y: vy, z: dz / T });
      this.host.sound('fuse', 0.6, o);
      return;
    }
    const target = { x: pl.eye.x, y: pl.eye.y - 0.35, z: pl.eye.z };
    const dist = Math.hypot(target.x - o.x, target.y - o.y, target.z - o.z);
    this.host.sound(e.kind === 'brute' ? 'shotgun' : 'bullet', 0.75, o);
    (e.parts.flash.material as THREE.MeshBasicMaterial).opacity = 1;
    setTimeout(() => { (e.parts.flash.material as THREE.MeshBasicMaterial).opacity = 0; }, 60);
    const pellets = Math.max(1, e.def.pellets);
    let dmg = 0;
    for (let i = 0; i < pellets; i++) {
      const chance = Math.max(0.1, Math.min(0.82,
        (e.kind === 'brute' ? 0.95 : 0.78) - dist * (e.kind === 'brute' ? 0.07 : 0.022) - pl.speed * 0.25 - (pl.crouched ? 0.12 : 0)));
      const hit = Math.random() < chance;
      const miss = hit ? 0 : 0.6 + Math.random() * 0.9;
      const a = Math.random() * Math.PI * 2;
      const end = { x: target.x + Math.cos(a) * miss, y: target.y + Math.sin(a) * miss * 0.6, z: target.z + Math.sin(a) * miss };
      const dx = end.x - o.x, dy = end.y - o.y, dz = end.z - o.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const dir = { x: dx / len, y: dy / len, z: dz / len };
      if (hit) {
        dmg += e.def.damage;
        if (i === 0) this.tracer(o, end);
      } else {
        const far = { x: o.x + dir.x * 40, y: o.y + dir.y * 40, z: o.z + dir.z * 40 };
        if (i < 2) this.tracer(o, far);
        this.host.missHit(o, dir, 40);
      }
    }
    if (dmg > 0) this.host.hurtPlayer(dmg, o);
  }

  private tracer(a: Vec, b: Vec): void {
    const t = this.tracers.find((x) => x.life <= 0) ?? this.tracers[0];
    const from = new THREE.Vector3(a.x, a.y, a.z);
    const to = new THREE.Vector3(b.x, b.y, b.z);
    const len = from.distanceTo(to);
    t.mesh.position.copy(from).lerp(to, 0.5);
    t.mesh.scale.set(1, len, 1);
    t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    t.mesh.visible = true;
    t.life = 0.08;
  }

  /** Tiro do jogador: o bandido mais próximo no raio, antes de `max`. */
  raycast(o: Vec, d: Vec, max: number): EnemyHit | null {
    let best: EnemyHit | null = null;
    for (const e of this.list) {
      if (e.dead) continue;
      const f = this.feet(e);
      const s = e.def.scale;
      const limit = best ? best.dist : max;
      const headC = this.headCenter(e);
      const th = raySphere(o, d, headC, 0.16 * s, limit);
      const tb = rayCylinder(o, d, f.x, f.z, 0.27 * s, f.y + 0.05, f.y + 1.5 * s, limit);
      let t: number | null = null;
      let head = false;
      if (th !== null && (tb === null || th <= tb + 0.05)) { t = th; head = true; } else if (tb !== null) t = tb;
      if (t === null || t > limit) continue;
      best = { enemy: e, dist: t, point: { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t }, head };
    }
    return best;
  }

  private headCenter(e: Enemy): Vec {
    e.parts.head.getWorldPosition(this.tmp);
    const s = e.def.scale;
    return { x: this.tmp.x, y: this.tmp.y + 0.15 * s, z: this.tmp.z };
  }

  /** Aplica dano; `dir` é a direção do golpe (para o empurrão e os pedaços). */
  damage(e: Enemy, amount: number, dir: Vec, head: boolean, quiet = false): void {
    if (e.dead || amount <= 0) return;
    e.hp -= amount;
    if (!quiet) {
      e.flinch = Math.min(1, e.flinch + amount / 40);
      e.push.x += dir.x * Math.min(3, amount * 0.04);
      e.push.z += dir.z * Math.min(3, amount * 0.04);
      if (e.state === 'aim' && amount > 30) e.stateT += 0.25; // atrapalha a mira
    }
    if (e.hp <= 0) this.kill(e, dir, amount, head);
  }

  ignite(e: Enemy, seconds: number): void {
    e.burning = Math.max(e.burning, seconds);
  }

  extinguish(e: Enemy): void {
    e.burning = 0;
  }

  shove(e: Enemy, v: Vec): void {
    e.push.x += v.x;
    e.push.y += v.y;
    e.push.z += v.z;
  }

  /** Explosão: dano decrescente com a distância e corpos voando. */
  explosion(x: number, y: number, z: number, radius: number, power: number): void {
    for (const e of this.list) {
      if (e.dead) continue;
      const f = this.feet(e);
      const dx = f.x - x, dy = f.y + 0.9 - y, dz = f.z - z;
      const d = Math.hypot(dx, dy, dz);
      if (d > radius) continue;
      const k = 1 - d / radius;
      const n = Math.max(d, 0.2);
      const dir = { x: dx / n, y: 0.6, z: dz / n };
      this.shove(e, { x: dir.x * 8 * k, y: 5 * k, z: dir.z * 8 * k });
      this.damage(e, power * k, dir, false);
    }
  }

  /** Pontos (pés + 0,9 m) dos vivos — para as bombas detonarem no contato. */
  centers(): Vec[] {
    return this.list.filter((e) => !e.dead).map((e) => {
      const f = this.feet(e);
      return { x: f.x, y: f.y + 0.9, z: f.z };
    });
  }

  private kill(e: Enemy, dir: Vec, amount: number, head: boolean): void {
    e.dead = true;
    this.host.killed(e, head);
    const root = e.parts.root;
    root.updateMatrixWorld(true);
    const force = Math.min(9, 2.5 + amount * 0.04);
    // Cada caixa vira um pedaço com física (ragdoll de pobre, mas divertido).
    const pieces: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && o !== e.parts.flash && o !== e.parts.burn) pieces.push(o);
    });
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    for (const m of pieces) {
      m.geometry.computeBoundingBox();
      box.copy(m.geometry.boundingBox!);
      box.getSize(size);
      const ws = new THREE.Vector3();
      m.getWorldScale(ws);
      m.getWorldPosition(center);
      m.getWorldQuaternion(this.tmpQ);
      const half = { x: Math.max(0.02, size.x * ws.x * 0.5), y: Math.max(0.02, size.y * ws.y * 0.5), z: Math.max(0.02, size.z * ws.z * 0.5) };
      const isHat = m.parent === e.parts.hat;
      const up = isHat || (head && m.parent === e.parts.head) ? 4.5 : 1.5;
      const jitter = () => (Math.random() - 0.5) * 2;
      const body = this.physics.spawnGib(
        { x: center.x, y: center.y, z: center.z },
        half,
        { x: this.tmpQ.x, y: this.tmpQ.y, z: this.tmpQ.z, w: this.tmpQ.w },
        { x: dir.x * force + jitter(), y: up + Math.random() * 1.5, z: dir.z * force + jitter() },
        { x: jitter() * 6, y: jitter() * 6, z: jitter() * 6 },
      );
      const clone = new THREE.Mesh(m.geometry, m.material);
      clone.scale.copy(ws);
      clone.castShadow = true;
      this.group.add(clone);
      this.gibs.push({ mesh: clone, body, life: 7 + Math.random() * 2 });
    }
    const f = this.feet(e);
    this.host.dust(f.x, f.y + 1, f.z, 26, 0x8a1a12, 1.6, { life: 0.9, up: 1, gravity: 5 });
    this.host.dust(f.x, f.y + 0.4, f.z, 20, 0xc9b28a, 1.4, { life: 1.4, up: 0.8, gravity: 1 });
  }

  private updateGibs(dt: number): void {
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i];
      g.life -= dt;
      const t = g.body.translation();
      const r = g.body.rotation();
      g.mesh.position.set(t.x, t.y, t.z);
      g.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (g.life < 1) g.mesh.scale.multiplyScalar(Math.max(0.9, 1 - dt * 3));
      if (g.life <= 0 || t.y < -3) {
        this.physics.removeBody(g.body);
        this.group.remove(g.mesh);
        this.gibs.splice(i, 1);
      }
    }
    // Teto de pedaços no mundo.
    while (this.gibs.length > 160) {
      const g = this.gibs.shift()!;
      this.physics.removeBody(g.body);
      this.group.remove(g.mesh);
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

