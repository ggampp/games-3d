import * as THREE from 'three';
import { WATER_LEVEL, fbm, heightAt, slopeAt, getTerrainProfile } from './heightfield.ts';

/** RNG determinístico (mulberry32). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KeepOutCircle {
  x: number;
  z: number;
  r: number;
}

/** Densidade de floresta em [0,1]; bosques nascem acima de FOREST_THRESHOLD. */
export function forestDensity(x: number, z: number): number {
  return fbm(x * 0.008 + 120, z * 0.008 + 77);
}
const FOREST_THRESHOLD = 0.58;

/** Pedras acima deste raio são obstáculos rastreados (dinamitáveis). */
const BOULDER_MIN_SCALE = 1.5;
/** Slots extras na malha de pedras para aglomerados fixos e desmoronamentos. */
const ROCK_SPARE_SLOTS = 160;

interface Boulder {
  x: number;
  z: number;
  radius: number;
  index: number;
  alive: boolean;
}

/**
 * As pedras grandes do vale: bloqueiam trilhos e construções até serem
 * dinamitadas. Guardar posição e índice permite apagar a instância depois.
 */
export class RockField {
  private mesh: THREE.InstancedMesh;
  private boulders: Boulder[] = [];
  private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  /** Próximo slot livre da InstancedMesh para pedras criadas em jogo. */
  private nextIndex: number;
  private colors: readonly string[];

  constructor(mesh: THREE.InstancedMesh, firstFreeIndex: number, colors: readonly string[]) {
    this.mesh = mesh;
    this.nextIndex = firstFreeIndex;
    this.colors = colors;
  }

  add(x: number, z: number, radius: number, index: number): void {
    this.boulders.push({ x, z, radius, index, alive: true });
  }

  /** Slots ainda disponíveis para pedras novas (desmoronamentos). */
  get spareSlots(): number {
    return Math.max(0, this.mesh.instanceMatrix.count - this.nextIndex);
  }

  /**
   * Cria uma pedra nova em jogo (desmoronamento). Devolve false se a malha
   * não tem mais slots — o chamador pode simplesmente não desmoronar.
   */
  spawn(x: number, z: number, scale: number, seed = 0): boolean {
    if (this.spareSlots <= 0) return false;
    const index = this.nextIndex++;
    const y = heightAt(x, z);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), seed * 2.39996);
    matrix.compose(
      new THREE.Vector3(x, y - 0.15, z),
      quat,
      new THREE.Vector3(scale, scale * 0.95, scale),
    );
    this.mesh.setMatrixAt(index, matrix);
    this.mesh.setColorAt(index, new THREE.Color(this.colors[index % this.colors.length]));
    this.mesh.count = Math.max(this.mesh.count, index + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.add(x, z, scale * 0.9, index);
    return true;
  }

  /** Índices de todos os pontos de um caminho encostados numa pedra viva. */
  blockedIndices(points: ReadonlyArray<{ x: number; z: number }>, pad: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if (this.blocks(points[i].x, points[i].z, pad)) out.push(i);
    }
    return out;
  }

  get aliveCount(): number {
    return this.boulders.filter((b) => b.alive).length;
  }

  /** Há alguma pedra viva encostando num círculo de raio `pad` em (x,z)? */
  blocks(x: number, z: number, pad: number): boolean {
    for (const b of this.boulders) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - x, b.z - z) < b.radius + pad) return true;
    }
    return false;
  }

  /** Remove as pedras dentro do raio; devolve quantas sumiram. */
  blast(x: number, z: number, radius: number): number {
    let removed = 0;
    for (const b of this.boulders) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - x, b.z - z) > radius + b.radius) continue;
      b.alive = false;
      this.mesh.setMatrixAt(b.index, this.zeroMatrix);
      removed++;
    }
    if (removed > 0) this.mesh.instanceMatrix.needsUpdate = true;
    return removed;
  }

  /** Índices já dinamitados, para o jogo salvo. */
  removedIndices(): number[] {
    return this.boulders.filter((b) => !b.alive).map((b) => b.index);
  }

  restoreRemoved(indices: number[]): void {
    const set = new Set(indices);
    let changed = false;
    for (const b of this.boulders) {
      if (!set.has(b.index) || !b.alive) continue;
      b.alive = false;
      this.mesh.setMatrixAt(b.index, this.zeroMatrix);
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export interface ScatterWorld {
  group: THREE.Group;
  rocks: RockField;
}

interface ScatterSpec {
  count: number;
  geometry: THREE.BufferGeometry;
  colors: string[];
  minScale: number;
  maxScale: number;
  maxSlope: number;
  yOffset: number;
  /** Onde a peça pode nascer em relação aos bosques. */
  forest: 'any' | 'outside';
}

/**
 * Vegetação e pedras instanciadas. Evita água, encostas fortes e os círculos
 * marcados (cidades). Os pinheiros nascem só nos bolsões de floresta.
 */
export function buildScatter(keepOut: KeepOutCircle[] = []): ScatterWorld {
  const group = new THREE.Group();
  const rng = makeRng(20260811);

  const blocked = (x: number, z: number): boolean => {
    for (const circle of keepOut) {
      if (Math.hypot(circle.x - x, circle.z - z) < circle.r) return true;
    }
    return false;
  };

  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  rockGeo.translate(0, 0.35, 0);
  // cacto com braços — geometria única para InstancedMesh
  const cactusGeo = buildCactusGeometry();
  const bushGeo = new THREE.IcosahedronGeometry(0.75, 1);
  bushGeo.translate(0, 0.42, 0);
  const flowerGeo = new THREE.IcosahedronGeometry(0.32, 1);
  flowerGeo.translate(0, 0.22, 0);

  const profile = getTerrainProfile();
  const snow = profile.palette === 'snow';
  const rockColors = snow
    ? ['#7c8b98', '#5f6e7c', '#98a7b3', '#6a7a88']
    : ['#c05038', '#d97e4a', '#a63c2e', '#b5573c'];
  const bushColors = snow
    ? ['#7f9a86', '#94aa9a', '#6c8a74']
    : ['#5da95a', '#7bbf67', '#4c9a52'];

  const specs: ScatterSpec[] = [
    { count: 760, geometry: rockGeo, colors: rockColors,
      minScale: 0.5, maxScale: 2.6, maxSlope: 1.2, yOffset: -0.15, forest: 'any' },
    { count: snow ? 0 : 420, geometry: cactusGeo, colors: ['#3f9b4f', '#2f8040', '#4dae5c'],
      minScale: 0.5, maxScale: 1.25, maxSlope: 0.35, yOffset: -0.1, forest: 'outside' },
    { count: 460, geometry: bushGeo, colors: bushColors,
      minScale: 0.6, maxScale: 1.4, maxSlope: 0.4, yOffset: -0.1, forest: 'any' },
    { count: snow ? 0 : 280, geometry: flowerGeo, colors: ['#d977a8', '#c95f92', '#e08fba'],
      minScale: 0.6, maxScale: 1.2, maxSlope: 0.35, yOffset: -0.05, forest: 'outside' },
  ];

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const axis = new THREE.Vector3(0, 1, 0);
  let rocks: RockField | null = null;
  const rockList: { x: number; z: number; radius: number; index: number }[] = [];

  for (const spec of specs) {
    if (spec.count === 0) continue;
    const isRock = spec.geometry === rockGeo;
    const capacity = spec.count + (isRock ? ROCK_SPARE_SLOTS : 0);
    const mesh = new THREE.InstancedMesh(
      spec.geometry,
      new THREE.MeshLambertMaterial({ flatShading: true }),
      capacity,
    );
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard < spec.count * 30) {
      guard++;
      const x = (rng() - 0.5) * 420;
      const z = (rng() - 0.5) * 420;
      const y = heightAt(x, z);
      if (y < WATER_LEVEL + 0.6) continue;
      if (slopeAt(x, z) > spec.maxSlope) continue;
      if (blocked(x, z)) continue;
      if (spec.forest === 'outside' && forestDensity(x, z) > FOREST_THRESHOLD) continue;
      const s = spec.minScale + rng() * (spec.maxScale - spec.minScale);
      quat.setFromAxisAngle(axis, rng() * Math.PI * 2);
      scale.set(s, s * (0.85 + rng() * 0.3), s);
      matrix.compose(new THREE.Vector3(x, y + spec.yOffset, z), quat, scale);
      mesh.setMatrixAt(placed, matrix);
      color.set(spec.colors[Math.floor(rng() * spec.colors.length)]);
      mesh.setColorAt(placed, color);
      if (isRock && s >= BOULDER_MIN_SCALE) rockList.push({ x, z, radius: s * 0.9, index: placed });
      placed++;
    }
    mesh.count = placed;
    mesh.castShadow = true;
    group.add(mesh);
    if (isRock) {
      const field = new RockField(mesh, placed, spec.colors);
      for (const b of rockList) field.add(b.x, b.z, b.radius, b.index);
      // Aglomerados fixos do mapa (a garganta de Boulder Pass, por exemplo).
      for (const fall of profile.rockfalls ?? []) {
        for (let i = 0; i < fall.count; i++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * fall.r;
          const fx = fall.x + Math.cos(a) * d;
          const fz = fall.z + Math.sin(a) * d;
          if (heightAt(fx, fz) < WATER_LEVEL + 0.6) continue;
          field.spawn(fx, fz, 1.7 + rng() * 0.9, i);
        }
      }
      rocks = field;
    }
  }

  group.add(buildPineForest(rng, blocked));

  if (!rocks) throw new Error('campo de pedras não inicializado');
  return { group, rocks };
}

/** Pinheiros agrupados nos bolsões de floresta: tronco + duas copas cônicas. */
function buildPineForest(
  rng: () => number,
  blocked: (x: number, z: number) => boolean,
): THREE.Group {
  const group = new THREE.Group();
  const target = 620;

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1.7, 10);
  trunkGeo.translate(0, 0.85, 0);
  const crownGeo = new THREE.ConeGeometry(1.55, 3.3, 10);
  crownGeo.translate(0, 2.95, 0);
  const topGeo = new THREE.ConeGeometry(1.1, 2.5, 10);
  topGeo.translate(0, 4.65, 0);

  const trunks = new THREE.InstancedMesh(
    trunkGeo, new THREE.MeshLambertMaterial({ color: '#6b4a2f', flatShading: true }), target);
  const crowns = new THREE.InstancedMesh(
    crownGeo, new THREE.MeshLambertMaterial({ flatShading: true }), target);
  const tops = new THREE.InstancedMesh(
    topGeo, new THREE.MeshLambertMaterial({ flatShading: true }), target);

  const snow = getTerrainProfile().palette === 'snow';
  const greens = snow
    ? ['#3d6b55', '#4f7d63', '#2f5a46', '#5d8a70']
    : ['#2f7a3c', '#3f9b4f', '#276b34', '#48a557'];
  const threshold = snow ? FOREST_THRESHOLD - 0.08 : FOREST_THRESHOLD;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const axis = new THREE.Vector3(0, 1, 0);

  let placed = 0;
  let guard = 0;
  while (placed < target && guard < target * 60) {
    guard++;
    const x = (rng() - 0.5) * 400;
    const z = (rng() - 0.5) * 400;
    const density = forestDensity(x, z);
    if (density < threshold) continue;
    // Mais denso no miolo do bosque, ralo nas bordas.
    if (rng() > (density - threshold) * 7) continue;
    const y = heightAt(x, z);
    if (y < WATER_LEVEL + 1.5) continue;
    if (slopeAt(x, z) > 0.42) continue;
    if (blocked(x, z)) continue;

    const s = 0.7 + rng() * 0.85;
    quat.setFromAxisAngle(axis, rng() * Math.PI * 2);
    scale.set(s, s * (0.85 + rng() * 0.4), s);
    matrix.compose(new THREE.Vector3(x, y - 0.15, z), quat, scale);
    trunks.setMatrixAt(placed, matrix);
    crowns.setMatrixAt(placed, matrix);
    tops.setMatrixAt(placed, matrix);
    color.set(greens[Math.floor(rng() * greens.length)]);
    crowns.setColorAt(placed, color);
    tops.setColorAt(placed, color);
    placed++;
  }

  for (const mesh of [trunks, crowns, tops]) {
    mesh.count = placed;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/** Tronco + dois braços fundidos numa BufferGeometry. */
function buildCactusGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.32, 0.4, 2.5, 10);
  trunk.translate(0, 1.25, 0);
  const armL = new THREE.CylinderGeometry(0.16, 0.18, 0.9, 8);
  armL.rotateZ(Math.PI / 2);
  armL.translate(-0.55, 1.55, 0);
  const tipL = new THREE.CylinderGeometry(0.14, 0.16, 0.55, 8);
  tipL.translate(-0.95, 1.85, 0);
  const armR = new THREE.CylinderGeometry(0.16, 0.18, 0.75, 8);
  armR.rotateZ(-Math.PI / 2);
  armR.translate(0.5, 1.9, 0);
  const tipR = new THREE.CylinderGeometry(0.14, 0.16, 0.45, 8);
  tipR.translate(0.85, 2.15, 0);

  const parts = [trunk, armL, tipL, armR, tipR];
  const positions: number[] = [];
  const normals: number[] = [];
  for (const part of parts) {
    const pos = part.attributes.position;
    const nor = part.attributes.normal;
    const idx = part.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        const vi = idx.getX(i);
        positions.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
        normals.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      }
    }
    part.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}
