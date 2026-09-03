/** Tamanho do voxel em metros. Plantas são escritas em metros; só aqui muda. */
export const VOXEL_SIZE = 0.08;

/** Tamanho de referência para o balanceamento de hp (o jogo nasceu em 0,12 m). */
const HP_REF_SIZE = 0.12;
const HP_SCALE = VOXEL_SIZE / HP_REF_SIZE;

export const MAT_IDS = [
  'wood', 'plank', 'adobe', 'steel', 'hinge', 'lantern', 'cactus', 'rock',
  'glass', 'brick', 'hay', 'bronze', 'gold',
] as const;

export type MatId = (typeof MAT_IDS)[number];

export interface MaterialDef {
  hp: number;
  density: number;
  color: number;
  roughness: number;
  metalness: number;
  emissive: number;
  emissiveIntensity: number;
  /** Som ao quebrar. */
  sound: 'wood' | 'stone' | 'metal' | 'glass' | 'hay' | 'bell' | 'coin';
  /** Pontos por voxel destruído. */
  points: number;
  transparent?: boolean;
  /** Quanto a cor cede para a textura (0 = só cor, 1 = só textura). */
  texTint?: number;
  /** Pega fogo? Tempo médio (s) até virar cinza; 0 = não queima. */
  burn: number;
}

function m(
  hp: number, density: number, color: number, roughness: number, metalness: number,
  sound: MaterialDef['sound'], points = 1, emissive = 0x000000, emissiveIntensity = 0,
  transparent = false, texTint = 0.6, burn = 0,
): MaterialDef {
  return { hp: hp * HP_SCALE, density, color, roughness, metalness, emissive, emissiveIntensity, sound, points, transparent, texTint, burn };
}

export const MATERIALS: Record<MatId, MaterialDef> = {
  wood:    m(7,  0.7, 0x7a4a26, 0.88, 0.02, 'wood', 1, 0, 0, false, 0.35, 9),
  plank:   m(5,  0.6, 0xc48a52, 0.82, 0.02, 'wood', 1, 0, 0, false, 0.55, 7),
  adobe:   m(10, 1.7, 0xe2c9a3, 0.94, 0.00, 'stone', 1, 0, 0, false, 0.75),
  steel:   m(26, 3.8, 0x5c6470, 0.38, 0.82, 'metal', 1, 0, 0, false, 0.55),
  hinge:   m(20, 3.6, 0x2f333a, 0.42, 0.88, 'metal', 1, 0, 0, false, 0.3),
  lantern: m(4,  0.9, 0xffc14a, 0.28, 0.15, 'glass', 3, 0xff9a2a, 2.4),
  cactus:  m(8,  0.8, 0x3f8a4a, 0.9,  0.00, 'hay', 1, 0, 0, false, 0.15, 6),
  rock:    m(18, 2.2, 0x8f8478, 0.96, 0.04, 'stone', 1, 0, 0, false, 0.45),
  glass:   m(2,  0.5, 0xbfe6f2, 0.12, 0.05, 'glass', 2, 0x000000, 0, true),
  brick:   m(12, 1.9, 0xb4573c, 0.9,  0.02, 'stone', 1, 0, 0, false, 0.7),
  hay:     m(3,  0.3, 0xd9b55a, 0.95, 0.00, 'hay', 1, 0, 0, false, 0.7, 3),
  bronze:  m(22, 3.0, 0xb07a3c, 0.35, 0.75, 'bell', 2),
  gold:    m(14, 4.0, 0xffd24a, 0.25, 0.9,  'coin', 5, 0xffb300, 0.6),
};

/**
 * Grupo do voxel. `structure` liga por contato 6-conectado; os demais são
 * corpos próprios identificados por prefixo:
 *  - `door:<id>`    dinâmico, junta revolute vertical no voxel `hinge`.
 *  - `chain:<id>`   cada voxel é um elo com junta esférica; pendurado no `structure` acima.
 *  - `hang:<id>`    corpo pendurado no fim da corrente `chain:<id>` (lanterna, sino, letreiro).
 *  - `spin:<id>`    dinâmico, revolute horizontal com motor no voxel de eixo (`steel`).
 *  - `loose:<id>`   dinâmico desde o início, sem junta (fardo, barril, vagão).
 *  - `target:<id>`  alvo de galeria: corpo cinemático que sobe e desce.
 */
export type VoxelGroup = string;

export type GroupKind = 'structure' | 'door' | 'chain' | 'hang' | 'spin' | 'loose' | 'target';

export function groupKind(group: VoxelGroup): GroupKind {
  if (group === 'structure') return 'structure';
  const i = group.indexOf(':');
  return (i > 0 ? group.slice(0, i) : group) as GroupKind;
}

export function groupId(group: VoxelGroup): string {
  const i = group.indexOf(':');
  return i > 0 ? group.slice(i + 1) : '';
}

export interface Voxel {
  id: number;
  ix: number;
  iy: number;
  iz: number;
  mat: MatId;
  hp: number;
  group: VoxelGroup;
  /** Índice da estrutura na planta (para integridade por prédio). -1 = solto. */
  s: number;
}

/** Chave inteira: 11 bits por eixo com offset. Cobre ±1024 índices (±61 m). */
const OFF = 1024;
const SPAN = 2048;
export function voxelKey(ix: number, iy: number, iz: number): number {
  return ((ix + OFF) * SPAN + (iy + OFF)) * SPAN + (iz + OFF);
}

export function worldCenter(ix: number, iy: number, iz: number): { x: number; y: number; z: number } {
  return {
    x: ix * VOXEL_SIZE,
    y: iy * VOXEL_SIZE + VOXEL_SIZE * 0.5,
    z: iz * VOXEL_SIZE,
  };
}

/** Metros → índice de coluna (x/z, centrado). */
export function toIx(meters: number): number {
  return Math.round(meters / VOXEL_SIZE);
}

/** Metros → índice de camada (y, base do voxel). */
export function toIy(meters: number): number {
  return Math.round(meters / VOXEL_SIZE);
}
