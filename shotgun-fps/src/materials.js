import * as THREE from 'three';

// Materiais compartilhados (flat shading, low-poly). Criados uma vez e reutilizados
// por prédios, props, alvos e bandidos para manter poucos materiais únicos.
function std(color, roughness = 0.85, metalness = 0.05, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true, ...extra });
}

export const MAT = {
  ground: std(0xc89b6b, 0.95, 0),
  woodLight: std(0x9f7a55, 0.85),
  woodDark: std(0x6e4e32, 0.9),
  woodRed: std(0x8a4a2c, 0.85),
  woodPale: std(0xc4a276, 0.85),
  adobe: std(0xb58c67, 0.95, 0),
  cactus: std(0x4a6b3e, 0.7),
  cactusFlower: std(0xe86aa0, 0.6),
  rock: std(0x826d5b, 0.9, 0),
  iron: std(0x3a3a3f, 0.5, 0.7),
  ironRust: std(0x6b4a33, 0.7, 0.4),
  glassDark: new THREE.MeshStandardMaterial({ color: 0x22303a, roughness: 0.2, metalness: 0.3, flatShading: true }),
  bottleGreen: new THREE.MeshStandardMaterial({ color: 0x3f8a4e, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true }),
  bottleBrown: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true }),
  can: std(0xb9b9b9, 0.35, 0.8),
  canLabel: std(0xc0392b, 0.6, 0.2),
  hay: std(0xd9b95a, 1.0, 0),
  canvas: std(0xd8cfb4, 0.95, 0),
  leather: std(0x5a3a22, 0.8),
  ammoBox: std(0x3c6b2f, 0.7, 0.1),
  ammoBrass: std(0xd9a441, 0.4, 0.7),
  gold: std(0xe0b04a, 0.35, 0.8, { emissive: 0x4a3000 }),
  signGold: std(0xf1c66b, 0.45, 0.6),
  white: std(0xf1ede4, 0.9, 0),
};
