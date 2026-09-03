import { MATERIALS, VOXEL_SIZE } from '../voxels/types.ts';
import type { Voxel } from '../voxels/types.ts';
import { VoxelGrid, NEIGHBORS } from '../voxels/grid.ts';
import type { PhysicsSim } from '../physics/sim.ts';

const CAP = 420;
const SPREAD_EVERY = 0.4;

interface Flame {
  v: Voxel;
  t: number;
  life: number;
  next: number;
}

export interface FireHooks {
  burnOut: (voxels: Voxel[]) => void;
  setBurning: (v: Voxel, on: boolean) => void;
  flame: (x: number, y: number, z: number, strength: number) => void;
}

/**
 * Fogo voxel a voxel: materiais com `burn > 0` queimam por um tempo,
 * espalham para vizinhos (mais para cima) e viram cinza (destruídos).
 */
export class FireSystem {
  private flames = new Map<number, Flame>();
  private grid: VoxelGrid;
  private physics: PhysicsSim;
  private hooks: FireHooks;
  private emitCursor = 0;

  constructor(grid: VoxelGrid, physics: PhysicsSim, hooks: FireHooks) {
    this.grid = grid;
    this.physics = physics;
    this.hooks = hooks;
  }

  setGrid(grid: VoxelGrid): void {
    this.grid = grid;
    this.flames.clear();
  }

  get count(): number {
    return this.flames.size;
  }

  ignite(v: Voxel, chance = 1): boolean {
    const def = MATERIALS[v.mat];
    if (def.burn <= 0 || this.flames.has(v.id)) return false;
    if (this.flames.size >= CAP) return false;
    if (Math.random() > chance) return false;
    const life = def.burn * (0.7 + Math.random() * 0.7);
    this.flames.set(v.id, { v, t: 0, life, next: SPREAD_EVERY * Math.random() });
    this.hooks.setBurning(v, true);
    return true;
  }

  /** Acende o que for inflamável na esfera (grade + dinâmicos por perto). */
  igniteAround(x: number, y: number, z: number, r: number, chance = 0.6): number {
    let n = 0;
    const k = Math.ceil(r / VOXEL_SIZE);
    const cx = Math.round(x / VOXEL_SIZE), cy = Math.floor(y / VOXEL_SIZE), cz = Math.round(z / VOXEL_SIZE);
    const r2 = r * r;
    for (let iy = cy - k; iy <= cy + k; iy++) {
      for (let iz = cz - k; iz <= cz + k; iz++) {
        for (let ix = cx - k; ix <= cx + k; ix++) {
          const v = this.grid.get(ix, iy, iz);
          if (!v || this.physics.isDynamic(v)) continue;
          const dx = ix * VOXEL_SIZE - x, dy = iy * VOXEL_SIZE + VOXEL_SIZE / 2 - y, dz = iz * VOXEL_SIZE - z;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          if (this.ignite(v, chance)) n += 1;
        }
      }
    }
    for (const v of this.physics.dynamicVoxelsNear({ x, y, z }, r)) {
      const p = this.physics.poseOf(v);
      if (!p) continue;
      const dx = p.x - x, dy = p.y - y, dz = p.z - z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      if (this.ignite(v, chance)) n += 1;
    }
    return n;
  }

  extinguishAround(x: number, y: number, z: number, r: number): number {
    let n = 0;
    const r2 = r * r;
    for (const f of [...this.flames.values()]) {
      const p = this.physics.poseOf(f.v);
      if (!p) continue;
      const dx = p.x - x, dy = p.y - y, dz = p.z - z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      this.flames.delete(f.v.id);
      this.hooks.setBurning(f.v, false);
      n += 1;
    }
    return n;
  }

  /** Voxel destruído por outro motivo: apaga o registro. */
  forget(v: Voxel): void {
    if (this.flames.delete(v.id)) this.hooks.setBurning(v, false);
  }

  /** Centro aproximado das chamas mais próximas de um ponto (para luz e som). */
  nearest(x: number, y: number, z: number, max = 3): { x: number; y: number; z: number; d: number }[] {
    const out: { x: number; y: number; z: number; d: number }[] = [];
    let i = 0;
    for (const f of this.flames.values()) {
      if (i++ % 4 !== 0) continue;
      const p = this.physics.poseOf(f.v);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y, p.z - z);
      out.push({ x: p.x, y: p.y, z: p.z, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, max);
  }

  update(dt: number): void {
    if (this.flames.size === 0) return;
    const dead: Voxel[] = [];
    const list = [...this.flames.values()];
    // Partículas: um subconjunto por frame para não explodir o orçamento.
    const emitN = Math.min(list.length, 24);
    for (let k = 0; k < emitN; k++) {
      const f = list[(this.emitCursor + k) % list.length];
      const p = this.physics.poseOf(f.v);
      if (p) this.hooks.flame(p.x, p.y + VOXEL_SIZE * 0.4, p.z, 1 - f.t / f.life);
    }
    this.emitCursor = (this.emitCursor + emitN) % Math.max(1, list.length);

    for (const f of list) {
      // Voxel sumiu da grade (destruído por tiro)?
      if (this.grid.get(f.v.ix, f.v.iy, f.v.iz) !== f.v) {
        this.flames.delete(f.v.id);
        continue;
      }
      f.t += dt;
      f.next -= dt;
      if (f.next <= 0) {
        f.next = SPREAD_EVERY * (0.6 + Math.random() * 0.8);
        // Espalha para um vizinho; para cima é mais provável.
        const [dx, dy, dz] = NEIGHBORS[Math.floor(Math.random() * NEIGHBORS.length)];
        const n = this.grid.get(f.v.ix + dx, f.v.iy + dy, f.v.iz + dz);
        if (n) this.ignite(n, dy > 0 ? 0.9 : dy < 0 ? 0.25 : 0.55);
        // Vizinho diagonal ocasional (madeira encostada em outra estrutura).
        if (Math.random() < 0.25) {
          const m = this.grid.get(f.v.ix + (Math.random() < 0.5 ? 1 : -1), f.v.iy + 1, f.v.iz + (Math.random() < 0.5 ? 1 : -1));
          if (m) this.ignite(m, 0.4);
        }
      }
      if (f.t >= f.life) {
        this.flames.delete(f.v.id);
        this.hooks.setBurning(f.v, false);
        dead.push(f.v);
      }
    }
    if (dead.length > 0) this.hooks.burnOut(dead);
  }
}
