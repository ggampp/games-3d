import * as THREE from 'three';
import { HEX_SIZE } from '../game/hex';
import { glow, std } from './materials';

type Extra = {
  specks?: string;
  seed?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
};

/**
 * Geometrias são compartilhadas por parâmetros: dezenas de tiles reaproveitam as mesmas caixas,
 * cones e cilindros, e remover um tile da cena não precisa de dispose.
 */
const GEO = new Map<string, THREE.BufferGeometry>();

function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const hit = GEO.get(key);
  if (hit) return hit as T;
  const geometry = make();
  GEO.set(key, geometry);
  return geometry;
}

export function hexCylinder(radius: number, height: number): THREE.CylinderGeometry {
  return cached(`hex:${radius}:${height}`, () => new THREE.CylinderGeometry(radius, radius, height, 6));
}

export function geometryCacheSize(): number {
  return GEO.size;
}

function mesh(
  geometry: THREE.BufferGeometry,
  color: string,
  x: number,
  y: number,
  z: number,
  extra?: Extra,
): THREE.Mesh {
  const item = new THREE.Mesh(
    geometry,
    std(color, {
      specks: extra?.specks,
      seed: extra?.seed,
      transparent: extra?.opacity !== undefined,
      opacity: extra?.opacity,
      roughness: extra?.roughness,
      metalness: extra?.metalness,
    }),
  );
  item.position.set(x, y, z);
  if (extra?.rx) item.rotation.x = extra.rx;
  if (extra?.ry) item.rotation.y = extra.ry;
  if (extra?.rz) item.rotation.z = extra.rz;
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function box(
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
  extra?: Extra,
): THREE.Mesh {
  return mesh(cached(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), color, x, y, z, extra);
}

function cone(r: number, h: number, color: string, x: number, y: number, z: number, segs = 8): THREE.Mesh {
  return mesh(cached(`cone:${r}:${h}:${segs}`, () => new THREE.ConeGeometry(r, h, segs)), color, x, y, z);
}

function sphere(r: number, color: string, x: number, y: number, z: number, extra?: Extra): THREE.Mesh {
  return mesh(cached(`sph:${r}`, () => new THREE.SphereGeometry(r, 12, 10)), color, x, y, z, extra);
}

function cyl(
  r: number,
  h: number,
  color: string,
  x: number,
  y: number,
  z: number,
  extra?: Extra,
  segs = 12,
): THREE.Mesh {
  return mesh(cached(`cyl:${r}:${h}:${segs}`, () => new THREE.CylinderGeometry(r, r, h, segs)), color, x, y, z, extra);
}

function taper(
  rTop: number,
  rBot: number,
  h: number,
  color: string,
  x: number,
  y: number,
  z: number,
  extra?: Extra,
): THREE.Mesh {
  return mesh(cached(`taper:${rTop}:${rBot}:${h}`, () => new THREE.CylinderGeometry(rTop, rBot, h, 12)), color, x, y, z, extra);
}

function attachSpin(root: THREE.Group, spinner: THREE.Object3D, axis: 'x' | 'y' | 'z', speed: number): void {
  spinner.userData.axis = axis;
  spinner.userData.speed = speed;
  const list = (root.userData.spinners as THREE.Object3D[]) ?? [];
  list.push(spinner);
  root.userData.spinners = list;
}

function addLamp(root: THREE.Group, lamp: THREE.Mesh): void {
  const list = (root.userData.lamps as THREE.Mesh[]) ?? [];
  list.push(lamp);
  root.userData.lamps = list;
}

function addBase(group: THREE.Group, side: string, top: string, height: number, seed: number): number {
  const rim = mesh(hexCylinder(HEX_SIZE, height), side, 0, height / 2, 0, { specks: '#1a120c', seed });
  const bevel = mesh(hexCylinder(HEX_SIZE * 0.97, 0.04), side, 0, height - 0.01, 0, { specks: '#000000', seed: seed + 1 });
  const cap = mesh(hexCylinder(HEX_SIZE * 0.9, 0.045), top, 0, height + 0.02, 0, { specks: '#ffffff', seed: seed + 3 });
  for (const part of [rim, bevel, cap]) part.userData.base = true;
  group.add(rim, bevel, cap);
  group.userData.baseTop = height + 0.04;
  return height + 0.04;
}

function addShadow(group: THREE.Group): void {
  const shadow = mesh(hexCylinder(HEX_SIZE * 0.98, 0.02), '#3a2a1c', 0, 0.01, 0, { opacity: 0.22 });
  shadow.userData.base = true;
  shadow.userData.shadow = true;
  group.add(shadow);
}

/** Tudo que não é base/sombra: o "prédio" procedural, que um GLB gerado pode substituir. */
export function buildingParts(group: THREE.Group): THREE.Object3D[] {
  return group.children.filter((child) => !child.userData.base);
}

function pitchedRoof(
  group: THREE.Group,
  w: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
): void {
  const pitch = 0.64;
  const slab = d * 0.64;
  const rise = (slab / 2) * Math.sin(pitch);
  const left = box(w, 0.05, slab, color, x, y, z - d * 0.18, { rx: -pitch, specks: '#5a2418', seed: 4 });
  const right = box(w, 0.05, slab, color, x, y, z + d * 0.18, { rx: pitch, specks: '#5a2418', seed: 5 });
  const ridge = box(w * 0.98, 0.028, 0.045, '#7a3224', x, y + rise, z);
  const eaveF = box(w * 1.02, 0.02, 0.04, '#8a3a28', x, y - rise, z + d * 0.34);
  const eaveB = box(w * 1.02, 0.02, 0.04, '#8a3a28', x, y - rise, z - d * 0.34);
  group.add(left, right, ridge, eaveF, eaveB);
}

function chimney(group: THREE.Group, x: number, y: number, z: number, color = '#8a5a48'): void {
  group.add(box(0.08, 0.2, 0.08, color, x, y, z, { specks: '#3a2018', seed: 6 }));
  group.add(box(0.1, 0.03, 0.1, '#6b4423', x, y + 0.11, z));
  group.add(sphere(0.035, '#c8c4be', x, y + 0.18, z, { opacity: 0.45, roughness: 0.95 }));
}

function windowPane(group: THREE.Group, x: number, y: number, z: number, w = 0.08, h = 0.07): void {
  group.add(box(w + 0.02, h + 0.02, 0.015, '#5a4030', x, y, z));
  group.add(box(w, h, 0.02, '#8fd4ea', x, y, z + 0.006, { roughness: 0.25, metalness: 0.12 }));
  group.add(box(0.012, h, 0.022, '#efe0c4', x, y, z + 0.01));
}

function cottage(
  group: THREE.Group,
  x: number,
  z: number,
  y: number,
  w: number,
  d: number,
  wallH: number,
  wall: string,
  roof: string,
  opts?: { chimney?: boolean; windows?: number },
): void {
  group.add(box(w, wallH, d, wall, x, y + wallH / 2, z, { specks: '#fff6e8', seed: 8 }));
  group.add(box(w * 0.92, 0.015, d * 0.92, '#d8c4a0', x, y + 0.01, z));
  pitchedRoof(group, w + 0.1, d + 0.1, roof, x, y + wallH + 0.015, z);
  group.add(box(0.09, 0.14, 0.025, '#4a3020', x, y + 0.1, z + d / 2 + 0.012));
  group.add(box(0.025, 0.025, 0.02, '#d4c46a', x + 0.025, y + 0.1, z + d / 2 + 0.022));
  const count = opts?.windows ?? 2;
  for (let i = 0; i < count; i += 1) {
    const wx = count === 1 ? x : x + (i === 0 ? -w * 0.22 : w * 0.22);
    windowPane(group, wx, y + wallH * 0.58, z + d / 2);
  }
  if (opts?.chimney !== false) chimney(group, x + w * 0.28, y + wallH + 0.22, z - d * 0.08);
}

function tree(group: THREE.Group, x: number, z: number, y: number, scale = 1, leaf = '#2f6b3a'): void {
  group.add(taper(0.035 * scale, 0.055 * scale, 0.26 * scale, '#6b4423', x, y + 0.13 * scale, z));
  group.add(cone(0.22 * scale, 0.3 * scale, leaf, x, y + 0.34 * scale, z, 7));
  group.add(cone(0.17 * scale, 0.24 * scale, '#3d8a4a', x, y + 0.5 * scale, z, 7));
  group.add(cone(0.11 * scale, 0.16 * scale, '#4a9a58', x, y + 0.62 * scale, z, 7));
}

function fruitTree(group: THREE.Group, x: number, z: number, y: number, fruit: string): void {
  group.add(taper(0.03, 0.05, 0.28, '#6b4423', x, y + 0.14, z));
  group.add(sphere(0.2, '#3d8a4a', x, y + 0.36, z));
  group.add(sphere(0.14, '#4a9a52', x + 0.08, y + 0.4, z - 0.04));
  group.add(sphere(0.04, fruit, x + 0.12, y + 0.34, z + 0.05));
  group.add(sphere(0.035, fruit, x - 0.09, y + 0.4, z - 0.06));
  group.add(sphere(0.03, fruit, x + 0.02, y + 0.46, z + 0.08));
}

function flowers(group: THREE.Group, y: number, seed: number): void {
  const colors = ['#e8d36a', '#f4e8d0', '#d4554a', '#e07a3a', '#8fd4ea'];
  for (let i = 0; i < 7; i += 1) {
    const ang = ((seed * 17 + i * 47) % 360) * (Math.PI / 180);
    const rad = 0.18 + ((seed + i * 13) % 20) / 70;
    group.add(sphere(0.03 + (i % 3) * 0.008, colors[i % colors.length]!, Math.cos(ang) * rad, y + 0.03, Math.sin(ang) * rad));
  }
}

function tufts(group: THREE.Group, y: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const ang = i * 0.9;
    const rad = 0.22 + (i % 4) * 0.08;
    group.add(box(0.02, 0.07, 0.02, '#5a8f3a', Math.cos(ang) * rad, y + 0.04, Math.sin(ang) * rad));
  }
}

function person(group: THREE.Group, x: number, z: number, y: number, shirt: string, hat?: string): void {
  group.add(cyl(0.028, 0.08, '#3a2a1c', x - 0.025, y + 0.04, z));
  group.add(cyl(0.028, 0.08, '#3a2a1c', x + 0.025, y + 0.04, z));
  group.add(cyl(0.055, 0.16, shirt, x, y + 0.14, z));
  group.add(cyl(0.018, 0.1, shirt, x - 0.07, y + 0.14, z));
  group.add(cyl(0.018, 0.1, shirt, x + 0.07, y + 0.14, z));
  group.add(sphere(0.055, '#f0d0b0', x, y + 0.26, z));
  if (hat) {
    group.add(cyl(0.08, 0.015, hat, x, y + 0.3, z));
    group.add(cyl(0.05, 0.04, hat, x, y + 0.33, z));
  }
}

function millWheel(root: THREE.Group, x: number, y: number, z: number): void {
  const wheel = new THREE.Group();
  wheel.position.set(x, y, z);
  wheel.add(cyl(0.22, 0.05, '#d8c4a0', 0, 0, 0, { rz: Math.PI / 2, specks: '#6b4423', seed: 2 }, 14));
  wheel.add(cyl(0.05, 0.08, '#8a6a40', 0, 0, 0, { rz: Math.PI / 2 }));
  for (let i = 0; i < 6; i += 1) {
    const paddle = box(0.06, 0.42, 0.035, '#8a6a40', 0, 0, 0);
    paddle.rotation.x = (i * Math.PI) / 3;
    wheel.add(paddle);
  }
  root.add(wheel);
  attachSpin(root, wheel, 'x', 1.6);
}

function windSails(root: THREE.Group, x: number, y: number, z: number): void {
  const hub = new THREE.Group();
  hub.position.set(x, y, z);
  hub.add(sphere(0.05, '#8a6a40', 0, 0, 0));
  for (let i = 0; i < 4; i += 1) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(box(0.07, 0.62, 0.02, '#f4e8d0', 0, 0.32, 0.01, { specks: '#efe0c4', seed: i + 1 }));
    arm.add(box(0.02, 0.58, 0.025, '#8a6a40', 0, 0.3, 0));
    hub.add(arm);
  }
  root.add(hub);
  attachSpin(root, hub, 'z', 0.9);
}

function boat(group: THREE.Group, x: number, y: number, z: number): void {
  group.add(box(0.28, 0.06, 0.12, '#8a6a40', x, y, z));
  group.add(box(0.08, 0.05, 0.1, '#c4a06a', x + 0.16, y, z, { ry: 0.4 }));
  group.add(cyl(0.012, 0.16, '#6b4423', x - 0.02, y + 0.1, z));
}

function waterSheet(group: THREE.Group, y: number, color = '#5eb4d4'): void {
  group.add(
    mesh(hexCylinder(HEX_SIZE * 0.72, 0.035), color, 0, y + 0.02, 0, {
      roughness: 0.22,
      metalness: 0.18,
      opacity: 0.88,
    }),
  );
}

export function createTileGroup(tileId: string): THREE.Group {
  const group = new THREE.Group();
  addShadow(group);

  switch (tileId) {
    case 'clareira': {
      const y = addBase(group, '#6d8a45', '#9ec96a', 0.2, 1);
      tufts(group, y, 8);
      flowers(group, y, 11);
      break;
    }
    case 'mata': {
      const y = addBase(group, '#2d5a34', '#3d7a45', 0.24, 2);
      tree(group, -0.3, 0.18, y, 1.08);
      tree(group, 0.32, -0.18, y, 0.82, '#245c32');
      tree(group, 0.02, 0.34, y, 1.18);
      tree(group, -0.1, -0.3, y, 0.68, '#4a8f52');
      tree(group, 0.28, 0.22, y, 0.55, '#2f6b3a');
      group.add(sphere(0.07, '#3d6b4f', 0.16, y + 0.04, 0.04));
      group.add(sphere(0.05, '#4a7a45', -0.22, y + 0.03, -0.08));
      break;
    }
    case 'rio': {
      const y = addBase(group, '#2f6f86', '#3d8fb0', 0.14, 3);
      waterSheet(group, y);
      group.add(box(0.95, 0.04, 0.28, '#7ec8e0', 0, y + 0.04, 0, { roughness: 0.2, metalness: 0.15, opacity: 0.9 }));
      group.add(sphere(0.045, '#d8f0f8', -0.22, y + 0.07, 0.08, { roughness: 0.15 }));
      group.add(sphere(0.03, '#d8f0f8', 0.26, y + 0.06, -0.08, { roughness: 0.15 }));
      group.add(sphere(0.05, '#c0b8b0', 0.32, y + 0.04, 0.2));
      group.add(sphere(0.04, '#a09890', -0.3, y + 0.035, -0.18));
      break;
    }
    case 'lago': {
      const y = addBase(group, '#2a6280', '#3d9ec4', 0.13, 11);
      const pond = sphere(0.48, '#5eb4d4', 0, y + 0.02, 0, { roughness: 0.18, metalness: 0.2, opacity: 0.9 });
      pond.scale.y = 0.18;
      group.add(pond);
      group.add(sphere(0.05, '#e8f6fc', 0.16, y + 0.08, -0.1, { roughness: 0.12 }));
      for (let i = 0; i < 5; i += 1) {
        const ang = i * 1.1;
        group.add(cone(0.02, 0.14, '#4a6b38', Math.cos(ang) * 0.38, y + 0.08, Math.sin(ang) * 0.38, 5));
      }
      boat(group, 0.08, y + 0.06, 0.04);
      break;
    }
    case 'monte': {
      const y = addBase(group, '#7a6a58', '#a09078', 0.22, 4);
      group.add(cone(0.48, 0.68, '#8d7a62', 0.04, y + 0.32, 0.02, 7));
      group.add(cone(0.3, 0.44, '#9a8a72', -0.24, y + 0.22, -0.16, 7));
      group.add(cone(0.22, 0.3, '#7a6a58', 0.28, y + 0.16, 0.22, 6));
      group.add(cone(0.16, 0.18, '#f2f0ea', 0.05, y + 0.66, 0.02, 6));
      group.add(cone(0.08, 0.08, '#f2f0ea', -0.24, y + 0.44, -0.16, 5));
      group.add(box(0.14, 0.1, 0.12, '#b0a8a0', 0.22, y + 0.06, -0.2, { specks: '#6a6258', seed: 2 }));
      break;
    }
    case 'trigo': {
      const y = addBase(group, '#8a7a3a', '#d4c46a', 0.2, 12);
      for (let row = -2; row <= 2; row += 1) {
        for (let col = -2; col <= 2; col += 1) {
          if (Math.abs(row) === 2 && Math.abs(col) === 2) continue;
          const h = 0.12 + ((row + col + 8) % 3) * 0.03;
          group.add(cone(0.035, h, col % 2 === 0 ? '#e6d36a' : '#c4b35a', col * 0.13, y + h / 2, row * 0.15, 5));
        }
      }
      break;
    }
    case 'roca': {
      const y = addBase(group, '#7a6b38', '#c4b35a', 0.2, 5);
      for (let row = 0; row < 3; row += 1) {
        const zz = -0.26 + row * 0.22;
        group.add(box(0.7, 0.04, 0.14, '#6b5a28', 0, y + 0.025, zz, { specks: '#3a3018', seed: row }));
        for (let i = -2; i <= 2; i += 1) {
          const crop = row === 1 ? '#d7c25c' : '#7cb342';
          group.add(cone(0.045, 0.15, crop, i * 0.13, y + 0.11, zz, 5));
        }
      }
      break;
    }
    case 'horta': {
      const y = addBase(group, '#6b5a38', '#8fbf5a', 0.2, 13);
      const veggies = ['#c45c3e', '#7cb342', '#e07a3a', '#6b8f3a'];
      for (let i = 0; i < 4; i += 1) {
        const zz = -0.3 + i * 0.18;
        group.add(box(0.58, 0.035, 0.1, '#6b4423', 0, y + 0.025, zz));
        group.add(sphere(0.045, veggies[i]!, -0.14, y + 0.07, zz));
        group.add(sphere(0.04, veggies[(i + 1) % 4]!, 0.12, y + 0.07, zz));
        group.add(cone(0.03, 0.08, '#4a8f52', 0.28, y + 0.06, zz, 5));
      }
      group.add(box(0.04, 0.16, 0.04, '#6b4423', -0.32, y + 0.1, 0.32));
      group.add(box(0.04, 0.16, 0.04, '#6b4423', 0.32, y + 0.1, 0.32));
      group.add(box(0.7, 0.02, 0.02, '#6b4423', 0, y + 0.18, 0.32));
      break;
    }
    case 'vinha': {
      const y = addBase(group, '#5a6b38', '#7a8f4a', 0.2, 14);
      for (let i = -1; i <= 1; i += 1) {
        group.add(box(0.72, 0.025, 0.025, '#6b4423', 0, y + 0.14, i * 0.22));
        group.add(cyl(0.022, 0.18, '#6b4423', -0.26, y + 0.09, i * 0.22));
        group.add(cyl(0.022, 0.18, '#6b4423', 0.26, y + 0.09, i * 0.22));
        group.add(sphere(0.045, '#6b2a4a', -0.08, y + 0.18, i * 0.22));
        group.add(sphere(0.04, '#8a3a5a', 0.1, y + 0.17, i * 0.22));
        group.add(sphere(0.03, '#4a8f52', 0, y + 0.2, i * 0.18));
      }
      break;
    }
    case 'pomar': {
      const y = addBase(group, '#4a6b38', '#8fbf5a', 0.2, 6);
      fruitTree(group, -0.24, 0.14, y, '#d4554a');
      fruitTree(group, 0.26, -0.16, y, '#e07a3a');
      fruitTree(group, 0.02, 0.3, y, '#c45c3e');
      flowers(group, y, 22);
      break;
    }
    case 'poco': {
      const y = addBase(group, '#6d8a45', '#9ec96a', 0.2, 15);
      tufts(group, y, 5);
      group.add(cyl(0.18, 0.16, '#b0a8a0', 0, y + 0.09, 0, { specks: '#6a6258', seed: 2 }, 12));
      group.add(cyl(0.12, 0.05, '#4aa3c8', 0, y + 0.17, 0, { roughness: 0.2, metalness: 0.15 }));
      group.add(box(0.04, 0.26, 0.04, '#6b4423', -0.16, y + 0.22, 0));
      group.add(box(0.04, 0.26, 0.04, '#6b4423', 0.16, y + 0.22, 0));
      group.add(box(0.36, 0.03, 0.04, '#6b4423', 0, y + 0.36, 0));
      group.add(cyl(0.025, 0.08, '#8a6a40', 0.2, y + 0.4, 0, { rz: Math.PI / 2 }));
      group.add(box(0.05, 0.06, 0.05, '#6b4423', 0, y + 0.08, 0.2));
      break;
    }
    case 'engenho': {
      const y = addBase(group, '#8a6a40', '#b08958', 0.22, 7);
      cottage(group, -0.1, 0.08, y, 0.44, 0.4, 0.34, '#c9a06a', '#c45c3e');
      millWheel(group, 0.34, y + 0.24, -0.1);
      group.add(box(0.12, 0.08, 0.18, '#8a6a40', 0.22, y + 0.06, 0.18));
      group.add(sphere(0.04, '#7ec8e0', 0.38, y + 0.04, -0.22, { roughness: 0.15, opacity: 0.7 }));
      break;
    }
    case 'moinho_vento': {
      const y = addBase(group, '#8a7a5a', '#c4b35a', 0.22, 16);
      group.add(taper(0.12, 0.2, 0.62, '#efe0c4', 0, y + 0.32, 0, { specks: '#fff8ee', seed: 3 }));
      pitchedRoof(group, 0.4, 0.4, '#c45c3e', 0, y + 0.66, 0);
      windowPane(group, 0, y + 0.28, 0.18, 0.07, 0.09);
      windowPane(group, 0, y + 0.46, 0.14, 0.06, 0.07);
      group.add(box(0.08, 0.12, 0.02, '#4a3020', 0, y + 0.1, 0.2));
      windSails(group, 0, y + 0.48, 0.16);
      break;
    }
    case 'padaria': {
      const y = addBase(group, '#c4b08a', '#e8d5b0', 0.22, 8);
      cottage(group, 0, 0.02, y, 0.5, 0.42, 0.34, '#f0e0c4', '#c45c3e');
      group.add(box(0.16, 0.05, 0.1, '#d8c4a0', -0.22, y + 0.05, 0.28));
      group.add(sphere(0.04, '#e6d36a', -0.22, y + 0.1, 0.28));
      group.add(sphere(0.035, '#d4b06a', -0.16, y + 0.09, 0.3));
      break;
    }
    case 'serraria': {
      const y = addBase(group, '#6b4423', '#8a6a40', 0.22, 9);
      group.add(box(0.6, 0.22, 0.4, '#c4a06a', 0, y + 0.13, 0, { specks: '#6b4423', seed: 4 }));
      pitchedRoof(group, 0.68, 0.48, '#8a3a28', 0, y + 0.28, 0);
      group.add(box(0.52, 0.07, 0.11, '#6b4423', 0.04, y + 0.08, 0.3));
      group.add(box(0.52, 0.07, 0.11, '#7a5230', 0.04, y + 0.15, 0.3));
      group.add(box(0.11, 0.07, 0.42, '#6b4423', -0.34, y + 0.08, 0));
      group.add(box(0.04, 0.18, 0.04, '#4a3020', 0.18, y + 0.12, 0.08, { rz: 0.5 }));
      break;
    }
    case 'cabana_mateiro': {
      const y = addBase(group, '#3d5a34', '#4a6b3c', 0.22, 10);
      cottage(group, -0.04, 0.06, y, 0.38, 0.34, 0.28, '#7a5a38', '#4a3a28', { windows: 1 });
      tree(group, 0.34, -0.22, y, 0.78);
      tree(group, -0.32, -0.2, y, 0.55, '#245c32');
      group.add(box(0.12, 0.08, 0.1, '#6b4423', 0.22, y + 0.05, 0.24));
      break;
    }
    case 'cais': {
      const y = addBase(group, '#2f6f86', '#5aa8c8', 0.14, 3);
      waterSheet(group, y, '#4aa3c8');
      group.add(box(0.82, 0.05, 0.34, '#c4a06a', 0, y + 0.07, 0.04, { specks: '#6b4423', seed: 4 }));
      for (let i = -2; i <= 2; i += 1) {
        group.add(box(0.04, 0.05, 0.34, '#8a6a40', i * 0.16, y + 0.075, 0.04));
      }
      group.add(cyl(0.04, 0.24, '#8a6a40', -0.3, y + 0.16, 0.16));
      group.add(cyl(0.04, 0.24, '#8a6a40', 0.3, y + 0.16, 0.16));
      boat(group, 0.02, y + 0.08, -0.22);
      break;
    }
    case 'ponte': {
      const y = addBase(group, '#2f6f86', '#4aa3c8', 0.14, 17);
      waterSheet(group, y);
      group.add(box(0.95, 0.06, 0.3, '#c4a06a', 0, y + 0.12, 0, { specks: '#6b4423', seed: 3 }));
      group.add(box(0.95, 0.04, 0.035, '#8a6a40', 0, y + 0.18, 0.15));
      group.add(box(0.95, 0.04, 0.035, '#8a6a40', 0, y + 0.18, -0.15));
      for (let i = -1; i <= 1; i += 1) {
        group.add(cyl(0.035, 0.2, '#8a6a40', i * 0.32, y + 0.1, 0.16));
        group.add(cyl(0.035, 0.2, '#8a6a40', i * 0.32, y + 0.1, -0.16));
      }
      break;
    }
    case 'pedreira': {
      const y = addBase(group, '#7a746c', '#9a9088', 0.24, 18);
      group.add(box(0.3, 0.24, 0.26, '#b0a8a0', -0.18, y + 0.13, 0.08, { specks: '#6a6258', seed: 2 }));
      group.add(box(0.24, 0.18, 0.22, '#8c847c', 0.22, y + 0.11, -0.12, { specks: '#5a5850', seed: 3 }));
      group.add(box(0.16, 0.12, 0.16, '#c0b8b0', 0.08, y + 0.08, 0.24));
      group.add(box(0.1, 0.08, 0.1, '#a09890', -0.28, y + 0.06, -0.22));
      group.add(box(0.05, 0.16, 0.05, '#6b4423', 0.32, y + 0.1, 0.16, { rz: 0.4 }));
      break;
    }
    case 'olaria': {
      const y = addBase(group, '#8a6a50', '#c4a06a', 0.22, 19);
      group.add(cyl(0.22, 0.3, '#c45c3e', 0, y + 0.16, 0, { specks: '#6b2418', seed: 4 }));
      group.add(taper(0.08, 0.14, 0.16, '#8a3a28', 0, y + 0.38, 0));
      group.add(sphere(0.035, '#888', 0, y + 0.5, 0, { opacity: 0.5 }));
      group.add(cyl(0.06, 0.08, '#d4b08a', 0.3, y + 0.06, 0.18));
      group.add(cyl(0.05, 0.06, '#c45c3e', 0.28, y + 0.05, -0.16));
      group.add(cyl(0.045, 0.07, '#e07a3a', -0.28, y + 0.055, 0.12));
      break;
    }
    case 'casa': {
      const y = addBase(group, '#6d8a45', '#b5d48a', 0.2, 1);
      cottage(group, 0, 0, y, 0.42, 0.38, 0.3, '#f3e6cc', '#c45c3e');
      tufts(group, y, 4);
      flowers(group, y, 3);
      break;
    }
    case 'sobrado': {
      const y = addBase(group, '#6d8a45', '#b5d48a', 0.2, 1);
      cottage(group, 0, 0, y, 0.44, 0.4, 0.52, '#efe0c4', '#a33b2c', { windows: 2 });
      windowPane(group, -0.12, y + 0.38, 0.21, 0.07, 0.07);
      windowPane(group, 0.12, y + 0.38, 0.21, 0.07, 0.07);
      group.add(box(0.16, 0.04, 0.1, '#c4a06a', 0, y + 0.03, 0.26));
      break;
    }
    case 'casa_pedra': {
      const y = addBase(group, '#7a746c', '#b5d48a', 0.22, 20);
      cottage(group, 0, 0, y, 0.46, 0.4, 0.36, '#c0b8b0', '#8a5a48', { chimney: true });
      group.add(box(0.1, 0.08, 0.08, '#a09890', 0.28, y + 0.05, 0.22));
      break;
    }
    case 'mercado': {
      const y = addBase(group, '#a09068', '#d7c48a', 0.2, 21);
      group.add(box(0.64, 0.08, 0.44, '#6b4423', 0, y + 0.05, 0));
      group.add(box(0.7, 0.035, 0.5, '#c45c3e', 0, y + 0.3, 0, { specks: '#6b2418', seed: 2 }));
      group.add(box(0.7, 0.02, 0.5, '#a33b2c', 0, y + 0.26, 0, { rx: 0.12 }));
      for (const [sx, sz] of [
        [-0.3, -0.18],
        [0.3, -0.18],
        [-0.3, 0.18],
        [0.3, 0.18],
      ] as const) {
        group.add(cyl(0.028, 0.26, '#6b4423', sx, y + 0.16, sz));
      }
      group.add(box(0.12, 0.08, 0.12, '#d4554a', -0.14, y + 0.12, 0.06));
      group.add(box(0.12, 0.08, 0.12, '#e6d36a', 0.14, y + 0.12, -0.04));
      group.add(sphere(0.04, '#7cb342', 0, y + 0.12, 0.08));
      break;
    }
    case 'capela': {
      const y = addBase(group, '#b0a898', '#cfc8b4', 0.2, 22);
      cottage(group, 0, 0.04, y, 0.36, 0.36, 0.38, '#efeae0', '#6b5a8a', { chimney: false, windows: 2 });
      group.add(box(0.1, 0.2, 0.1, '#efeae0', 0, y + 0.66, 0.02));
      pitchedRoof(group, 0.16, 0.16, '#6b5a8a', 0, y + 0.78, 0.02);
      group.add(box(0.03, 0.16, 0.03, '#d4c46a', 0, y + 0.92, 0.02));
      group.add(box(0.1, 0.03, 0.03, '#d4c46a', 0, y + 0.86, 0.02));
      break;
    }
    case 'escola': {
      const y = addBase(group, '#6d8a45', '#b5d48a', 0.2, 23);
      cottage(group, 0, 0, y, 0.54, 0.42, 0.34, '#f4e8d0', '#3a8fbf', { chimney: false });
      group.add(box(0.08, 0.12, 0.08, '#f4e8d0', 0.2, y + 0.52, -0.04));
      group.add(box(0.03, 0.1, 0.03, '#d4c46a', 0.2, y + 0.64, -0.04));
      group.add(box(0.18, 0.02, 0.18, '#c45c3e', 0.24, y + 0.015, 0.3));
      windowPane(group, -0.16, y + 0.22, 0.22);
      break;
    }
    case 'estabulo': {
      const y = addBase(group, '#6b5a38', '#c4b35a', 0.2, 24);
      group.add(box(0.62, 0.3, 0.42, '#c9a06a', 0, y + 0.16, 0, { specks: '#8a6a40', seed: 4 }));
      pitchedRoof(group, 0.7, 0.5, '#8a5a38', 0, y + 0.36, 0);
      group.add(box(0.14, 0.18, 0.02, '#4a3020', 0.1, y + 0.12, 0.22));
      group.add(box(0.14, 0.18, 0.02, '#4a3020', -0.12, y + 0.12, 0.22));
      group.add(box(0.18, 0.12, 0.24, '#d8c4a0', -0.3, y + 0.08, 0.24));
      group.add(box(0.1, 0.14, 0.22, '#8a6a40', 0.28, y + 0.1, 0.18));
      group.add(sphere(0.05, '#6b4423', 0.28, y + 0.2, 0.28));
      break;
    }
    case 'farol': {
      const y = addBase(group, '#2f6f86', '#9ec96a', 0.2, 25);
      const stripes = ['#efeae0', '#c45c3e', '#efeae0', '#c45c3e'];
      stripes.forEach((color, i) => {
        group.add(taper(0.1 - i * 0.008, 0.13 - i * 0.008, 0.16, color, 0, y + 0.1 + i * 0.16, 0));
      });
      group.add(cyl(0.12, 0.14, '#f4e8d0', 0, y + 0.8, 0));
      const lamp = new THREE.Mesh(cached('sph:0.075', () => new THREE.SphereGeometry(0.075, 12, 10)), glow('#f5d76e'));
      lamp.position.set(0, y + 0.9, 0);
      lamp.castShadow = false;
      group.add(lamp);
      addLamp(group, lamp);
      pitchedRoof(group, 0.28, 0.28, '#c45c3e', 0, y + 0.98, 0);
      group.add(box(0.08, 0.1, 0.02, '#4a3020', 0, y + 0.08, 0.14));
      break;
    }
    case 'aldeao': {
      const y = addBase(group, '#6d8a45', '#9ec96a', 0.18, 1);
      tufts(group, y, 4);
      person(group, 0.06, 0.04, y, '#3d6b4f', '#c45c3e');
      break;
    }
    case 'moleiro': {
      const y = addBase(group, '#8a6a40', '#b08958', 0.18, 7);
      person(group, 0.02, 0, y, '#efe0c4', '#6b4423');
      group.add(box(0.1, 0.06, 0.08, '#d8c4a0', 0.18, y + 0.04, 0.12));
      break;
    }
    case 'padeiro': {
      const y = addBase(group, '#c4b08a', '#e8d5b0', 0.18, 8);
      person(group, 0.02, 0, y, '#f4e8d0', '#c45c3e');
      group.add(sphere(0.04, '#e6d36a', 0.16, y + 0.05, 0.1));
      group.add(sphere(0.03, '#d4b06a', 0.2, y + 0.04, 0.14));
      break;
    }
    case 'pescador': {
      const y = addBase(group, '#2f6f86', '#5aa8c8', 0.16, 3);
      waterSheet(group, y);
      person(group, -0.06, 0.04, y, '#3a8fbf', '#6b4423');
      group.add(box(0.28, 0.015, 0.02, '#8a6a40', 0.18, y + 0.16, -0.04, { rz: 0.7 }));
      boat(group, 0.16, y + 0.06, 0.16);
      break;
    }
    default: {
      addBase(group, '#888888', '#cccccc', 0.2, 0);
      break;
    }
  }

  group.userData.tileId = tileId;
  return group;
}

export function createGhostGroup(): THREE.Mesh {
  const item = new THREE.Mesh(
    hexCylinder(HEX_SIZE, 0.12),
    new THREE.MeshStandardMaterial({ color: '#f4e8d0', transparent: true, opacity: 0.45, roughness: 0.8 }),
  );
  item.position.y = 0.08;
  return item;
}

/** Marcadores de hex válido compartilham geometria e material: são só instâncias posicionadas. */
const MARKER_MATERIAL = std('#f4e8d0', { transparent: true, opacity: 0.42 });

export function createValidMarker(): THREE.Mesh {
  const item = new THREE.Mesh(hexCylinder(HEX_SIZE, 0.05), MARKER_MATERIAL);
  item.position.y = 0.025;
  return item;
}

export function createVillagerMesh(): THREE.Group {
  const group = new THREE.Group();
  person(group, 0, 0, 0, '#c45c3e', '#3d6b4f');
  return group;
}

export function tileAccent(tileId: string): string {
  if (['mata', 'pomar', 'cabana_mateiro', 'clareira', 'horta', 'vinha', 'trigo'].includes(tileId)) return '#3d6b4f';
  if (['rio', 'cais', 'lago', 'ponte', 'poco', 'farol', 'pescador'].includes(tileId)) return '#3a8fbf';
  if (['casa', 'sobrado', 'padaria', 'capela', 'escola', 'padeiro'].includes(tileId)) return '#c45c3e';
  return '#b08958';
}
