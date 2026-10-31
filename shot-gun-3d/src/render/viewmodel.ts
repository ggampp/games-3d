import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { WeaponId } from '../weapons/catalog.ts';

type V3 = [number, number, number];

const TARGET_LEN: Record<WeaponId, number> = {
  bullet: 0.3,
  shotgun: 0.62,
  rifle: 0.7,
  bomb: 0.17,
  laser: 0.4,
  water: 0.42,
  hook: 0.48,
  detonator: 0.18,
};

/** Yaw extra depois de alinhar o eixo longo em Z. O rifle do Fal já nasce apontando -Z. */
const EXTRA_YAW: Record<WeaponId, number> = {
  bullet: Math.PI,
  shotgun: Math.PI,
  rifle: 0,
  bomb: 0,
  laser: Math.PI,
  water: Math.PI,
  hook: Math.PI,
  detonator: 0,
};

/**
 * Escala do viewmodel inteiro. Tudo é modelado em "metros de arma" e encolhido
 * para perto da câmera: a perspectiva fica igual, mas a arma quase não entra
 * nas paredes quando o jogador encosta nelas.
 */
const VM_SCALE = 0.5;
/** Onde fica o centro da arma (espaço da câmera, antes da escala). */
const BASE: V3 = [0.14, -0.15, -0.4];
/** As armas são menores que as reais; a mão acompanha. */
const HAND_SCALE = 0.72;

/**
 * Pose por arma. `gun` desloca/gira a arma dentro do rig; `right`/`left` são o
 * ponto de pega de cada mão e o eixo do que ela segura (cabo, guarda-mão), no
 * espaço LOCAL da arma — medidos no perfil de cada GLB.
 */
interface HandPose {
  at: V3;
  axis: V3;
}
interface WeaponPose {
  gun: { p: V3; r: V3 };
  right: HandPose;
  left: HandPose | null;
}

const POSES: Record<WeaponId, WeaponPose> = {
  bullet: {
    gun: { p: [0.01, 0.01, -0.08], r: [0.02, 0.06, 0] },
    right: { at: [0, -0.028, 0.105], axis: [0, 1, -0.55] },
    left: null,
  },
  shotgun: {
    gun: { p: [0, 0, 0], r: [0.015, 0.05, 0] },
    right: { at: [0, -0.012, 0.15], axis: [0, 1, -0.5] },
    left: { at: [0, 0.03, -0.12], axis: [0, 0.05, -1] },
  },
  rifle: {
    gun: { p: [0, 0, -0.03], r: [0.015, 0.05, 0] },
    right: { at: [0, -0.016, 0.15], axis: [0, 1, -0.5] },
    left: { at: [0, 0.042, -0.14], axis: [0, 0.05, -1] },
  },
  bomb: {
    gun: { p: [0.0, 0.04, -0.06], r: [0.15, 0, -0.3] },
    right: { at: [0, -0.03, 0], axis: [0, 1, 0] },
    left: null,
  },
  laser: {
    gun: { p: [0, 0.01, -0.02], r: [0.015, 0.05, 0] },
    right: { at: [0, -0.08, 0.17], axis: [0, 1, -0.35] },
    left: { at: [0, 0.02, -0.12], axis: [0, 0.05, -1] },
  },
  water: {
    // O GLB nasce com o bico para cima: inclina para a frente.
    gun: { p: [0, 0, -0.02], r: [-1.05, 0.05, 0] },
    right: { at: [0, -0.14, 0], axis: [0, 0.8, 0.7] },
    left: { at: [0, 0.094, -0.077], axis: [0, 0.9, -0.46] },
  },
  hook: {
    gun: { p: [0, 0.02, -0.02], r: [0.015, 0.05, 0] },
    right: { at: [0, -0.08, 0.17], axis: [0, 1, -0.35] },
    left: { at: [0, 0.045, -0.12], axis: [0, 0.05, -1] },
  },
  detonator: {
    gun: { p: [-0.03, 0.0, -0.04], r: [0.25, 0.35, 0] },
    right: { at: [0.075, -0.01, 0], axis: [0, 1, 0.15] },
    left: { at: [-0.075, -0.01, 0], axis: [0, 1, 0.15] },
  },
};

/** Cotovelos fora da tela (espaço do rig): os antebraços saem do canto. */
const RIGHT_ELBOW: V3 = [0.16, -0.15, 0.5];
const LEFT_ELBOW: V3 = [-0.2, -0.36, 0.12];

function box(
  parent: THREE.Group,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  mat: THREE.Material,
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function makeMats() {
  return {
    metal: new THREE.MeshStandardMaterial({ color: 0x4a5160, roughness: 0.32, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.4, metalness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x7a4a28, roughness: 0.82, metalness: 0.05 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.7 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x4ec4ff, emissive: 0x1aa0ff, emissiveIntensity: 1.8, roughness: 0.25 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb43028, roughness: 0.7, metalness: 0.1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xa8704e, roughness: 0.75, metalness: 0, flatShading: true }),
    glove: new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.68, metalness: 0.02, flatShading: true }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.92, metalness: 0, flatShading: true }),
    cuff: new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.9, metalness: 0, flatShading: true }),
  };
}
type Mats = ReturnType<typeof makeMats>;

/**
 * Mão fechada (luva sem dedos) em torno de um cabo que passa pelo eixo Y local.
 * Costas da mão em +X, dedos dão a volta pela frente (−Z), punho em +Z.
 */
function makeHand(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const t = 0.019;
  const d = 0.021 + t / 2;
  const ys = [0.03, 0.009, -0.012, -0.032];
  // costas da mão + palma (a parte que encosta no cabo fica escondida nele)
  box(g, 0.032, 0.088, 0.078, d + 0.006, -0.001, 0.026, m.glove, 'back');
  box(g, 0.05, 0.082, 0.022, 0.006, -0.002, d + 0.01, m.glove, 'palm');
  box(g, 0.036, 0.07, 0.03, 0.012, -0.012, 0.062, m.glove, 'heel');
  ys.forEach((y, i) => {
    const w = i === 3 ? 0.017 : 0.02;
    box(g, t + 0.004, w, 0.034, d + 0.002, y, -0.012, m.glove, `knuckle-${i}`);
    box(g, 0.05, w, t, 0.002, y, -d, m.skin, `finger-${i}`);
    box(g, t, w - 0.002, 0.026, -d + 0.003, y, -0.008, m.skin, `tip-${i}`);
  });
  // polegar por cima, do lado esquerdo do cabo
  const th0 = box(g, 0.024, 0.024, 0.05, -d + 0.006, 0.046, 0.026, m.glove, 'thumb-0');
  th0.rotation.y = -0.25;
  const th1 = box(g, 0.021, 0.021, 0.034, -d - 0.002, 0.05, -0.012, m.skin, 'thumb-1');
  th1.rotation.y = 0.15;
  // pulso / punho da luva
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.045, 8), m.glove);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0.016, -0.006, 0.086);
  g.add(cuff);
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.frustumCulled = false; } });
  return g;
}

/** Antebraço (pele) + manga com dobra, esticados de punho a cotovelo. */
class Arm {
  readonly hand: THREE.Group;
  private forearm: THREE.Mesh;
  private sleeve: THREE.Mesh;
  private roll: THREE.Mesh;
  private readonly mirror: boolean;

  constructor(parent: THREE.Group, m: Mats, mirror: boolean) {
    this.mirror = mirror;
    this.hand = makeHand(m);
    this.hand.scale.set(mirror ? -HAND_SCALE : HAND_SCALE, HAND_SCALE, HAND_SCALE);
    this.forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.034, 1, 8, 1, true), m.skin);
    this.sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.047, 1, 9), m.sleeve);
    this.roll = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1, 9), m.cuff);
    for (const o of [this.forearm, this.sleeve, this.roll]) { o.frustumCulled = false; parent.add(o); }
    parent.add(this.hand);
  }

  set visible(v: boolean) {
    this.hand.visible = v;
    this.forearm.visible = v;
    this.sleeve.visible = v;
    this.roll.visible = v;
  }

  /** Posiciona a mão em `at` segurando `axis`, com o braço indo até `elbow`. */
  place(at: THREE.Vector3, axis: THREE.Vector3, elbow: THREE.Vector3): void {
    const y = axis.clone().normalize();
    const toElbow = elbow.clone().sub(at);
    const z = toElbow.clone().addScaledVector(y, -toElbow.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    // A mão esquerda é a direita espelhada pelo scale.x = -1; a rotação é a mesma.
    this.hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.hand.position.copy(at);
    const wrist = new THREE.Vector3(0.016 * (this.mirror ? -1 : 1), -0.006, 0.1)
      .multiplyScalar(HAND_SCALE).applyQuaternion(this.hand.quaternion).add(at);
    stretch(this.forearm, wrist, elbow, 0);
    const len = wrist.distanceTo(elbow);
    const sleeveStart = wrist.clone().lerp(elbow, Math.min(0.5, 0.075 / Math.max(len, 1e-3)));
    const past = elbow.clone().addScaledVector(elbow.clone().sub(wrist).normalize(), 0.2);
    stretch(this.sleeve, sleeveStart, past, 0);
    const rollEnd = sleeveStart.clone().lerp(past, 0.1);
    stretch(this.roll, sleeveStart.clone().lerp(past, -0.02), rollEnd, 0);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
/** Cilindro de altura 1 esticado de `a` até `b` (topo do cilindro em `a`). */
function stretch(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, _pad: number): void {
  const dir = a.clone().sub(b);
  const len = dir.length();
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(len, 1e-4), 1);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

function prepareWeapon(scene: THREE.Object3D, id: WeaponId): THREE.Group {
  const root = new THREE.Group();
  root.name = `vm:${id}`;
  root.add(scene);

  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = false;
    obj.frustumCulled = false;
  });

  scene.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(scene);
  const size = box0.getSize(new THREE.Vector3());
  const center = box0.getCenter(new THREE.Vector3());
  scene.position.sub(center);

  if (id !== 'bomb') {
    if (size.x >= size.y && size.x >= size.z) scene.rotation.y = Math.PI / 2;
    else if (size.y >= size.x && size.y >= size.z) scene.rotation.x = Math.PI / 2;
    scene.rotation.y += EXTRA_YAW[id];
  }

  scene.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  const fittedSize = fitted.getSize(new THREE.Vector3());
  const dim = id === 'bomb'
    ? Math.max(fittedSize.y, 1e-4)
    : Math.max(fittedSize.x, fittedSize.y, fittedSize.z, 1e-4);
  root.scale.setScalar(TARGET_LEN[id] / dim);

  root.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(root);
  root.position.sub(finalBox.getCenter(new THREE.Vector3()));
  // Envolve num grupo neutro: a pose por arma mexe no holder, não no ajuste do GLB.
  const holder = new THREE.Group();
  holder.name = `vm-holder:${id}`;
  holder.add(root);
  return holder;
}

export interface ViewmodelMotion {
  swayX: number;
  swayY: number;
  /** 0..1 velocidade no chão. */
  speed: number;
  running: boolean;
  crouched: boolean;
  grounded: boolean;
}

export class Viewmodel {
  /** Vai na câmera. A posição é controlada aqui (não mexer de fora). */
  readonly group = new THREE.Group();
  private rig = new THREE.Group();
  private guns = new Map<WeaponId, THREE.Group>();
  private right: Arm;
  private left: Arm;
  private fill: THREE.PointLight;
  private kick = 0;
  private pump = 0;
  private throwT = 0;
  private switchT = 0;
  private bob = 0;
  private time = 0;
  private runBlend = 0;
  private airBlend = 0;
  private active: WeaponId = 'shotgun';
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpE = new THREE.Vector3();

  /** 0..1 durante a recarga: a arma desce e gira. */
  reloadT = 0;

  constructor() {
    this.group.name = 'viewmodel';
    this.group.scale.setScalar(VM_SCALE);
    this.group.add(this.rig);
    const m = makeMats();

    const pistol = new THREE.Group();
    box(pistol, 0.05, 0.09, 0.22, 0, 0.04, -0.08, m.dark, 'barrel');
    box(pistol, 0.07, 0.08, 0.12, 0, 0.02, 0.06, m.metal, 'receiver');
    box(pistol, 0.05, 0.14, 0.07, 0, -0.08, 0.1, m.wood, 'grip');
    this.guns.set('bullet', pistol);

    const shotgun = new THREE.Group();
    box(shotgun, 0.06, 0.06, 0.42, 0, 0.05, -0.12, m.metal, 'barrel');
    box(shotgun, 0.08, 0.08, 0.16, 0, 0.03, 0.08, m.dark, 'receiver');
    box(shotgun, 0.07, 0.06, 0.14, 0, -0.02, 0.0, m.wood, 'pump');
    box(shotgun, 0.06, 0.16, 0.08, 0, -0.1, 0.14, m.wood, 'stock');
    this.guns.set('shotgun', shotgun);

    const rifle = new THREE.Group();
    box(rifle, 0.045, 0.045, 0.5, 0, 0.06, -0.14, m.metal, 'barrel');
    box(rifle, 0.07, 0.09, 0.18, 0, 0.03, 0.08, m.brass, 'receiver');
    box(rifle, 0.05, 0.12, 0.06, 0, -0.06, 0.04, m.wood, 'lever');
    box(rifle, 0.07, 0.14, 0.16, 0, -0.08, 0.16, m.wood, 'stock');
    this.guns.set('rifle', rifle);

    const bomb = new THREE.Group();
    box(bomb, 0.08, 0.22, 0.08, 0, 0.0, 0.0, m.red, 'stick');
    box(bomb, 0.03, 0.08, 0.03, 0, 0.14, 0.0, m.wood, 'fuse');
    this.guns.set('bomb', bomb);

    const laser = new THREE.Group();
    box(laser, 0.07, 0.07, 0.36, 0, 0.04, -0.1, m.dark, 'barrel');
    box(laser, 0.1, 0.1, 0.14, 0, 0.04, 0.08, m.brass, 'body');
    box(laser, 0.08, 0.08, 0.1, 0, 0.04, 0.0, m.glow, 'chamber');
    box(laser, 0.05, 0.14, 0.07, 0, -0.08, 0.12, m.dark, 'grip');
    this.guns.set('laser', laser);

    const water = new THREE.Group();
    box(water, 0.06, 0.06, 0.34, 0, 0.03, -0.1, m.brass, 'barrel');
    box(water, 0.12, 0.12, 0.14, 0, 0.1, 0.06, m.glow, 'tank');
    box(water, 0.05, 0.14, 0.07, 0, -0.08, 0.1, m.wood, 'grip');
    this.guns.set('water', water);

    const hook = new THREE.Group();
    box(hook, 0.07, 0.07, 0.3, 0, 0.04, -0.08, m.dark, 'barrel');
    box(hook, 0.12, 0.03, 0.03, 0, 0.04, -0.25, m.metal, 'prongs');
    box(hook, 0.06, 0.14, 0.07, 0, -0.08, 0.1, m.wood, 'grip');
    this.guns.set('hook', hook);

    const det = new THREE.Group();
    box(det, 0.14, 0.1, 0.12, 0, -0.02, 0, m.wood, 'box');
    box(det, 0.03, 0.12, 0.03, 0, 0.08, 0, m.brass, 'plunger');
    this.guns.set('detonator', det);

    for (const [id, g] of this.guns) {
      g.visible = id === this.active;
      this.rig.add(g);
    }

    this.right = new Arm(this.rig, m, false);
    this.left = new Arm(this.rig, m, true);

    // Luz de preenchimento curta: ilumina a arma e as mãos mesmo na sombra.
    this.fill = new THREE.PointLight(0xfff0dd, 0.35, 0.9, 1.5);
    this.fill.position.set(-0.1, 0.25, 0.1);
    this.group.add(this.fill);
    this.applyPose();
  }

  async loadGenerated(): Promise<void> {
    const loader = new GLTFLoader();
    const base = `${import.meta.env.BASE_URL}assets/models/`;
    const ids: WeaponId[] = ['bullet', 'shotgun', 'rifle', 'bomb', 'laser', 'water', 'hook', 'detonator'];
    await Promise.all(ids.map(async (id) => {
      try {
        const gltf = await loader.loadAsync(`${base}${id}.glb`);
        const prepared = prepareWeapon(gltf.scene, id);
        const old = this.guns.get(id);
        if (old) this.rig.remove(old);
        prepared.visible = id === this.active;
        this.guns.set(id, prepared);
        this.rig.add(prepared);
      } catch {
        // Mantém os blocos procedurais se o GLB não existir.
      }
    }));
    this.applyPose();
  }

  setWeapon(id: WeaponId): void {
    if (id !== this.active) this.switchT = 1;
    this.active = id;
    for (const [wid, g] of this.guns) g.visible = wid === id;
    this.pump = 0;
    this.throwT = 0;
    this.applyPose();
  }

  cloneForWorld(id: WeaponId): THREE.Object3D | null {
    const src = this.guns.get(id);
    if (!src) return null;
    const clone = src.clone(true);
    clone.visible = true;
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.frustumCulled = true;
      obj.castShadow = true;
    });
    return clone;
  }

  fireKick(): void {
    this.kick = 1;
    if (this.active === 'shotgun' || this.active === 'rifle') this.pump = 1;
    if (this.active === 'bomb' || this.active === 'detonator') this.throwT = 1;
  }

  /** Ajuste fino pelo console (diagnóstico): pose por arma, base e cotovelos. */
  debugPose(id: WeaponId, patch: Partial<WeaponPose> & { base?: V3; rightElbow?: V3; leftElbow?: V3 }): void {
    const { base, rightElbow, leftElbow, ...rest } = patch;
    if (base) BASE.splice(0, 3, ...base);
    if (rightElbow) RIGHT_ELBOW.splice(0, 3, ...rightElbow);
    if (leftElbow) LEFT_ELBOW.splice(0, 3, ...leftElbow);
    Object.assign(POSES[id], rest);
    this.applyPose();
  }

  private applyPose(): void {
    const pose = POSES[this.active];
    this.left.visible = pose.left !== null;
  }

  update(dt: number, motion?: ViewmodelMotion): void {
    const mv = motion ?? { swayX: 0, swayY: 0, speed: 0, running: false, crouched: false, grounded: true };
    this.time += dt;
    this.kick = Math.max(0, this.kick - dt * 6);
    this.switchT = Math.max(0, this.switchT - dt * 3.2);
    this.throwT = Math.max(0, this.throwT - dt * 2.4);
    // Bombeamento: espera o recuo e puxa a telha para trás.
    if (this.pump > 0) this.pump = Math.max(0, this.pump - dt * (this.active === 'rifle' ? 2.6 : 1.9));
    const pumpK = this.pump > 0 && this.pump < 0.8 ? Math.sin(((0.8 - this.pump) / 0.8) * Math.PI) : 0;

    const moving = mv.grounded ? mv.speed : 0;
    this.bob += dt * (6 + moving * 6) * (moving > 0.05 ? 1 : 0.3);
    this.runBlend += ((mv.running && moving > 0.4 ? 1 : 0) - this.runBlend) * Math.min(1, dt * 8);
    this.airBlend += ((mv.grounded ? 0 : 1) - this.airBlend) * Math.min(1, dt * 6);

    const r = Math.sin(this.reloadT * Math.PI);
    const sw = this.switchT * this.switchT;
    const breathe = Math.sin(this.time * 1.6) * 0.004;
    const bobX = Math.cos(this.bob) * 0.012 * moving;
    const bobY = Math.abs(Math.sin(this.bob)) * 0.014 * moving;

    const x = BASE[0] + mv.swayX + bobX - this.runBlend * 0.03;
    const y = BASE[1] + mv.swayY - bobY + breathe - (mv.crouched ? 0.012 : 0) - sw * 0.28 - this.runBlend * 0.04 + this.airBlend * 0.015;
    const z = BASE[2] + this.kick * 0.07;
    this.group.position.set(x * VM_SCALE, y * VM_SCALE, z * VM_SCALE);

    this.rig.rotation.x = this.kick * 0.14 + r * 0.5 - sw * 0.6 - this.runBlend * 0.32 - this.throwT * 0.5;
    this.rig.rotation.y = this.runBlend * 0.55;
    this.rig.rotation.z = r * 0.35 + this.runBlend * 0.25 + bobX * 1.5;

    const pose = POSES[this.active];
    // A arma acompanha um pouco o bombeamento / arremesso.
    const gun = this.guns.get(this.active);
    if (!gun) return;
    gun.position.set(...pose.gun.p);
    gun.rotation.set(...pose.gun.r);
    if (this.active === 'shotgun') gun.rotation.z -= pumpK * 0.06;
    if (this.active === 'bomb') gun.position.z -= this.throwT * 0.08;
    gun.updateMatrix();

    const at = this.tmpA.set(...pose.right.at);
    if (this.active === 'rifle') at.y -= pumpK * 0.03; // alavanca
    at.applyMatrix4(gun.matrix);
    this.right.place(at, this.tmpB.set(...pose.right.axis).transformDirection(gun.matrix), this.tmpE.set(...RIGHT_ELBOW));
    if (pose.left) {
      const la = this.tmpA.set(...pose.left.at);
      if (this.active === 'shotgun') la.z += pumpK * 0.075; // telha da escopeta
      la.y -= r * 0.12; // solta para recarregar
      la.x -= r * 0.04;
      la.applyMatrix4(gun.matrix);
      this.left.place(la, this.tmpB.set(...pose.left.axis).transformDirection(gun.matrix), this.tmpE.set(...LEFT_ELBOW));
    }
  }
}
