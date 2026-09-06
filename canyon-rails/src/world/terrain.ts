import * as THREE from 'three';
import { WORLD_SIZE, WATER_LEVEL, heightAt, slopeAt, fbm, getTerrainProfile } from './heightfield.ts';
import type { TerrainPalette } from './maps.ts';

interface PaletteColors {
  sand: THREE.Color;
  sandLight: THREE.Color;
  rock: THREE.Color;
  rockRed: THREE.Color;
  rockDark: THREE.Color;
  bed: THREE.Color;
  water: string;
  sky: string;
}

const PALETTES: Record<TerrainPalette, PaletteColors> = {
  desert: {
    sand: new THREE.Color('#e8a66c'),
    sandLight: new THREE.Color('#f0b981'),
    rock: new THREE.Color('#d97e4a'),
    rockRed: new THREE.Color('#c05038'),
    rockDark: new THREE.Color('#a63c2e'),
    bed: new THREE.Color('#d89a63'),
    water: '#5fd3c8',
    sky: '#f2c48f',
  },
  snow: {
    sand: new THREE.Color('#eef3f7'),
    sandLight: new THREE.Color('#ffffff'),
    rock: new THREE.Color('#9fb0bd'),
    rockRed: new THREE.Color('#6f7f8e'),
    rockDark: new THREE.Color('#4c5a68'),
    bed: new THREE.Color('#b9cfd9'),
    water: '#8fd0e6',
    sky: '#d9e6ef',
  },
};

/** Paleta do mapa ativo (cores do terreno, da água e do céu/névoa). */
export function activePalette(): PaletteColors {
  return PALETTES[getTerrainProfile().palette ?? 'desert'];
}

/** Malha do terreno low-poly: geometria não indexada com cor por face. */
export function buildTerrain(): THREE.Mesh {
  const segments = 280;
  let geo: THREE.BufferGeometry = new THREE.PlaneGeometry(
    WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }

  geo = geo.toNonIndexed();
  const p = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    faceColor(cx, cy, cz, c);
    // Jitter sutil por face para o look facetado do vídeo.
    const j = (fbm(cx * 0.35 + 3, cz * 0.35 + 3) - 0.5) * 0.07;
    c.offsetHSL(0, 0, j);
    for (let v = 0; v < 3; v++) {
      colors[(f + v) * 3] = c.r;
      colors[(f + v) * 3 + 1] = c.g;
      colors[(f + v) * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function faceColor(x: number, y: number, z: number, out: THREE.Color): void {
  const pal = activePalette();
  const slope = slopeAt(x, z);
  if (y < WATER_LEVEL + 0.4) {
    out.copy(pal.bed);
    return;
  }
  if (slope > 0.75) {
    out.copy(pal.rockDark);
  } else if (slope > 0.45) {
    out.copy(pal.rockRed);
  } else if (slope > 0.24) {
    out.copy(pal.rock);
  } else {
    const t = fbm(x * 0.02 + 40, z * 0.02 + 40);
    out.copy(pal.sand).lerp(pal.sandLight, t);
  }
  // Estratos mais escuros perto do leito (paredes do canyon).
  if (y < 4 && slope > 0.3) out.lerp(pal.rockDark, 0.35);
}

/** Plano d'água turquesa — só aparece no vale cavado do rio. */
export function buildWater(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: activePalette().water,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_LEVEL;
  mesh.receiveShadow = true;
  return mesh;
}
