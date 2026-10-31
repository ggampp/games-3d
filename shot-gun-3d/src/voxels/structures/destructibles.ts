import { Builder } from '../builder.ts';
import { VOXEL_SIZE as V } from '../types.ts';

/**
 * Objetos soltos para destruir: todos usam grupos `loose:*`, então nascem
 * dinâmicos e rolam, tombam e voam com tiros e explosões.
 */

/** Prefixo dos barris de pólvora: o jogo detona o grupo quando um voxel dele quebra. */
export const TNT_PREFIX = 'loose:tnt-';

/** Barril de pólvora vermelho com aros de aço e "TNT" pintado. */
export function buildTntBarrel(b: Builder, id: string, x = 0, z = 0, y = 0): void {
  const g = `${TNT_PREFIX}${id}`;
  b.cylinder(x, z, 0.2, y, y + 0.56, 'tnt', g);
  b.cylinder(x, z, 0.21, y + 0.08, y + 0.08 + V, 'steel', g);
  b.cylinder(x, z, 0.21, y + 0.4, y + 0.4 + V, 'steel', g);
  // tampa com pavio
  b.add(x, y + 0.56, z, 'hay', g);
}

/** Pilha de barris de pólvora (dois embaixo, um em cima). */
export function buildTntStack(b: Builder, id: string): void {
  buildTntBarrel(b, `${id}a`, -0.24, 0);
  buildTntBarrel(b, `${id}b`, 0.24, 0);
  buildTntBarrel(b, `${id}c`, 0, 0, 0.56);
}

/** Caixote de madeira solto (s = lado em metros). */
function crate(b: Builder, g: string, x: number, y: number, z: number, s: number): void {
  const h = s / 2;
  b.box(x - h, y, z - h, x + h, y + s, z + h, 'plank', g);
  // ripas escuras nas bordas
  b.box(x - h, y, z - h, x + h, y + V, z + h, 'wood', g);
  b.box(x - h, y + s - V, z - h, x + h, y + s, z + h, 'wood', g);
}

/** Pirâmide de caixotes soltos: 3 + 2 + 1. */
export function buildCrateStack(b: Builder, id: string): void {
  const s = 0.4;
  let i = 0;
  for (let row = 0; row < 3; row++) {
    const n = 3 - row;
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * (s + 0.02);
      crate(b, `loose:crate-${id}-${i++}`, x, row * s, 0, s);
    }
  }
}

/** Trilho de cerca com garrafas de vidro em cima (galeria de tiro improvisada). */
export function buildBottleRail(b: Builder, id: string, length = 2.4): void {
  const half = length / 2;
  b.post(-half, 0, 0, 0.9, 0.12);
  b.post(half, 0, 0, 0.9, 0.12);
  b.post(0, 0, 0, 0.9, 0.12);
  b.box(-half, 0.9, -0.06, half, 0.98, 0.06, 'plank');
  let i = 0;
  for (let x = -half + 0.2; x <= half - 0.15; x += 0.26) {
    const g = `loose:bottle-${id}-${i}`;
    const tall = i % 3 === 0;
    b.box(x, 0.98, 0, x, tall ? 1.3 : 1.22, 0, 'glass', g);
    b.add(x, tall ? 1.3 : 1.22, 0, i % 2 === 0 ? 'wood' : 'steel', g);
    i += 1;
  }
}

/** Carroça de madeira solta com rodas, carregada de feno. */
export function buildCart(b: Builder, id: string): void {
  const g = `loose:cart-${id}`;
  // estrado e laterais
  b.box(-0.7, 0.36, -0.42, 0.7, 0.44, 0.42, 'plank', g);
  b.box(-0.7, 0.44, -0.42, 0.7, 0.68, -0.42, 'wood', g);
  b.box(-0.7, 0.44, 0.42, 0.7, 0.68, 0.42, 'wood', g);
  b.box(-0.7, 0.44, -0.42, -0.7, 0.68, 0.42, 'wood', g);
  // carga de feno
  b.box(-0.6, 0.44, -0.34, 0.5, 0.76, 0.34, 'hay', g);
  // rodas (discos de madeira com aro de aço) e eixo
  for (const z of [-0.5, 0.5]) {
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      b.add(0.1 + Math.cos(t) * 0.28, 0.32 + Math.sin(t) * 0.28, z, 'steel', g);
    }
    b.box(0.02, 0.24, z, 0.18, 0.4, z, 'wood', g);
  }
  b.box(0.1, 0.28, -0.5, 0.1, 0.36, 0.5, 'wood', g);
  // lança
  b.box(-1.4, 0.36, 0, -0.7, 0.42, 0, 'wood', g);
}

/** Bebedouro de cavalos: estrutura fixa de tábuas, dois cavaletes. */
export function buildTrough(b: Builder): void {
  b.box(-0.8, 0.12, -0.24, 0.8, 0.48, 0.24, 'plank');
  b.carve(-0.72, 0.24, -0.16, 0.72, 0.48, 0.16);
  b.box(-0.72, 0.24, -0.16, 0.72, 0.36, 0.16, 'glass');
  for (const x of [-0.6, 0.6]) b.box(x - 0.06, 0, -0.24, x + 0.06, 0.12, 0.24, 'wood');
}

/** Poste de amarrar cavalos: dois postes e uma barra. */
export function buildHitchingPost(b: Builder, length = 1.6): void {
  const half = length / 2;
  b.post(-half, 0, 0, 1.0, 0.12);
  b.post(half, 0, 0, 1.0, 0.12);
  b.box(-half, 0.9, 0, half, 0.98, 0, 'wood');
}

/** Barril de água solto (madeira com aros). */
export function buildWaterBarrel(b: Builder, id: string, x = 0, z = 0): void {
  const g = `loose:barrel-${id}`;
  b.cylinder(x, z, 0.22, 0, 0.62, 'wood', g);
  b.cylinder(x, z, 0.23, 0.1, 0.1 + V, 'steel', g);
  b.cylinder(x, z, 0.23, 0.46, 0.46 + V, 'steel', g);
}

/** Árvore seca: tronco e galhos tortos de madeira (estrutura fixa, queima). */
export function buildDeadTree(b: Builder, h: number): void {
  b.box(-0.08, 0, -0.08, 0.08, h, 0.08, 'wood');
  b.box(0.08, h * 0.55, 0, 0.5, h * 0.55 + V, 0, 'wood');
  b.box(0.5, h * 0.55, 0, 0.5, h * 0.8, 0, 'wood');
  b.box(-0.45, h * 0.7, 0, -0.08, h * 0.7 + V, 0, 'wood');
  b.box(-0.45, h * 0.7, 0, -0.45, h * 0.92, 0, 'wood');
  b.box(0, h, 0, 0, h + 0.25, 0.3, 'wood');
}
