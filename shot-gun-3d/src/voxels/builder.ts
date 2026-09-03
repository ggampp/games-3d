import { VoxelGrid } from './grid.ts';
import { VOXEL_SIZE, toIx, toIy } from './types.ts';
import type { MatId, Voxel, VoxelGroup } from './types.ts';

/**
 * Construtor de prefabs em METROS. Converte para índices na hora de gravar,
 * então mudar `VOXEL_SIZE` não muda a planta.
 *
 * Convenções: x/z são centros de coluna; y0 é a base e y1 o topo (exclusivo).
 * Um intervalo vazio grava ao menos uma camada/coluna.
 */
export class Builder {
  readonly grid: VoxelGrid;
  readonly s: number;
  readonly ox: number;
  readonly oz: number;
  readonly oy: number;
  /** Rotação em quartos de volta (0..3) em torno da origem local. */
  readonly rot: number;

  constructor(grid: VoxelGrid, s: number, ox = 0, oz = 0, oy = 0, rot = 0) {
    this.grid = grid;
    this.s = s;
    this.ox = ox;
    this.oz = oz;
    this.oy = oy;
    this.rot = ((rot % 4) + 4) % 4;
  }

  /** Local (metros) → índices de mundo. */
  idx(x: number, y: number, z: number): [number, number, number] {
    let lx = x;
    let lz = z;
    if (this.rot === 1) { lx = -z; lz = x; }
    else if (this.rot === 2) { lx = -x; lz = -z; }
    else if (this.rot === 3) { lx = z; lz = -x; }
    return [toIx(lx + this.ox), toIy(y + this.oy), toIx(lz + this.oz)];
  }

  add(x: number, y: number, z: number, mat: MatId, group: VoxelGroup = 'structure'): Voxel | undefined {
    const [ix, iy, iz] = this.idx(x, y, z);
    return this.grid.add(ix, iy, iz, mat, group, this.s);
  }

  set(x: number, y: number, z: number, mat: MatId, group: VoxelGroup = 'structure'): Voxel {
    const [ix, iy, iz] = this.idx(x, y, z);
    return this.grid.set(ix, iy, iz, mat, group, this.s);
  }

  box(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    mat: MatId, group: VoxelGroup = 'structure',
  ): Voxel[] {
    const [ax, ay, az] = this.idx(x0, y0, z0);
    const [bx, by0, bz] = this.idx(x1, y1, z1);
    let by = by0 - 1;
    if (by < ay) by = ay;
    return this.grid.fillBox(ax, ay, az, bx, by, bz, mat, group, this.s);
  }

  /** Caixa oca (paredes de `t` metros), sem chão nem teto. */
  walls(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    t: number, mat: MatId, group: VoxelGroup = 'structure',
  ): void {
    this.box(x0, y0, z0, x1, y1, z0 + t - VOXEL_SIZE, mat, group);
    this.box(x0, y0, z1 - t + VOXEL_SIZE, x1, y1, z1, mat, group);
    this.box(x0, y0, z0, x0 + t - VOXEL_SIZE, y1, z1, mat, group);
    this.box(x1 - t + VOXEL_SIZE, y0, z0, x1, y1, z1, mat, group);
  }

  /** Remove voxels numa caixa (abrir portas/janelas). */
  carve(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const [ax, ay, az] = this.idx(x0, y0, z0);
    const [bx, by0, bz] = this.idx(x1, y1, z1);
    let by = by0 - 1;
    if (by < ay) by = ay;
    for (let iy = Math.min(ay, by); iy <= Math.max(ay, by); iy++) {
      for (let iz = Math.min(az, bz); iz <= Math.max(az, bz); iz++) {
        for (let ix = Math.min(ax, bx); ix <= Math.max(ax, bx); ix++) {
          const v = this.grid.get(ix, iy, iz);
          if (v) this.grid.remove(v);
        }
      }
    }
  }

  /** Cilindro vertical cheio (ou anel se `inner` > 0). */
  cylinder(
    cx: number, cz: number, r: number, y0: number, y1: number,
    mat: MatId, group: VoxelGroup = 'structure', inner = 0,
  ): void {
    const n = Math.ceil(r / VOXEL_SIZE) + 1;
    const r2 = r * r;
    const i2 = inner * inner;
    const [icx, , icz] = this.idx(cx, 0, cz);
    const [, iy0] = this.idx(0, y0, 0);
    const [, iy1] = this.idx(0, y1, 0);
    for (let dz = -n; dz <= n; dz++) {
      for (let dx = -n; dx <= n; dx++) {
        const wx = dx * VOXEL_SIZE;
        const wz = dz * VOXEL_SIZE;
        const d2 = wx * wx + wz * wz;
        if (d2 > r2 || d2 < i2) continue;
        for (let iy = iy0; iy < Math.max(iy1, iy0 + 1); iy++) {
          this.grid.add(icx + dx, iy, icz + dz, mat, group, this.s);
        }
      }
    }
  }

  /** Cone/pirâmide: camadas que encolhem de `r0` (base) a `r1` (topo). */
  cone(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, mat: MatId, group: VoxelGroup = 'structure', square = false): void {
    const layers = Math.max(1, Math.round((y1 - y0) / VOXEL_SIZE));
    for (let i = 0; i < layers; i++) {
      const t = layers === 1 ? 0 : i / (layers - 1);
      const r = r0 + (r1 - r0) * t;
      const y = y0 + i * VOXEL_SIZE;
      if (square) {
        if (r <= VOXEL_SIZE * 1.5) this.box(cx - r, y, cz - r, cx + r, y + VOXEL_SIZE, cz + r, mat, group);
        else this.walls(cx - r, y, cz - r, cx + r, y + VOXEL_SIZE, cz + r, VOXEL_SIZE, mat, group);
      } else {
        this.cylinder(cx, cz, r, y, y + VOXEL_SIZE, mat, group, Math.max(0, r - VOXEL_SIZE * 1.6));
      }
    }
  }

  /** Telhado de duas águas ao longo de X: cumeeira em z=cz, cai para ±depth. */
  gableRoof(x0: number, x1: number, cz: number, depth: number, y0: number, rise: number, mat: MatId, thickness = VOXEL_SIZE): void {
    const steps = Math.max(1, Math.round(depth / VOXEL_SIZE));
    for (let i = 0; i <= steps; i++) {
      const d = i * VOXEL_SIZE;
      const y = y0 + rise * (1 - i / steps);
      this.box(x0, y, cz - d, x1, y + thickness, cz - d, mat);
      this.box(x0, y, cz + d, x1, y + thickness, cz + d, mat);
    }
  }

  /** Telhado de uma água (inclinado) ao longo de X, subindo de z0 para z1. */
  shedRoof(x0: number, x1: number, z0: number, z1: number, yLow: number, yHigh: number, mat: MatId, thickness = VOXEL_SIZE): void {
    const steps = Math.max(1, Math.round(Math.abs(z1 - z0) / VOXEL_SIZE));
    const dir = z1 >= z0 ? 1 : -1;
    for (let i = 0; i <= steps; i++) {
      const z = z0 + dir * i * VOXEL_SIZE;
      const y = yLow + (yHigh - yLow) * (i / steps);
      this.box(x0, y, z, x1, y + thickness, z, mat);
    }
  }

  /**
   * Mapa ASCII vertical (plano XY em z fixo). Linha 0 é o topo. Cada char
   * mapeado em `legend` vira um voxel; espaço = vazio.
   */
  ascii(rows: string[], x0: number, yTop: number, z: number, legend: Record<string, MatId>, group: VoxelGroup = 'structure', depth = 1): void {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const y = yTop - (r + 1) * VOXEL_SIZE;
      for (let c = 0; c < row.length; c++) {
        const mat = legend[row[c]];
        if (!mat) continue;
        for (let d = 0; d < depth; d++) {
          this.add(x0 + c * VOXEL_SIZE, y, z + d * VOXEL_SIZE, mat, group);
        }
      }
    }
  }

  /** Mapa ASCII horizontal (plano XZ em y fixo). */
  asciiFloor(rows: string[], x0: number, y: number, z0: number, legend: Record<string, MatId>, group: VoxelGroup = 'structure', height = 1): void {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const mat = legend[row[c]];
        if (!mat) continue;
        for (let h = 0; h < height; h++) {
          this.add(x0 + c * VOXEL_SIZE, y + h * VOXEL_SIZE, z0 + r * VOXEL_SIZE, mat, group);
        }
      }
    }
  }

  /** Poste quadrado de lado `w` metros. */
  post(x: number, z: number, y0: number, y1: number, w: number, mat: MatId = 'wood'): void {
    const h = w / 2 - VOXEL_SIZE / 2;
    this.box(x - h, y0, z - h, x + h, y1, z + h, mat);
  }

  /**
   * Porta batente: folha de pranchas + dobradiças. A coluna de dobradiça
   * fica em `hx` (deve ser vizinha de um voxel `structure`).
   */
  door(x0: number, x1: number, y0: number, y1: number, z: number, hx: number, id: string, thick = VOXEL_SIZE * 2, mat: MatId = 'plank'): void {
    const group = `door:${id}`;
    this.box(x0, y0, z - thick / 2 + VOXEL_SIZE / 2, x1, y1, z + thick / 2 - VOXEL_SIZE / 2, mat, group);
    const mid = (y0 + y1) / 2;
    for (const y of [y0 + 0.12, mid, y1 - 0.18]) {
      this.add(hx, y, z, 'hinge', group);
      this.add(hx, y + VOXEL_SIZE, z, 'hinge', group);
    }
  }

  /**
   * Corrente pendurada em (x, z) a partir de `yTop` (logo abaixo de um voxel
   * `structure`), com `links` elos de 2 voxels. Devolve o y do fim.
   */
  chain(x: number, z: number, yTop: number, links: number, id: string): number {
    const group = `chain:${id}`;
    let y = yTop - VOXEL_SIZE * 2; // folga sob a viga
    for (let i = 0; i < links; i++) {
      this.add(x, y - VOXEL_SIZE, z, 'steel', group);
      this.add(x, y - VOXEL_SIZE * 2, z, 'steel', group);
      y -= VOXEL_SIZE * 2;
    }
    return y;
  }

  /** Lanterna 3×3 de vidro/lata pendurada no fim de uma corrente. */
  lantern(x: number, z: number, yTop: number, id: string, links = 3): void {
    const yEnd = this.chain(x, z, yTop, links, id);
    const g = `hang:${id}`;
    const h = VOXEL_SIZE;
    // topo de lata
    this.box(x - h, yEnd - h * 2, z - h, x + h, yEnd - h, z + h, 'steel', g);
    // corpo de vidro com o miolo aceso
    this.box(x - h, yEnd - h * 5, z - h, x + h, yEnd - h * 2, z + h, 'glass', g);
    this.set(x, yEnd - h * 4, z, 'lantern', g);
    this.set(x, yEnd - h * 3, z, 'lantern', g);
    // base
    this.box(x - h, yEnd - h * 6, z - h, x + h, yEnd - h * 5, z + h, 'steel', g);
  }
}
