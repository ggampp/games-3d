import { VoxelGrid, NEIGHBORS } from './grid.ts';
import type { Voxel } from './types.ts';
import { Builder } from './builder.ts';
import {
  buildGazebo, buildWell, buildCactus, buildRock,
  DECK_TOP, PLAZA_TOP,
} from './structures/core.ts';
import { buildWaterTower, buildChapel, buildWindmill, buildBank } from './structures/landmarks.ts';
import {
  buildStable, buildStore, buildJail, buildRailsAndWagon, buildFence,
} from './structures/props.ts';
import { buildSign, buildTarget } from './structures/extras.ts';
import { buildPuebloHotel, buildPuebloOutpost } from './structures/pueblo.ts';
import { buildMainStreetSaloon } from './structures/saloon-facade.ts';

export { DECK_TOP, PLAZA_TOP };

/** Raio do chão de areia (metros). */
export const GROUND_RADIUS = 28;
/** Raio da cerca invisível que segura o jogador. */
export const PLAY_RADIUS = 24;

/** Centro do coreto em metros. */
export const GAZEBO = { x: -11.0, z: 3.6, radius: 1.85 };

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

/**
 * Nova planta da vila em formato Main Street (inspirada na imagem de referência):
 * - Centro / Fundo da rua (Z = -9.6): O icônico Saloon de 2 andares com sacada dupla e letreiro;
 * - Lado Esquerdo (Oeste, X < 0): Prédios pueblo/adobe escalonados com vigas de teto aparentes salientes e deques;
 * - Lado Direito (Leste, X > 0): Armazém de madeira, Torre d'Água sobre cavaletes altos e Banco;
 * - Ponto de Spawn do jogador: X = 0, Z = 6.2, olhando diretamente para o norte ao longo da Main Street.
 */
export const TOWN: readonly StructureDef[] = [
  // 1. PONTO FOCAL AO FUNDO DA RUA (SALOON DE 2 ANDARES COM SACADA DUPLA)
  { id: 'saloon', name: 'Saloon', x: 0, z: -9.6, rot: 2, scored: true, build: buildMainStreetSaloon },

  // 2. LADO ESQUERDO (CONJUNTO PUEBLO / ADOBE COM VIGAS APARENTES E DEQUES ELEVADOS)
  { id: 'pueblo-hotel', name: 'Hotel Pueblo', x: -5.6, z: 1.6, rot: 1, scored: true, build: buildPuebloHotel },
  { id: 'pueblo-outpost', name: 'Cantina Pueblo', x: -5.4, z: -4.4, rot: 1, scored: true, build: buildPuebloOutpost },
  { id: 'chapel', name: 'Capela', x: -9.0, z: -8.8, rot: 1, scored: true, build: buildChapel },
  { id: 'windmill', name: 'Moinho', x: -11.4, z: -2.4, rot: 1, scored: true, build: buildWindmill },
  { id: 'gazebo', name: 'Coreto', x: GAZEBO.x, z: GAZEBO.z, scored: true, build: (b) => buildGazebo(b, GAZEBO.radius) },
  { id: 'stable', name: 'Estábulo', x: -7.2, z: 7.2, rot: 2, scored: true, build: buildStable },

  // 3. LADO DIREITO (CIDADE DE MADEIRA, TORRE D'ÁGUA EM CAVALETES E COMÉRCIO)
  { id: 'water', name: "Caixa d'água", x: 4.8, z: -4.2, scored: true, build: buildWaterTower },
  { id: 'store', name: 'Armazém', x: 6.8, z: 1.8, rot: 3, scored: true, build: buildStore },
  { id: 'bank', name: 'Banco', x: 6.8, z: -8.2, rot: 3, scored: true, build: buildBank },
  { id: 'jail', name: 'Cadeia', x: 6.8, z: 7.2, rot: 3, scored: true, build: buildJail },

  // 4. PROPS URBANOS, TRILHOS E AMBIÊNCIA
  { id: 'well', name: 'Poço', x: -3.8, z: 4.8, scored: true, build: buildWell },
  { id: 'rails', name: 'Vagão', x: 7.2, z: -12.0, scored: true, build: (b) => buildRailsAndWagon(b, 7.2) },

  // Cercas perimetrais
  { id: 'fence-w', name: 'Cerca', x: -13.2, z: 0.6, rot: 1, scored: false, build: (b) => buildFence(b, 7.2) },
  { id: 'fence-e', name: 'Cerca', x: 13.2, z: 2.4, rot: 1, scored: false, build: (b) => buildFence(b, 6.0) },

  // Cactos, rochas e placa
  { id: 'cactus-0', name: 'Cacto', x: -3.6, z: -8.4, scored: false, build: (b) => buildCactus(b, 1.4) },
  { id: 'cactus-1', name: 'Cacto', x: 10.8, z: 6.4, rot: 1, scored: false, build: (b) => buildCactus(b, 1.7) },
  { id: 'rock-0', name: 'Pedra', x: -3.2, z: -6.4, scored: false, build: (b) => buildRock(b, 0.42) },
  { id: 'rock-1', name: 'Pedra', x: 3.4, z: 5.4, scored: false, build: (b) => buildRock(b, 0.3) },
  { id: 'sign', name: 'Placa', x: 2.8, z: 6.4, rot: 0, scored: false, build: (b) => buildSign(b, 'DUSTY GULCH') },
  { id: 'target-0', name: 'Alvo', x: 3.0, z: -13.0, scored: false, build: (b) => buildTarget(b, '0') },
  { id: 'target-1', name: 'Alvo', x: -3.6, z: -13.6, scored: false, build: (b) => buildTarget(b, '1') },
  { id: 'target-2', name: 'Alvo', x: 12.6, z: 1.8, rot: 1, scored: false, build: (b) => buildTarget(b, '2') },
  { id: 'target-3', name: 'Alvo', x: -11.4, z: -3.0, rot: 3, scored: false, build: (b) => buildTarget(b, '3') },
  { id: 'target-4', name: 'Alvo', x: 9.4, z: 9.6, rot: 2, scored: false, build: (b) => buildTarget(b, '4') },
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
