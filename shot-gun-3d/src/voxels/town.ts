import { VoxelGrid, NEIGHBORS } from './grid.ts';
import type { Voxel } from './types.ts';
import { Builder } from './builder.ts';
import {
  buildSaloon, buildGazebo, buildOuthouse, buildWell, buildYardProps, buildCactus, buildRock,
  DECK_TOP, PLAZA_TOP,
} from './structures/core.ts';
import { buildWaterTower, buildChapel, buildWindmill, buildBank } from './structures/landmarks.ts';
import {
  buildStable, buildStore, buildJail, buildWatchtower, buildRailsAndWagon, buildFence,
} from './structures/props.ts';
import { buildSign, buildClothesline, buildTumbleweed, buildFenceArc, buildTarget } from './structures/extras.ts';

export { DECK_TOP, PLAZA_TOP };

/** Raio do chão de areia (metros). */
export const GROUND_RADIUS = 28;
/** Raio da cerca invisível que segura o jogador. */
export const PLAY_RADIUS = 24;

/** Centro do coreto em metros — cena e física usam o mesmo ponto. */
export const GAZEBO = { x: -5.16, z: 1.2, radius: 1.85 };

export interface StructureDef {
  id: string;
  name: string;
  x: number;
  z: number;
  y?: number;
  rot?: number;
  /** Conta para a integridade da vila? Cactos e pedras não. */
  scored: boolean;
  build: (b: Builder) => void;
}

export const TOWN: readonly StructureDef[] = [
  { id: 'saloon', name: 'Saloon', x: 0, z: 0, scored: true, build: buildSaloon },
  { id: 'gazebo', name: 'Coreto', x: GAZEBO.x, z: GAZEBO.z, scored: true, build: (b) => buildGazebo(b, GAZEBO.radius) },
  { id: 'outhouse', name: 'Casinha', x: 3.6, z: 2.4, rot: 2, scored: true, build: buildOuthouse },
  { id: 'well', name: 'Poço', x: -2.7, z: 3.0, scored: true, build: buildWell },
  { id: 'yard', name: 'Quintal', x: 2.1, z: 3.9, scored: true, build: buildYardProps },
  { id: 'water', name: "Caixa d'água", x: 6.0, z: -4.2, scored: true, build: buildWaterTower },
  { id: 'chapel', name: 'Capela', x: 0, z: -8.4, scored: true, build: buildChapel },
  { id: 'windmill', name: 'Moinho', x: -7.2, z: -5.4, rot: 1, scored: true, build: buildWindmill },
  { id: 'bank', name: 'Banco', x: 8.4, z: 1.2, rot: 1, scored: true, build: buildBank },
  { id: 'stable', name: 'Estábulo', x: -8.4, z: 5.4, rot: 3, scored: true, build: buildStable },
  { id: 'store', name: 'Loja', x: 6.6, z: 7.2, rot: 2, scored: true, build: buildStore },
  { id: 'jail', name: 'Cadeia', x: -4.2, z: 8.4, rot: 2, scored: true, build: buildJail },
  { id: 'tower', name: 'Torre de vigia', x: 11.4, z: -3.0, scored: true, build: buildWatchtower },
  { id: 'rails', name: 'Vagão', x: 6.0, z: -9.0, scored: true, build: (b) => buildRailsAndWagon(b, 7.2) },
  { id: 'fence-n', name: 'Cerca', x: -4.8, z: -11.4, scored: false, build: (b) => buildFence(b, 6.0) },
  { id: 'fence-w', name: 'Cerca', x: -12.0, z: 0.6, rot: 1, scored: false, build: (b) => buildFence(b, 7.2) },
  { id: 'fence-e', name: 'Cerca', x: 12.6, z: 4.2, rot: 1, scored: false, build: (b) => buildFence(b, 6.0) },
  { id: 'cactus-0', name: 'Cacto', x: -3.6, z: -3.6, scored: false, build: (b) => buildCactus(b, 1.4) },
  { id: 'cactus-1', name: 'Cacto', x: 9.6, z: 5.4, rot: 1, scored: false, build: (b) => buildCactus(b, 1.7) },
  { id: 'cactus-2', name: 'Cacto', x: -10.8, z: -1.8, rot: 2, scored: false, build: (b) => buildCactus(b, 1.1) },
  { id: 'rock-0', name: 'Pedra', x: -3.0, z: -5.4, scored: false, build: (b) => buildRock(b, 0.42) },
  { id: 'rock-1', name: 'Pedra', x: 4.2, z: -1.2, scored: false, build: (b) => buildRock(b, 0.3) },
  { id: 'rock-2', name: 'Pedra', x: -9.0, z: 9.6, scored: false, build: (b) => buildRock(b, 0.54) },
  { id: 'sign', name: 'Placa', x: -2.4, z: 5.4, rot: 2, scored: false, build: (b) => buildSign(b, 'DUSTY GULCH') },
  { id: 'clothes', name: 'Varal', x: -5.4, z: 7.8, rot: 1, scored: false, build: (b) => buildClothesline(b, 3.0) },
  { id: 'tumble-0', name: 'Tumbleweed', x: 4.2, z: 10.2, scored: false, build: (b) => buildTumbleweed(b, 0.3, '0') },
  { id: 'tumble-1', name: 'Tumbleweed', x: -12.6, z: 3.6, scored: false, build: (b) => buildTumbleweed(b, 0.36, '1') },
  { id: 'tumble-2', name: 'Tumbleweed', x: 10.8, z: -8.4, scored: false, build: (b) => buildTumbleweed(b, 0.28, '2') },
  { id: 'fence-arc-s', name: 'Cerca', x: 0, z: 0, scored: false, build: (b) => buildFenceArc(b, 21, Math.PI * 0.35, Math.PI * 0.65) },
  { id: 'fence-arc-n', name: 'Cerca', x: 0, z: 0, scored: false, build: (b) => buildFenceArc(b, 21, Math.PI * 1.3, Math.PI * 1.7) },
  { id: 'fence-arc-e', name: 'Cerca', x: 0, z: 0, scored: false, build: (b) => buildFenceArc(b, 21, -Math.PI * 0.12, Math.PI * 0.12) },
  // Galeria de tiro: alvos atrás da cerca norte e nas janelas.
  { id: 'target-0', name: 'Alvo', x: 3.0, z: -12.0, scored: false, build: (b) => buildTarget(b, '0') },
  { id: 'target-1', name: 'Alvo', x: -3.6, z: -12.6, scored: false, build: (b) => buildTarget(b, '1') },
  { id: 'target-2', name: 'Alvo', x: 12.6, z: 1.8, rot: 1, scored: false, build: (b) => buildTarget(b, '2') },
  { id: 'target-3', name: 'Alvo', x: -11.4, z: -3.0, rot: 3, scored: false, build: (b) => buildTarget(b, '3') },
  { id: 'target-4', name: 'Alvo', x: 8.4, z: 10.8, rot: 2, scored: false, build: (b) => buildTarget(b, '4') },
];

export function buildTown(): VoxelGrid {
  const grid = new VoxelGrid();
  TOWN.forEach((def, i) => {
    const b = new Builder(grid, i, def.x, def.z, def.y ?? 0, def.rot ?? 0);
    def.build(b);
  });
  hollow(grid);
  grid.generation = 0;
  return grid;
}

/**
 * Remove voxels totalmente cercados (6 vizinhos do mesmo grupo): nunca são
 * vistos nem atingidos primeiro, e cortam o custo de física e render.
 */
export function hollow(grid: VoxelGrid): number {
  const doomed: Voxel[] = [];
  for (const v of grid.values()) {
    let enclosed = true;
    for (const [dx, dy, dz] of NEIGHBORS) {
      const n = grid.get(v.ix + dx, v.iy + dy, v.iz + dz);
      if (!n || n.group !== v.group) { enclosed = false; break; }
    }
    if (enclosed) doomed.push(v);
  }
  for (const v of doomed) grid.remove(v);
  return doomed.length;
}
