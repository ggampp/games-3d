/**
 * CubeGeometry.js
 * Gerenciador de geometrias 3D, texturas, materiais e esquemas de cores
 */

import * as THREE from 'three';

export const THEMES = {
  classic: {
    name: 'Clássico Competição (WCA)',
    core: 0x1e293b,
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 0.6,
    colors: {
      U: 0xffffff, // Branco Puro
      R: 0xdc2626, // Vermelho Competição
      F: 0x16a34a, // Verde Esmeralda
      D: 0xfacc15, // Amarelo Canário
      L: 0xea580c, // Laranja Vibrante
      B: 0x2563eb  // Azul Royal
    }
  },
  cyberpunk: {
    name: 'Cyberpunk Neon Glow',
    core: 0x0f172a,
    roughness: 0.15,
    metalness: 0.15,
    clearcoat: 0.8,
    colors: {
      U: 0xffffff, // Branco Neon
      R: 0xff1744, // Neon Red / Pink
      F: 0x00e676, // Neon Spring Green
      D: 0xffea00, // Neon Electric Yellow
      L: 0xff6d00, // Neon Intense Orange
      B: 0x2979ff  // Neon Vivid Blue
    }
  },
  carbon: {
    name: 'Carbon Fiber Pro',
    core: 0x111827,
    roughness: 0.25,
    metalness: 0.1,
    clearcoat: 0.4,
    colors: {
      U: 0xf8fafc, // Pure Titanium
      R: 0xef4444, // Crimson Red
      F: 0x22c55e, // Emerald Green
      D: 0xf59e0b, // Amber Gold
      L: 0xf97316, // Bright Orange
      B: 0x3b82f6  // Bright Blue
    }
  },
  pastel: {
    name: 'Pastel Moderno Minimalista',
    core: 0x334155,
    roughness: 0.25,
    metalness: 0.02,
    clearcoat: 0.35,
    colors: {
      U: 0xfffbeb, // Pastel Cream / White
      R: 0xf87171, // Pastel Coral Red
      F: 0x4ade80, // Pastel Mint Green
      D: 0xfde047, // Pastel Lemon Yellow
      L: 0xfb923c, // Pastel Peach Orange
      B: 0x60a5fa  // Pastel Sky Blue
    }
  }
};

/**
 * Cria a geometria perfeitamente cúbica e simétrica com cantos arredondados
 */
export function createCubieGeometry(size = 0.96, radius = 0.06, smoothness = 4) {
  const shape = new THREE.Shape();
  // Com bevelSize = radius (0.06), a forma interna mede (size/2 - radius) = 0.42
  // Somando o chanfro de 0.06, atinge exatamente [-0.48, +0.48] em todos os eixos X, Y e Z!
  const innerHalf = size / 2 - radius;
  const s = innerHalf;

  shape.moveTo(-s, -s);
  shape.lineTo(s, -s);
  shape.lineTo(s, s);
  shape.lineTo(-s, s);
  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: size - radius * 2, // 0.84
    bevelEnabled: true,
    bevelSegments: smoothness,
    bevelSize: radius, // 0.06
    bevelThickness: radius // 0.06
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();
  return geom;
}

/**
 * Gera os materiais para os cubies com base no tema e estilo
 */
export function createCubieMaterials(themeKey = 'classic', style = 'stickerless') {
  const theme = THEMES[themeKey] || THEMES.classic;

  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: style === 'stickered' ? 0x0f172a : (theme.core || 0x1e293b),
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1
  });

  const faceMaterials = {};
  for (const [face, hex] of Object.entries(theme.colors)) {
    if (style === 'frosted') {
      faceMaterials[face] = new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.65,
        transparent: true,
        opacity: 0.92,
        ior: 1.5,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
    } else {
      faceMaterials[face] = new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.15,
        metalness: 0.02,
        clearcoat: 0.7,
        clearcoatRoughness: 0.06,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
    }
  }

  return { coreMaterial, faceMaterials };
}

/**
 * Cria a geometria de adesivo com cantos arredondados para acabamento premium
 */
export function createStickerGeometry(size = 0.82, radius = 0.06) {
  const shape = new THREE.Shape();
  const s = size / 2;
  const r = radius;

  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(s, s - r);
  shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-s + r, s);
  shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-s, -s + r);
  shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false);

  const geom = new THREE.ShapeGeometry(shape, 16);
  return geom;
}
