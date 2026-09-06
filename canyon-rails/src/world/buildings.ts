import * as THREE from 'three';
import { cloneBuildingModel } from '../render/modelLoader.ts';
import { LowPolyBuilder, glowMaterial } from '../render/lowpoly.ts';

export const BUILDING_KINDS = [
  'house', 'cottage', 'manor', 'cabin', 'watertower', 'windmill', 'shed', 'station', 'lamp', 'bench',
] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

export interface BuildingSpec {
  label: string;
  icon: string;
  cost: number;
  /** Raio ocupado no terreno (colisão e validação de encosta). */
  footprint: number;
  score: number;
  xp: number;
  /** Descrição do efeito no jogo, mostrada na dica do painel. */
  perk: string;
}

export const BUILDING_SPECS: Record<BuildingKind, BuildingSpec> = {
  house: { label: 'Casa', icon: '🏠', cost: 180, footprint: 4, score: 60, xp: 30, perk: '+2 de carga por entrega' },
  cottage: { label: 'Casinha', icon: '🏚️', cost: 120, footprint: 3.5, score: 40, xp: 20, perk: '+2 de carga por entrega' },
  manor: { label: 'Casa grande', icon: '🏡', cost: 450, footprint: 5, score: 150, xp: 70, perk: '+2 de carga por entrega' },
  cabin: { label: 'Cabana de madeira', icon: '🛖', cost: 220, footprint: 4, score: 70, xp: 35, perk: '+6 de lenha máxima' },
  watertower: { label: 'Torre d’água', icon: '🗼', cost: 300, footprint: 4, score: 90, xp: 45, perk: 'Desgaste do trem 20% menor' },
  windmill: { label: 'Moinho de vento', icon: '🌀', cost: 380, footprint: 4.5, score: 110, xp: 55, perk: '+8 moedas por minuto' },
  shed: { label: 'Armazém', icon: '📦', cost: 180, footprint: 4, score: 50, xp: 25, perk: '+8 de carga por entrega' },
  station: { label: 'Estação', icon: '🏛️', cost: 520, footprint: 5.5, score: 180, xp: 90, perk: '+10% de moedas por entrega (máx. 3)' },
  lamp: { label: 'Poste de luz', icon: '💡', cost: 60, footprint: 1.6, score: 15, xp: 8, perk: 'Decoração — pontos' },
  bench: { label: 'Banco de praça', icon: '🪑', cost: 90, footprint: 1.8, score: 20, xp: 10, perk: 'Decoração — pontos' },
};

export function isBuildingKind(value: string): value is BuildingKind {
  return (BUILDING_KINDS as readonly string[]).includes(value);
}

function lambert(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roof(w: number, h: number, d: number, color: string, y: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0, Math.SQRT1_2, h, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(w, 1, d);
  const mesh = new THREE.Mesh(geo, lambert(color));
  mesh.position.y = y + h / 2;
  mesh.castShadow = true;
  return mesh;
}

const WALL_COLORS = ['#f0e2c4', '#e6d3ae', '#dcc39c'];
const ROOF_COLORS = ['#3f6dc0', '#b5432f', '#4a7a44', '#8a5a34'];

const WOOD = '#6b4a2f';
const WOOD_DARK = '#4a3828';
const WOOD_LIGHT = '#8a5a34';
const IRON = '#3a3a42';
const WINDOW = '#8fc6e8';

/** Grupo da construção (GLB pré-carregado se houver, senão procedural). `userData.spin` marca partes animadas. */
export function createBuilding(kind: BuildingKind, variant = 0): THREE.Group {
  const fromAsset = cloneBuildingModel(kind);
  if (fromAsset) return fromAsset;

  const g = new THREE.Group();
  const wall = WALL_COLORS[variant % WALL_COLORS.length];
  const tile = ROOF_COLORS[variant % ROOF_COLORS.length];

  switch (kind) {
    case 'cottage':
      g.add(box(4.3, 0.25, 3.6, '#9a8a78', 0, 0));
      g.add(box(4.1, 2.55, 3.4, wall, 0, 0.25));
      g.add(roof(3.3, 1.55, 2.9, tile, 2.8));
      g.add(box(0.9, 1.5, 0.14, '#6b4a2f', 0, 0.3, 1.78));
      g.add(box(0.95, 0.95, 0.1, WINDOW, -1.2, 1.4, 1.75));
      g.add(box(0.95, 0.95, 0.1, WINDOW, 1.2, 1.4, 1.75));
      g.add(box(0.45, 1.0, 0.45, tile, -1.3, 2.8, -0.6));
      break;
    case 'house':
      g.add(box(5.7, 0.28, 4.3, '#9a8a78', 0, 0));
      g.add(box(5.5, 3.15, 4.1, wall, 0, 0.28));
      g.add(roof(4.2, 1.85, 3.4, tile, 3.4));
      g.add(box(1.05, 1.9, 0.14, '#6b4a2f', -1.3, 0.35, 2.12));
      g.add(box(1.1, 1.1, 0.1, WINDOW, 1.35, 1.55, 2.1));
      g.add(box(0.1, 1.0, 1.0, WINDOW, 2.8, 1.55, 0));
      g.add(box(0.5, 1.3, 0.5, tile, 1.8, 3.4, -0.8));
      break;
    case 'manor':
      g.add(box(7.3, 0.3, 5.3, '#9a8a78', 0, 0));
      g.add(box(7.1, 3.4, 5.1, wall, 0, 0.3));
      g.add(box(3.5, 2.5, 4.7, wall, 1.65, 3.7));
      g.add(roof(5.3, 2.05, 4.0, tile, 3.7));
      g.add(roof(2.8, 1.3, 2.4, tile, 6.2));
      g.add(box(1.0, 2.6, 1.0, '#b5432f', -2.55, 3.7));
      g.add(box(1.3, 2.1, 0.15, '#6b4a2f', -1.85, 0.35, 2.62));
      g.add(box(1.1, 1.15, 0.1, WINDOW, 0.6, 1.7, 2.6));
      g.add(box(1.1, 1.15, 0.1, WINDOW, 2.2, 1.7, 2.6));
      break;
    case 'cabin': {
      const logs = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 7), lambert(i % 2 ? '#7d5433' : '#6b4a2f'));
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.4 + i * 0.62, 0);
        log.castShadow = true;
        logs.add(log);
      }
      g.add(logs);
      g.add(box(5, 0.6, 3.6, '#6b4a2f', 0, 0));
      g.add(roof(3.6, 1.4, 2.6, '#8a5a34', 3.5));
      break;
    }
    case 'watertower':
      g.add(buildWaterTower());
      break;
    case 'windmill': {
      const { tower, blades } = buildWindmill();
      g.add(tower);
      blades.userData.spin = true;
      g.add(blades);
      break;
    }
    case 'shed':
      g.add(box(6, 2.4, 4.2, '#8a5a34'));
      g.add(box(6.4, 0.5, 4.6, '#5c4632', 0, 2.4));
      g.add(box(2.2, 1.8, 0.2, '#6b4a2f', 0, 0, 2.2));
      break;
    case 'station': {
      const { body, lights } = buildStation(wall, tile);
      g.add(body);
      g.add(lights);
      break;
    }
    case 'lamp': {
      g.add(box(0.22, 3.6, 0.22, IRON));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), glowMaterial('#f5d98a', '#6b5a1f', 1));
      head.position.y = 3.95;
      head.castShadow = true;
      g.add(head);
      break;
    }
    case 'bench':
      g.add(box(2.4, 0.18, 0.7, '#8a5a34', 0, 0.5));
      g.add(box(2.4, 0.7, 0.16, '#8a5a34', 0, 0.68, -0.32));
      g.add(box(0.16, 0.5, 0.6, '#5c4632', -1, 0));
      g.add(box(0.16, 0.5, 0.6, '#5c4632', 1, 0));
      break;
  }
  return g;
}

/**
 * Torre d’água: quatro pernas inclinadas com sapatas, cruzetas em X nas
 * faces, plataforma, tanque com aduelas e cintas, telhado cônico com
 * catavento, escada e a calha de abastecimento. Um único mesh.
 */
function buildWaterTower(): THREE.Mesh {
  const b = new LowPolyBuilder();
  const legTop = 1.05;
  const legBase = 1.5;
  const legH = 4.9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    // sapata + perna (inclinada: base mais aberta que o topo)
    b.box(0.6, 0.22, 0.6, WOOD_DARK, sx * legBase, 0, sz * legBase);
    const dx = sx * (legTop - legBase);
    const dz = sz * (legTop - legBase);
    const tilt = Math.hypot(dx, dz);
    const len = Math.hypot(legH, tilt);
    b.add(new THREE.BoxGeometry(0.34, len, 0.34), '#5c4632', {
      rx: Math.atan2(-dz, legH) * (sz === 0 ? 0 : 1) * -1,
      rz: Math.atan2(dx, legH),
      x: sx * (legBase + legTop) / 2,
      y: 0.22 + legH / 2,
      z: sz * (legBase + legTop) / 2,
    });
  }
  // Cruzetas em X em cada face, em dois níveis.
  for (const level of [1.4, 3.3]) {
    const half = legBase - (legBase - legTop) * (level / legH);
    for (const side of [-1, 1]) {
      for (const diag of [-1, 1]) {
        b.add(new THREE.BoxGeometry(half * 2.15, 0.1, 0.1), WOOD_DARK,
          { rz: diag * 0.5, x: 0, y: level, z: side * half });
        b.add(new THREE.BoxGeometry(0.1, 0.1, half * 2.15), WOOD_DARK,
          { rx: diag * 0.5, x: side * half, y: level, z: 0 });
      }
    }
    b.box(half * 2 + 0.2, 0.14, 0.14, WOOD, 0, level + 0.55, half);
    b.box(half * 2 + 0.2, 0.14, 0.14, WOOD, 0, level + 0.55, -half);
  }
  // Plataforma e tanque.
  b.cyl(2.35, 2.35, 0.22, WOOD_DARK, 0, legH + 0.1, 0, 12);
  b.cyl(2.0, 2.0, 2.7, '#7d5433', 0, legH + 0.32, 0, 12);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.16, 2.7, 0.14, '#6b4a2f', Math.cos(a) * 2.0, legH + 0.32, Math.sin(a) * 2.0, { ry: -a });
  }
  for (const y of [legH + 0.7, legH + 1.7, legH + 2.7]) {
    b.torus(2.05, 0.06, '#c9a26a', 0, y, 0, { rx: Math.PI / 2 }, 6, 20);
  }
  // Telhado cônico + catavento.
  b.cone(2.35, 1.3, '#3f6dc0', 0, legH + 3.0, 0, 12);
  b.cyl(0.06, 0.06, 0.9, IRON, 0, legH + 4.25, 0, 6);
  b.box(0.5, 0.18, 0.04, IRON, 0.2, legH + 4.9, 0);
  b.box(0.08, 0.3, 0.04, IRON, 0.45, legH + 4.85, 0);
  // Escada num dos lados.
  for (const z of [-0.3, 0.3]) b.box(0.08, legH + 0.3, 0.08, WOOD_LIGHT, -1.75, 0, z);
  for (let y = 0.5; y < legH + 0.2; y += 0.55) b.box(0.08, 0.08, 0.7, WOOD_LIGHT, -1.75, y, 0);
  // Calha de abastecimento (pendurada, virada para o trilho).
  b.tube(0.16, 2.2, IRON, 1.9, legH + 1.2, 1.4, 8);
  b.add(new THREE.CylinderGeometry(0.13, 0.13, 1.4, 8), IRON, { rx: 0.9, x: 2.9, y: legH + 0.6, z: 1.6 });
  return b.build('watertower');
}

/**
 * Moinho: base de pedra, torre octogonal afunilada com cintas, porta e
 * janelas, galeria com balaústres, cúpula com leme e pás com armação e ripas.
 * Torre = 1 mesh; pás = 1 mesh animado (`userData.spin`).
 */
function buildWindmill(): { tower: THREE.Mesh; blades: THREE.Mesh } {
  const b = new LowPolyBuilder();
  b.cyl(1.85, 2.0, 0.55, '#9a8a78', 0, 0, 0, 8);
  b.cyl(0.95, 1.7, 6.4, '#e6d3ae', 0, 0.55, 0, 8);
  for (const y of [2.2, 3.9, 5.4]) {
    const r = 1.7 - (1.7 - 0.95) * ((y - 0.55) / 6.4);
    b.cyl(r + 0.08, r + 0.1, 0.12, WOOD, 0, y, 0, 8);
  }
  b.box(0.75, 1.35, 0.12, WOOD, 0, 0.55, 1.68);
  b.box(0.5, 0.65, 0.12, WINDOW, 0, 3.0, 1.32);
  b.box(0.12, 0.6, 0.5, WINDOW, -1.16, 4.3, 0);
  // Galeria com balaústres.
  b.cyl(1.55, 1.55, 0.12, WOOD_DARK, 0, 4.9, 0, 8);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.08, 0.6, 0.08, WOOD, Math.cos(a) * 1.45, 5.02, Math.sin(a) * 1.45);
  }
  b.torus(1.45, 0.04, WOOD, 0, 5.62, 0, { rx: Math.PI / 2 }, 6, 12);
  // Cúpula e leme.
  b.cone(1.35, 1.3, '#b5432f', 0, 6.95, 0, 8);
  b.cyl(0.4, 0.55, 0.6, '#b5432f', 0, 6.95, 0.75, 8);
  b.box(0.06, 0.9, 1.6, WOOD_DARK, 0, 6.6, -1.7);
  b.box(0.06, 0.06, 1.8, WOOD_DARK, 0, 7.05, -1.2);
  const tower = b.build('windmill');

  const s = new LowPolyBuilder();
  s.cyl(0.32, 0.32, 0.6, WOOD_DARK, 0, -0.3, 0, 10, { rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) {
    const rz = (i * Math.PI) / 2;
    // braço + moldura da vela + ripas
    s.add(new THREE.BoxGeometry(0.16, 3.4, 0.16), WOOD_DARK, { y: 1.7, rz });
    s.add(new THREE.BoxGeometry(0.9, 0.1, 0.08), WOOD, { x: 0.45, y: 3.2, rz });
    s.add(new THREE.BoxGeometry(0.9, 0.1, 0.08), WOOD, { x: 0.45, y: 0.9, rz });
    s.add(new THREE.BoxGeometry(0.08, 2.4, 0.08), WOOD, { x: 0.86, y: 2.05, rz });
    for (let k = 0; k < 6; k++) {
      s.add(new THREE.BoxGeometry(0.78, 0.22, 0.05), '#f2e6cc', { x: 0.45, y: 1.1 + k * 0.38, rz });
    }
  }
  const blades = s.build('blades');
  blades.position.set(0, 6.9, 1.2);
  return { tower, blades };
}

/**
 * Estação: plataforma com beirada, prédio de escritório com telhado de duas
 * águas, chaminé e placa, marquise sobre postes, caixas e um banco. Janelas
 * acesas ficam num segundo mesh emissivo.
 */
function buildStation(wall: string, tile: string): { body: THREE.Mesh; lights: THREE.Mesh } {
  const b = new LowPolyBuilder();
  // Plataforma
  b.box(10.5, 0.55, 5.2, '#b9a68a', 0, 0, -0.4);
  b.box(10.5, 0.1, 0.35, '#8f7c62', 0, 0.55, 2.1);
  for (let i = 0; i < 7; i++) b.box(0.25, 0.55, 0.25, WOOD_DARK, -4.8 + i * 1.6, 0, 2.25);
  // Prédio
  b.box(4.6, 0.2, 3.4, '#9a8a78', -2.4, 0.55, -1.2);
  b.box(4.4, 3.0, 3.2, wall, -2.4, 0.75, -1.2);
  b.gable(4.8, 1.5, 3.4, tile, 3.75, -2.4, -1.2, 0.3);
  b.box(0.6, 1.2, 0.6, '#b5432f', -3.6, 4.2, -1.9);
  b.box(0.95, 1.9, 0.12, WOOD, -1.4, 0.75, 0.42);
  // Marquise sobre o resto da plataforma
  for (const x of [0.6, 2.6, 4.6]) {
    b.box(0.22, 3.2, 0.22, WOOD_DARK, x, 0.55, 1.6);
    b.box(0.22, 3.2, 0.22, WOOD_DARK, x, 0.55, -2.4);
    b.add(new THREE.BoxGeometry(0.12, 1.0, 0.12), WOOD, { rx: 0.7, x, y: 3.5, z: 1.35 });
    b.add(new THREE.BoxGeometry(0.12, 1.0, 0.12), WOOD, { rx: -0.7, x, y: 3.5, z: -2.15 });
  }
  b.add(new THREE.BoxGeometry(5.4, 0.14, 4.7), tile, { rx: 0.1, x: 2.6, y: 3.95, z: -0.4 });
  b.box(5.4, 0.12, 0.2, WOOD_DARK, 2.6, 3.75, 1.9);
  // Placa da estação + relógio
  b.box(2.6, 0.7, 0.12, '#f6ead2', 0.2, 3.9, 2.0);
  b.box(2.7, 0.08, 0.16, WOOD_DARK, 0.2, 4.6, 2.0);
  b.cyl(0.32, 0.32, 0.1, '#f6ead2', -1.4, 3.0, 0.45, 12, { rx: Math.PI / 2 });
  // Caixas e banco
  b.box(0.8, 0.8, 0.8, WOOD_LIGHT, 4.3, 0.55, 0.6);
  b.box(0.7, 0.7, 0.7, WOOD_LIGHT, 3.5, 0.55, 0.9);
  b.box(0.7, 0.6, 0.7, WOOD_LIGHT, 4.3, 1.35, 0.6);
  b.box(2.0, 0.14, 0.55, WOOD_LIGHT, 1.6, 1.0, -1.7);
  b.box(2.0, 0.6, 0.12, WOOD_LIGHT, 1.6, 1.14, -1.95);
  b.box(0.12, 0.45, 0.5, WOOD_DARK, 0.7, 0.55, -1.7);
  b.box(0.12, 0.45, 0.5, WOOD_DARK, 2.5, 0.55, -1.7);
  const body = b.build('station');

  const l = new LowPolyBuilder();
  l.box(0.9, 0.9, 0.08, '#ffe9a8', -3.3, 1.7, 0.42);
  l.box(0.9, 0.9, 0.08, '#ffe9a8', -2.4, 1.7, -2.82);
  l.box(0.08, 0.9, 0.9, '#ffe9a8', -4.62, 1.7, -1.2);
  const lights = l.build('station-lights');
  lights.material = glowMaterial('#ffe9a8', '#8a6a1f', 0.8);
  return { body, lights };
}

/** Materiais translúcidos verde/vermelho para o preview de colocação. */
export function makeGhost(group: THREE.Group, valid: boolean): void {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = false;
    obj.material = new THREE.MeshBasicMaterial({
      color: valid ? '#6fe06a' : '#e8544a',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  });
}
