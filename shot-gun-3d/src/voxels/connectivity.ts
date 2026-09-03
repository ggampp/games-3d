import type { Voxel } from './types.ts';
import { VoxelGrid, NEIGHBORS } from './grid.ts';

/** Só `structure` se liga por contato 6-conectado; o resto vive em juntas. */
export function sameSolid(a: Voxel, b: Voxel): boolean {
  if (a.group === b.group) return true;
  return a.group === 'structure' && b.group === 'structure';
}

/** Flood fill a partir de um voxel, restrito a `allow` (se dado). */
export function componentFrom(
  grid: VoxelGrid,
  start: Voxel,
  seen: Set<number>,
  allow?: (v: Voxel) => boolean,
): Voxel[] {
  const stack: Voxel[] = [start];
  const comp: Voxel[] = [];
  seen.add(start.id);
  while (stack.length > 0) {
    const cur = stack.pop()!;
    comp.push(cur);
    for (const [dx, dy, dz] of NEIGHBORS) {
      const n = grid.get(cur.ix + dx, cur.iy + dy, cur.iz + dz);
      if (!n || seen.has(n.id) || !sameSolid(cur, n)) continue;
      if (allow && !allow(n)) continue;
      seen.add(n.id);
      stack.push(n);
    }
  }
  return comp;
}

export function connectedComponents(grid: VoxelGrid, subset?: Iterable<Voxel>): Voxel[][] {
  const seen = new Set<number>();
  const result: Voxel[][] = [];
  for (const start of subset ?? grid.values()) {
    if (seen.has(start.id)) continue;
    result.push(componentFrom(grid, start, seen));
  }
  return result;
}

/**
 * Um componente de estrutura apoia-se no chão se algum voxel tem base em
 * `iy <= groundIndex`. O `groundIndex` é a camada mais alta que toca deck/chão
 * (derivada de metros pelo chamador, para não depender do tamanho do voxel).
 */
export function isSupported(comp: Voxel[], groundIndex: number): boolean {
  if (comp.length === 0) return false;
  if (comp[0].group !== 'structure') return false;
  for (const v of comp) {
    if (v.iy <= groundIndex) return true;
  }
  return false;
}

/**
 * Aplica dano em esfera. Só visita a caixa de índices que cobre o raio.
 * Voxels cujo corpo se mexeu (`poseOf`) são medidos na pose visual.
 */
export function damageAt(
  grid: VoxelGrid,
  wx: number,
  wy: number,
  wz: number,
  radius: number,
  damage: number,
  voxelSize: number,
  direct?: Voxel,
  extra?: Iterable<Voxel>,
  poseOf?: (v: Voxel) => { x: number; y: number; z: number } | null,
): Voxel[] {
  const destroyed: Voxel[] = [];
  const r2 = radius * radius;
  const hurt = (v: Voxel, cx: number, cy: number, cz: number) => {
    const dx = cx - wx;
    const dy = cy - wy;
    const dz = cz - wz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const isDirect = direct !== undefined && v.id === direct.id;
    if (!isDirect && d2 > r2) return;
    if (isDirect) {
      v.hp -= damage;
    } else {
      const t = 1 - Math.sqrt(d2) / Math.max(radius, 1e-6);
      v.hp -= damage * (0.4 + 0.6 * t);
    }
    if (v.hp <= 0) destroyed.push(v);
  };

  const seen = new Set<number>();
  const n = Math.ceil(radius / voxelSize) + 1;
  const cx0 = Math.round(wx / voxelSize);
  const cy0 = Math.floor(wy / voxelSize);
  const cz0 = Math.round(wz / voxelSize);
  for (let iy = cy0 - n; iy <= cy0 + n; iy++) {
    for (let iz = cz0 - n; iz <= cz0 + n; iz++) {
      for (let ix = cx0 - n; ix <= cx0 + n; ix++) {
        const v = grid.get(ix, iy, iz);
        if (!v) continue;
        seen.add(v.id);
        const p = poseOf?.(v);
        if (p) hurt(v, p.x, p.y, p.z);
        else hurt(v, ix * voxelSize, iy * voxelSize + voxelSize * 0.5, iz * voxelSize);
      }
    }
  }
  // Voxels de corpos dinâmicos (fora da posição de grade).
  if (extra) {
    for (const v of extra) {
      if (seen.has(v.id)) continue;
      const p = poseOf?.(v);
      if (!p) continue;
      hurt(v, p.x, p.y, p.z);
    }
  }
  if (direct && !seen.has(direct.id) && !destroyed.includes(direct)) {
    hurt(direct, wx, wy, wz);
  }
  return destroyed;
}

export interface RayHit {
  voxel: Voxel;
  dist: number;
  point: { x: number; y: number; z: number };
}

/** Ray vs esfera na pose visual — só para voxels de corpos que se mexem. */
export function voxelRaycastWorld(
  voxels: Iterable<Voxel>,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxDist: number,
  voxelSize: number,
  poseOf: (v: Voxel) => { x: number; y: number; z: number } | null,
): RayHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len < 1e-8) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;
  const radius = voxelSize * 0.62;
  const r2 = radius * radius;
  let best: Voxel | null = null;
  let bestT = maxDist;
  for (const v of voxels) {
    const p = poseOf(v) ?? { x: v.ix * voxelSize, y: v.iy * voxelSize + voxelSize * 0.5, z: v.iz * voxelSize };
    const ox = origin.x - p.x;
    const oy = origin.y - p.y;
    const oz = origin.z - p.z;
    const b = ox * dx + oy * dy + oz * dz;
    const c = ox * ox + oy * oy + oz * oz - r2;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    const hitT = t >= 0 ? t : -b + Math.sqrt(disc);
    if (hitT < 0 || hitT > bestT) continue;
    bestT = hitT;
    best = v;
  }
  if (!best) return null;
  return {
    voxel: best,
    dist: bestT,
    point: { x: origin.x + dx * bestT, y: origin.y + dy * bestT, z: origin.z + dz * bestT },
  };
}

/** DDA em grade de voxels. Origem e direção em metros. `accept` filtra (ex.: só estáticos). */
export function voxelRaycast(
  grid: VoxelGrid,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxDist: number,
  voxelSize: number,
  accept?: (v: Voxel) => boolean,
): RayHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (len < 1e-8) return null;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;

  const x = origin.x;
  const y = origin.y;
  const z = origin.z;
  let ix = Math.round(x / voxelSize);
  let iy = Math.floor(y / voxelSize);
  let iz = Math.round(z / voxelSize);

  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;
  const stepZ = dz >= 0 ? 1 : -1;

  const tDeltaX = dx === 0 ? Infinity : Math.abs(voxelSize / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(voxelSize / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(voxelSize / dz);

  const nextBound = (i: number, step: number, size: number, isY: boolean): number => {
    if (isY) return step > 0 ? (i + 1) * size : i * size;
    const center = i * size;
    return step > 0 ? center + size * 0.5 : center - size * 0.5;
  };

  let tMaxX = dx === 0 ? Infinity : (nextBound(ix, stepX, voxelSize, false) - x) / dx;
  let tMaxY = dy === 0 ? Infinity : (nextBound(iy, stepY, voxelSize, true) - y) / dy;
  let tMaxZ = dz === 0 ? Infinity : (nextBound(iz, stepZ, voxelSize, false) - z) / dz;
  if (tMaxX < 0) tMaxX = 0;
  if (tMaxY < 0) tMaxY = 0;
  if (tMaxZ < 0) tMaxZ = 0;

  let t = 0;
  while (t <= maxDist) {
    const hit = grid.get(ix, iy, iz);
    if (hit && (!accept || accept(hit))) {
      return {
        voxel: hit,
        dist: t,
        point: { x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t },
      };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      ix += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      iy += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
    } else {
      iz += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}

/**
 * Funde voxels em cuboides (greedy): runs em X, depois em Z, depois em Y.
 * Devolve caixas em índices inclusivos. Usado para colliders de corpos fixos.
 */
export interface IndexBox {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
}

export function greedyBoxes(voxels: Voxel[]): IndexBox[] {
  const cells = new Set<number>();
  const key = (x: number, y: number, z: number) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  for (const v of voxels) cells.add(key(v.ix, v.iy, v.iz));
  const sorted = voxels.slice().sort((a, b) => a.iy - b.iy || a.iz - b.iz || a.ix - b.ix);
  const boxes: IndexBox[] = [];
  const used = new Set<number>();
  for (const v of sorted) {
    const k0 = key(v.ix, v.iy, v.iz);
    if (used.has(k0)) continue;
    // Estende em X.
    let x1 = v.ix;
    while (cells.has(key(x1 + 1, v.iy, v.iz)) && !used.has(key(x1 + 1, v.iy, v.iz))) x1++;
    // Estende em Z enquanto a linha inteira existe.
    let z1 = v.iz;
    outerZ: while (true) {
      for (let x = v.ix; x <= x1; x++) {
        const k = key(x, v.iy, z1 + 1);
        if (!cells.has(k) || used.has(k)) break outerZ;
      }
      z1++;
    }
    // Estende em Y enquanto o plano inteiro existe.
    let y1 = v.iy;
    outerY: while (true) {
      for (let z = v.iz; z <= z1; z++) {
        for (let x = v.ix; x <= x1; x++) {
          const k = key(x, y1 + 1, z);
          if (!cells.has(k) || used.has(k)) break outerY;
        }
      }
      y1++;
    }
    for (let y = v.iy; y <= y1; y++) for (let z = v.iz; z <= z1; z++) for (let x = v.ix; x <= x1; x++) used.add(key(x, y, z));
    boxes.push({ x0: v.ix, y0: v.iy, z0: v.iz, x1, y1, z1 });
  }
  return boxes;
}
