import RAPIER from '@dimforge/rapier3d-compat';
import { MATERIALS, VOXEL_SIZE, worldCenter, groupKind, groupId } from '../voxels/types.ts';
import type { GroupKind, Voxel, VoxelGroup } from '../voxels/types.ts';
import { VoxelGrid } from '../voxels/grid.ts';
import { connectedComponents, greedyBoxes, isSupported } from '../voxels/connectivity.ts';
import { GAZEBO, DECK_TOP, PLAZA_TOP, PLAY_RADIUS } from '../voxels/town.ts';

type RigidBody = InstanceType<typeof RAPIER.RigidBody>;
type Collider = InstanceType<typeof RAPIER.Collider>;
type ImpulseJoint = InstanceType<typeof RAPIER.ImpulseJoint>;
type Vec = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };

export interface Pose {
  x: number; y: number; z: number;
  qx: number; qy: number; qz: number; qw: number;
}

export interface Binding {
  id: number;
  body: RigidBody;
  voxels: Voxel[];
  local: Map<number, Vec>;
  dynamic: boolean;
  kind: GroupKind;
  group: VoxelGroup;
  /** Precisa de ao menos um sync visual mesmo se dormindo. */
  fresh: boolean;
  /** Raio da esfera envolvente em torno do centro do corpo. */
  radius: number;
}

interface JointRec {
  joint: ImpulseJoint;
  a: Binding;
  b: Binding;
  key: string;
}

interface DebrisPiece {
  body: RigidBody;
  parts: { mat: Voxel['mat']; local: Vec }[];
  born: number;
}

interface Bomb {
  body: RigidBody;
  born: number;
  remote: boolean;
}

const HALF = VOXEL_SIZE * 0.5;
const FIXED_DT = 1 / 60;
const DEBRIS_CAP = 220;
const DEBRIS_PER_BATCH = 36;
const DEBRIS_LIFE = 20;
const CHAIN_LINK_VOXELS = 2;

export const COL_WORLD = 0x0001;
export const COL_CHAIN = 0x0002;
export const COL_DEBRIS = 0x0004;
export const COL_BOMB = 0x0008;
export const COL_GROUND = 0x0010;
export const COL_PLAYER = 0x0020;
export const COL_FENCE = 0x0040;

export function colGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

function rotate(q: Quat, v: Vec): Vec {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

function comOf(voxels: Voxel[]): Vec {
  let x = 0, y = 0, z = 0;
  for (const v of voxels) {
    const c = worldCenter(v.ix, v.iy, v.iz);
    x += c.x; y += c.y; z += c.z;
  }
  const n = Math.max(1, voxels.length);
  return { x: x / n, y: y / n, z: z / n };
}

/** Camada mais alta cujo voxel ainda conta como "apoiado no chão/deck". */
export const GROUND_INDEX = Math.round(DECK_TOP / VOXEL_SIZE);

export class PhysicsSim {
  readonly world: InstanceType<typeof RAPIER.World>;
  private accumulator = 0;
  private bindings = new Map<number, Binding>();
  private nextBindingId = 1;
  private voxelToBinding = new Map<number, Binding>();
  private joints: JointRec[] = [];
  private debris: DebrisPiece[] = [];
  private bombs: Bomb[] = [];
  private now = 0;
  private grid: VoxelGrid | null = null;

  private player: { body: RigidBody; collider: Collider; controller: InstanceType<typeof RAPIER.KinematicCharacterController> } | null = null;
  /** Alvos: deslocamento vertical animado pelo jogo. */
  private targets = new Map<string, { binding: Binding; base: Vec; offset: number }>();

  private constructor(world: InstanceType<typeof RAPIER.World>) {
    this.world = world;
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(48, 0.25, 48).setFriction(0.9).setCollisionGroups(colGroups(COL_GROUND, 0xffff)),
      ground,
    );
    const deck = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, DECK_TOP / 2, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(DECK_TOP / 2, 3.5).setFriction(0.85).setCollisionGroups(colGroups(COL_GROUND, 0xffff)),
      deck,
    );
    const plaza = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(GAZEBO.x, PLAZA_TOP / 2, GAZEBO.z));
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(PLAZA_TOP / 2, GAZEBO.radius).setFriction(0.85).setCollisionGroups(colGroups(COL_GROUND, 0xffff)),
      plaza,
    );
    // Cerca invisível: só o jogador colide.
    const fence = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const len = (Math.PI * 2 * PLAY_RADIUS) / segs;
      const q = { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) };
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.2, 4, len / 2 + 0.2)
          .setTranslation(Math.cos(a) * PLAY_RADIUS, 4, -Math.sin(a) * PLAY_RADIUS)
          .setRotation(q)
          .setCollisionGroups(colGroups(COL_FENCE, COL_PLAYER)),
        fence,
      );
    }
  }

  static async create(): Promise<PhysicsSim> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = FIXED_DT;
    world.numSolverIterations = 4;
    return new PhysicsSim(world);
  }

  get timestep(): number {
    return FIXED_DT;
  }

  // ---------------------------------------------------------------- build

  /** Reconstrói tudo do zero (início e reset). */
  rebuild(grid: VoxelGrid): void {
    this.grid = grid;
    this.clearAll();
    const byGroup = new Map<VoxelGroup, Voxel[]>();
    for (const v of grid.values()) {
      const list = byGroup.get(v.group);
      if (list) list.push(v);
      else byGroup.set(v.group, [v]);
    }
    const keys = new Set<string>();
    for (const [group, voxels] of byGroup) {
      this.createBindingsFor(group, voxels, null);
      const kind = groupKind(group);
      if (kind !== 'structure' && kind !== 'loose') keys.add(this.jointKey(group));
    }
    for (const key of keys) this.attachJointsFor(key);
  }

  /**
   * Remove voxels já apagados da grade e reconstrói só os corpos afetados,
   * preservando pose e velocidade do que já estava se mexendo.
   */
  removeVoxels(removed: Voxel[]): { changed: Voxel[]; newlyFallen: number } {
    const grid = this.grid;
    if (!grid || removed.length === 0) return { changed: [], newlyFallen: 0 };
    const affected = new Set<Binding>();
    for (const v of removed) {
      const b = this.voxelToBinding.get(v.id);
      if (b) affected.add(b);
    }
    const keys = new Set<string>();
    const changed: Voxel[] = [];
    let newlyFallen = 0;
    for (const b of affected) {
      const rest = b.voxels.filter((v) => grid.get(v.ix, v.iy, v.iz) === v);
      const old = this.snapshot(b);
      const wasDynamic = b.dynamic;
      keys.add(this.jointKey(b.group));
      for (const j of this.detachJoints(b)) keys.add(j);
      this.destroyBinding(b);
      if (rest.length === 0) continue;
      this.createBindingsFor(b.group, rest, wasDynamic ? old : null);
      for (const v of rest) {
        changed.push(v);
        if (!wasDynamic && b.kind === 'structure' && this.isDynamic(v)) newlyFallen += 1;
      }
    }
    for (const key of keys) this.attachJointsFor(key);
    return { changed, newlyFallen };
  }

  private snapshot(b: Binding): { com: Vec; t: Vec; r: Quat; lv: Vec; av: Vec } {
    const t = b.body.translation();
    const r = b.body.rotation();
    return {
      com: comOf(b.voxels),
      t: { x: t.x, y: t.y, z: t.z },
      r: { x: r.x, y: r.y, z: r.z, w: r.w },
      lv: b.dynamic ? { ...b.body.linvel() } : { x: 0, y: 0, z: 0 },
      av: b.dynamic ? { ...b.body.angvel() } : { x: 0, y: 0, z: 0 },
    };
  }

  private createBindingsFor(
    group: VoxelGroup,
    voxels: Voxel[],
    inherit: { com: Vec; t: Vec; r: Quat; lv: Vec; av: Vec } | null,
  ): void {
    const kind = groupKind(group);
    if (kind === 'structure') {
      const comps = connectedComponents(this.grid!, voxels);
      for (const comp of comps) {
        const dynamic = inherit !== null || !isSupported(comp, GROUND_INDEX);
        this.makeBinding(comp, group, kind, dynamic, inherit);
      }
      return;
    }
    if (kind === 'target') {
      const b = this.makeBinding(voxels, group, kind, false, null, true);
      const t = b.body.translation();
      this.targets.set(group, { binding: b, base: { x: t.x, y: t.y, z: t.z }, offset: 0 });
      return;
    }
    if (kind === 'chain') {
      // Elos de CHAIN_LINK_VOXELS voxels, de cima para baixo.
      const sorted = voxels.slice().sort((a, b) => b.iy - a.iy);
      for (let i = 0; i < sorted.length; i += CHAIN_LINK_VOXELS) {
        const link = sorted.slice(i, i + CHAIN_LINK_VOXELS);
        // Ao rebuild parcial, preserva a pose só do elo cujos voxels batem.
        this.makeBinding(link, group, kind, true, inherit);
      }
      return;
    }
    this.makeBinding(voxels, group, kind, true, inherit);
  }

  private makeBinding(
    voxels: Voxel[],
    group: VoxelGroup,
    kind: GroupKind,
    dynamic: boolean,
    inherit: { com: Vec; t: Vec; r: Quat; lv: Vec; av: Vec } | null,
    kinematic = false,
  ): Binding {
    const com = comOf(voxels);
    const light = kind === 'chain' || kind === 'hang';
    let desc: InstanceType<typeof RAPIER.RigidBodyDesc>;
    if (kinematic) {
      desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(com.x, com.y, com.z);
    } else if (dynamic) {
      desc = RAPIER.RigidBodyDesc.dynamic()
        .setLinearDamping(light ? 3.2 : kind === 'spin' ? 0.2 : 0.6)
        .setAngularDamping(light ? 4.5 : kind === 'spin' ? 0.15 : 1.2)
        .setCcdEnabled(false)
        .setCanSleep(kind !== 'spin');
      if (inherit) {
        const off = rotate(inherit.r, { x: com.x - inherit.com.x, y: com.y - inherit.com.y, z: com.z - inherit.com.z });
        desc.setTranslation(inherit.t.x + off.x, inherit.t.y + off.y, inherit.t.z + off.z)
          .setRotation(inherit.r)
          .setLinvel(inherit.lv.x, inherit.lv.y, inherit.lv.z)
          .setAngvel(inherit.av);
      } else {
        desc.setTranslation(com.x, com.y, com.z);
      }
    } else {
      desc = RAPIER.RigidBodyDesc.fixed().setTranslation(com.x, com.y, com.z);
    }
    const body = this.world.createRigidBody(desc);

    let membership = COL_WORLD;
    let filter = 0xffff;
    if (kind === 'chain' || kind === 'hang') {
      membership = COL_CHAIN;
      filter = COL_GROUND | COL_DEBRIS | COL_BOMB;
    } else if (kind === 'spin') {
      membership = COL_CHAIN;
      filter = COL_GROUND | COL_DEBRIS | COL_BOMB | COL_PLAYER;
    }
    const groups = colGroups(membership, filter);

    const local = new Map<number, Vec>();
    let radius = 0;
    for (const v of voxels) {
      const c = worldCenter(v.ix, v.iy, v.iz);
      const l = { x: c.x - com.x, y: c.y - com.y, z: c.z - com.z };
      local.set(v.id, l);
      const d = Math.hypot(l.x, l.y, l.z);
      if (d > radius) radius = d;
    }
    radius += VOXEL_SIZE;

    if (dynamic) {
      // Corpos que se mexem: um collider por voxel (precisão nas juntas), mas
      // fundido em runs quando o corpo é grande.
      const boxes = voxels.length > 24 ? greedyBoxes(voxels) : null;
      if (boxes) {
        const density = MATERIALS[voxels[0].mat].density;
        for (const bx of boxes) {
          const cx = ((bx.x0 + bx.x1) / 2) * VOXEL_SIZE - com.x;
          const cy = ((bx.y0 + bx.y1) / 2) * VOXEL_SIZE + HALF - com.y;
          const cz = ((bx.z0 + bx.z1) / 2) * VOXEL_SIZE - com.z;
          const hx = ((bx.x1 - bx.x0 + 1) / 2) * VOXEL_SIZE * 0.98;
          const hy = ((bx.y1 - bx.y0 + 1) / 2) * VOXEL_SIZE * 0.98;
          const hz = ((bx.z1 - bx.z0 + 1) / 2) * VOXEL_SIZE * 0.98;
          this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz)
              .setDensity(density).setFriction(0.7).setRestitution(0).setCollisionGroups(groups),
            body,
          );
        }
      } else {
        for (const v of voxels) {
          const l = local.get(v.id)!;
          this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(HALF * 0.98, HALF * 0.98, HALF * 0.98)
              .setTranslation(l.x, l.y, l.z)
              .setDensity(MATERIALS[v.mat].density).setFriction(0.7).setRestitution(0).setCollisionGroups(groups),
            body,
          );
        }
      }
    } else {
      for (const bx of greedyBoxes(voxels)) {
        const cx = ((bx.x0 + bx.x1) / 2) * VOXEL_SIZE - com.x;
        const cy = ((bx.y0 + bx.y1) / 2) * VOXEL_SIZE + HALF - com.y;
        const cz = ((bx.z0 + bx.z1) / 2) * VOXEL_SIZE - com.z;
        const hx = ((bx.x1 - bx.x0 + 1) / 2) * VOXEL_SIZE;
        const hy = ((bx.y1 - bx.y0 + 1) / 2) * VOXEL_SIZE;
        const hz = ((bx.z1 - bx.z0 + 1) / 2) * VOXEL_SIZE;
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz)
            .setFriction(0.8).setCollisionGroups(groups),
          body,
        );
      }
    }

    const binding: Binding = {
      id: this.nextBindingId++, body, voxels, local, dynamic: dynamic || kinematic, kind, group, fresh: true, radius,
    };
    this.bindings.set(binding.id, binding);
    for (const v of voxels) this.voxelToBinding.set(v.id, binding);
    return binding;
  }

  private destroyBinding(b: Binding): void {
    if (b.kind === 'target') this.targets.delete(b.group);
    this.detachJoints(b);
    this.world.removeRigidBody(b.body);
    this.bindings.delete(b.id);
    for (const v of b.voxels) {
      if (this.voxelToBinding.get(v.id) === b) this.voxelToBinding.delete(v.id);
    }
  }

  private clearAll(): void {
    this.targets.clear();
    for (const j of this.joints) this.world.removeImpulseJoint(j.joint, false);
    this.joints = [];
    for (const b of this.bindings.values()) this.world.removeRigidBody(b.body);
    this.bindings.clear();
    this.voxelToBinding.clear();
    for (const d of this.debris) this.world.removeRigidBody(d.body);
    this.debris = [];
    for (const bomb of this.bombs) this.world.removeRigidBody(bomb.body);
    this.bombs = [];
  }

  // --------------------------------------------------------------- joints

  /** Chave de junta: `door:x` → "door:x"; `chain:x`/`hang:x` → "chain:x"; `spin:x`. */
  private jointKey(group: VoxelGroup): string {
    const kind = groupKind(group);
    if (kind === 'hang') return `chain:${groupId(group)}`;
    return group;
  }

  private detachJoints(b: Binding): string[] {
    const keys: string[] = [];
    this.joints = this.joints.filter((j) => {
      if (j.a !== b && j.b !== b) return true;
      this.world.removeImpulseJoint(j.joint, true);
      keys.push(j.key);
      return false;
    });
    return keys;
  }

  private bindingsOfGroup(group: VoxelGroup): Binding[] {
    const out: Binding[] = [];
    for (const b of this.bindings.values()) if (b.group === group) out.push(b);
    return out;
  }

  private attachJointsFor(key: string): void {
    // Refaz a cadeia inteira: tira o que sobrou dessa chave e recria.
    this.joints = this.joints.filter((j) => {
      if (j.key !== key) return true;
      this.world.removeImpulseJoint(j.joint, true);
      return false;
    });
    const kind = groupKind(key);
    if (kind === 'door') this.attachDoor(key);
    else if (kind === 'chain') this.attachChain(key);
    else if (kind === 'spin') this.attachSpin(key);
  }

  private structureNeighbor(v: Voxel, up = 0): Voxel | undefined {
    const grid = this.grid!;
    if (up > 0) {
      for (let dy = 1; dy <= up; dy++) {
        const n = grid.get(v.ix, v.iy + dy, v.iz);
        if (n && n.group === 'structure') return n;
      }
      return undefined;
    }
    for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0]] as const) {
      const n = grid.get(v.ix + dx, v.iy + dy, v.iz + dz);
      if (n && n.group === 'structure') return n;
    }
    return undefined;
  }

  private attachDoor(group: VoxelGroup): void {
    const door = this.bindingsOfGroup(group)[0];
    if (!door) return;
    const hinges = door.voxels.filter((v) => v.mat === 'hinge');
    if (hinges.length === 0) return;
    hinges.sort((a, b) => a.iy - b.iy);
    const mid = hinges[Math.floor(hinges.length / 2)];
    const pillar = this.structureNeighbor(mid);
    const parent = pillar ? this.voxelToBinding.get(pillar.id) : undefined;
    if (!parent) return;
    const p = this.poseOf(mid)!;
    const data = RAPIER.JointData.revolute(this.bodyWorldToLocal(parent.body, p), this.bodyWorldToLocal(door.body, p), { x: 0, y: 1, z: 0 });
    const joint = this.world.createImpulseJoint(data, parent.body, door.body, true);
    joint.setContactsEnabled(false);
    (joint as InstanceType<typeof RAPIER.RevoluteImpulseJoint>).setLimits?.(-2.4, 2.4);
    this.joints.push({ joint, a: parent, b: door, key: group });
  }

  private attachChain(key: string): void {
    const id = groupId(key);
    const links = this.bindingsOfGroup(`chain:${id}`)
      .sort((a, b) => Math.max(...b.voxels.map((v) => v.iy)) - Math.max(...a.voxels.map((v) => v.iy)));
    if (links.length === 0) return;
    const topLink = links[0];
    const topVoxel = topLink.voxels.reduce((a, b) => (b.iy > a.iy ? b : a));
    const anchorVoxel = this.structureNeighbor(topVoxel, 6);
    const parent = anchorVoxel ? this.voxelToBinding.get(anchorVoxel.id) : undefined;
    let prev: Binding | undefined = parent;
    let prevPoint: Vec = anchorVoxel
      ? this.poseOf(anchorVoxel)!
      : worldCenter(topVoxel.ix, topVoxel.iy + 1, topVoxel.iz);
    for (const link of links) {
      const top = link.voxels.reduce((a, b) => (b.iy > a.iy ? b : a));
      const bottom = link.voxels.reduce((a, b) => (b.iy < a.iy ? b : a));
      if (prev) {
        const p = this.poseOf(top)!;
        const mid = { x: (prevPoint.x + p.x) / 2, y: (prevPoint.y + p.y) / 2, z: (prevPoint.z + p.z) / 2 };
        this.spherical(prev, link, mid, key);
      }
      prev = link;
      prevPoint = this.poseOf(bottom)!;
    }
    // Corpo pendurado: `hang:<id>` ou `hang:<id sem sufixo>`.
    const base = id.replace(/-[^-]+$/, '');
    const hang = this.bindingsOfGroup(`hang:${id}`)[0] ?? this.bindingsOfGroup(`hang:${base}`)[0];
    if (hang && prev) {
      // Voxel do pendurado mais próximo do fim da corrente.
      let best: Voxel | null = null;
      let bestD = Infinity;
      for (const v of hang.voxels) {
        const p = this.poseOf(v)!;
        const d = (p.x - prevPoint.x) ** 2 + (p.y - prevPoint.y) ** 2 + (p.z - prevPoint.z) ** 2;
        if (d < bestD) { bestD = d; best = v; }
      }
      if (best) {
        const p = this.poseOf(best)!;
        const mid = { x: (prevPoint.x + p.x) / 2, y: (prevPoint.y + p.y) / 2, z: (prevPoint.z + p.z) / 2 };
        this.spherical(prev, hang, mid, key);
      }
    }
  }

  private attachSpin(group: VoxelGroup): void {
    const wheel = this.bindingsOfGroup(group)[0];
    if (!wheel) return;
    const grid = this.grid!;
    let axle: Voxel | undefined;
    let head: Voxel | undefined;
    // Prefere vizinho horizontal (o eixo é horizontal); senão qualquer um.
    for (const horizontalOnly of [true, false]) {
      for (const v of wheel.voxels) {
        if (v.mat !== 'steel') continue;
        const dirs = horizontalOnly
          ? ([[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]] as const)
          : ([[0, -1, 0], [0, 1, 0]] as const);
        for (const [dx, dy, dz] of dirs) {
          const n = grid.get(v.ix + dx, v.iy + dy, v.iz + dz);
          if (n && n.group === 'structure') { axle = v; head = n; break; }
        }
        if (axle) break;
      }
      if (axle) break;
    }
    if (!axle || !head) return;
    const parent = this.voxelToBinding.get(head.id);
    if (!parent) return;
    let axis: Vec = { x: axle.ix - head.ix, y: 0, z: axle.iz - head.iz };
    const len = Math.hypot(axis.x, axis.z);
    axis = len > 0 ? { x: axis.x / len, y: 0, z: axis.z / len } : { x: 0, y: 0, z: 1 };
    const p = this.poseOf(axle)!;
    const data = RAPIER.JointData.revolute(this.bodyWorldToLocal(parent.body, p), this.bodyWorldToLocal(wheel.body, p), axis);
    const joint = this.world.createImpulseJoint(data, parent.body, wheel.body, true) as InstanceType<typeof RAPIER.RevoluteImpulseJoint>;
    joint.setContactsEnabled(false);
    joint.configureMotorVelocity?.(1.4, 12);
    this.joints.push({ joint, a: parent, b: wheel, key: group });
  }

  private spherical(a: Binding, b: Binding, w: Vec, key: string): void {
    const data = RAPIER.JointData.spherical(this.bodyWorldToLocal(a.body, w), this.bodyWorldToLocal(b.body, w));
    const joint = this.world.createImpulseJoint(data, a.body, b.body, true);
    joint.setContactsEnabled(false);
    this.joints.push({ joint, a, b, key });
  }

  private bodyWorldToLocal(body: RigidBody, p: Vec): Vec {
    const t = body.translation();
    const r = body.rotation();
    const qInv = { x: -r.x, y: -r.y, z: -r.z, w: r.w };
    return rotate(qInv, { x: p.x - t.x, y: p.y - t.y, z: p.z - t.z });
  }

  // -------------------------------------------------------------- queries

  poseOf(voxel: Voxel): Pose | null {
    const bind = this.voxelToBinding.get(voxel.id);
    if (!bind) return null;
    if (!bind.dynamic) {
      const c = worldCenter(voxel.ix, voxel.iy, voxel.iz);
      return { x: c.x, y: c.y, z: c.z, qx: 0, qy: 0, qz: 0, qw: 1 };
    }
    const local = bind.local.get(voxel.id);
    if (!local) return null;
    const t = bind.body.translation();
    const r = bind.body.rotation();
    const rotated = rotate(r, local);
    return {
      x: t.x + rotated.x, y: t.y + rotated.y, z: t.z + rotated.z,
      qx: r.x, qy: r.y, qz: r.z, qw: r.w,
    };
  }

  isDynamic(voxel: Voxel): boolean {
    return this.voxelToBinding.get(voxel.id)?.dynamic ?? false;
  }

  /** Voxels de corpos que se mexem (fora da posição de grade). */
  *dynamicVoxels(): Iterable<Voxel> {
    for (const b of this.bindings.values()) {
      if (!b.dynamic) continue;
      for (const v of b.voxels) yield v;
    }
  }

  /** Voxels dinâmicos cujo corpo está a menos de `r` do ponto (teste por esfera envolvente). */
  *dynamicVoxelsNear(p: Vec, r: number): Iterable<Voxel> {
    for (const b of this.bindings.values()) {
      if (!b.dynamic) continue;
      const t = b.body.translation();
      const d = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z);
      if (d > b.radius + r) continue;
      for (const v of b.voxels) yield v;
    }
  }

  /** Voxels dinâmicos cujo corpo cruza o raio (esfera envolvente vs raio). */
  *dynamicVoxelsOnRay(origin: Vec, dir: Vec, maxDist: number): Iterable<Voxel> {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
    for (const b of this.bindings.values()) {
      if (!b.dynamic) continue;
      const t = b.body.translation();
      const ox = t.x - origin.x, oy = t.y - origin.y, oz = t.z - origin.z;
      const proj = ox * dx + oy * dy + oz * dz;
      if (proj < -b.radius || proj > maxDist + b.radius) continue;
      const perp2 = ox * ox + oy * oy + oz * oz - proj * proj;
      if (perp2 > b.radius * b.radius) continue;
      for (const v of b.voxels) yield v;
    }
  }

  /** Bindings dinâmicos que precisam de sync visual neste frame. */
  *movingBindings(): Iterable<Binding> {
    for (const b of this.bindings.values()) {
      if (!b.dynamic) continue;
      if (b.fresh || !b.body.isSleeping()) {
        b.fresh = false;
        yield b;
      }
    }
  }

  bindingOf(voxel: Voxel): Binding | undefined {
    return this.voxelToBinding.get(voxel.id);
  }

  applyImpulse(voxel: Voxel, dir: Vec, mag: number, point: Vec): void {
    const bind = this.voxelToBinding.get(voxel.id);
    if (!bind) return;
    if (!bind.dynamic) return;
    bind.body.wakeUp();
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    bind.body.applyImpulseAtPoint({ x: (dir.x / len) * mag, y: (dir.y / len) * mag, z: (dir.z / len) * mag }, point, true);
  }

  // --------------------------------------------------------------- debris

  /** Entulho em pedaços 2×2×2 (grade de células), com teto por lote. */
  spawnDebrisBatch(voxels: Voxel[], dir: Vec, mag: number): number {
    const cells = new Map<number, { voxels: Voxel[]; poses: Pose[] }>();
    for (const v of voxels) {
      const pose = this.poseOf(v) ?? { ...worldCenter(v.ix, v.iy, v.iz), qx: 0, qy: 0, qz: 0, qw: 1 };
      const k = ((Math.floor(v.ix / 2) + 1024) * 2048 + (Math.floor(v.iy / 2) + 1024)) * 2048 + (Math.floor(v.iz / 2) + 1024);
      const cell = cells.get(k);
      if (cell) { cell.voxels.push(v); cell.poses.push(pose); }
      else cells.set(k, { voxels: [v], poses: [pose] });
    }
    let spawned = 0;
    for (const cell of cells.values()) {
      if (spawned >= DEBRIS_PER_BATCH) break;
      while (this.debris.length >= DEBRIS_CAP) {
        const old = this.debris.shift();
        if (old) this.world.removeRigidBody(old.body);
      }
      let cx = 0, cy = 0, cz = 0;
      for (const p of cell.poses) { cx += p.x; cy += p.y; cz += p.z; }
      const n = cell.poses.length;
      cx /= n; cy /= n; cz /= n;
      const jitter = () => (Math.random() - 0.5) * 0.6;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(cx, cy, cz)
          .setCcdEnabled(n <= 2)
          .setLinvel(dir.x * mag * 0.35 + jitter(), dir.y * mag * 0.35 + 1.4 + jitter(), dir.z * mag * 0.35 + jitter())
          .setAngvel({ x: jitter() * 6, y: jitter() * 6, z: jitter() * 6 })
          .setLinearDamping(0.25)
          .setAngularDamping(0.6),
      );
      const parts: DebrisPiece['parts'] = [];
      for (let i = 0; i < n; i++) {
        const p = cell.poses[i];
        const local = { x: p.x - cx, y: p.y - cy, z: p.z - cz };
        parts.push({ mat: cell.voxels[i].mat, local });
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(HALF * 0.9, HALF * 0.9, HALF * 0.9)
            .setTranslation(local.x, local.y, local.z)
            .setDensity(MATERIALS[cell.voxels[i].mat].density)
            .setRestitution(0.1).setFriction(0.6)
            .setCollisionGroups(colGroups(COL_DEBRIS, 0xffff)),
          body,
        );
      }
      this.debris.push({ body, parts, born: this.now });
      spawned += 1;
    }
    return spawned;
  }

  spawnBomb(origin: Vec, vel: Vec, remote = false): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(origin.x, origin.y, origin.z)
        .setLinvel(vel.x, vel.y, vel.z)
        .setAngvel({ x: 6.5, y: 11, z: -4.5 })
        .setCcdEnabled(true),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(0.12).setDensity(2.2).setRestitution(0.12).setFriction(0.8)
        .setCollisionGroups(colGroups(COL_BOMB, 0xffff)),
      body,
    );
    this.bombs.push({ body, born: this.now, remote });
  }

  /** Detona todas as bananas remotas. */
  detonateRemote(): Vec[] {
    const out: Vec[] = [];
    this.bombs = this.bombs.filter((b) => {
      if (!b.remote) return true;
      const t = b.body.translation();
      out.push({ x: t.x, y: t.y, z: t.z });
      this.world.removeRigidBody(b.body);
      return false;
    });
    return out;
  }

  remoteCount(): number {
    let n = 0;
    for (const b of this.bombs) if (b.remote) n += 1;
    return n;
  }

  // -------------------------------------------------------------- targets

  /** Move o alvo para `offset` metros abaixo da base (0 = de pé, negativo = escondido). */
  setTargetOffset(group: string, offset: number): void {
    const t = this.targets.get(group);
    if (!t) return;
    if (Math.abs(t.offset - offset) < 1e-4) return;
    t.offset = offset;
    t.binding.body.setNextKinematicTranslation({ x: t.base.x, y: t.base.y + offset, z: t.base.z });
    t.binding.fresh = true;
  }

  targetGroups(): string[] {
    return [...this.targets.keys()];
  }

  /** Recoloca na grade os voxels de um alvo destruído e recria o corpo. */
  restoreGroup(grid: VoxelGrid, group: string, spec: { ix: number; iy: number; iz: number; mat: Voxel['mat']; s: number }[]): Voxel[] {
    const voxels: Voxel[] = [];
    for (const v of spec) {
      const added = grid.add(v.ix, v.iy, v.iz, v.mat, group, v.s);
      if (added) voxels.push(added);
    }
    if (voxels.length > 0) this.createBindingsFor(group, voxels, null);
    return voxels;
  }

  // --------------------------------------------------------------- player

  createPlayer(x: number, y: number, z: number): void {
    if (this.player) return;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.3).setCollisionGroups(colGroups(COL_PLAYER, COL_WORLD | COL_GROUND | COL_DEBRIS | COL_BOMB | COL_FENCE | COL_CHAIN)),
      body,
    );
    const controller = this.world.createCharacterController(0.03);
    controller.enableAutostep(0.3, 0.15, true);
    controller.enableSnapToGround(0.3);
    controller.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(75);
    this.player = { body, collider, controller };
  }

  /** Move a cápsula; devolve o deslocamento efetivo e se tocou o chão. */
  movePlayer(desired: Vec): { moved: Vec; grounded: boolean } {
    const p = this.player;
    if (!p) return { moved: desired, grounded: true };
    p.controller.computeColliderMovement(p.collider, desired, undefined, colGroups(COL_PLAYER, COL_WORLD | COL_GROUND | COL_DEBRIS | COL_BOMB | COL_FENCE | COL_CHAIN));
    const m = p.controller.computedMovement();
    const t = p.body.translation();
    p.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    return { moved: { x: m.x, y: m.y, z: m.z }, grounded: p.controller.computedGrounded() };
  }

  setPlayerPosition(x: number, y: number, z: number): void {
    const p = this.player;
    if (!p) return;
    p.body.setTranslation({ x, y, z }, true);
    p.body.setNextKinematicTranslation({ x, y, z });
  }

  playerPosition(): Vec {
    const t = this.player?.body.translation() ?? { x: 0, y: 0, z: 0 };
    return { x: t.x, y: t.y, z: t.z };
  }

  /** Muda a altura da cápsula (agachar). */
  setPlayerHeight(totalHeight: number): void {
    const p = this.player;
    if (!p) return;
    const half = Math.max(0.05, totalHeight / 2 - 0.3);
    p.collider.setHalfHeight?.(half);
  }

  /** Raio para baixo a partir do jogador: material do que está sob os pés. */
  groundUnderPlayer(): 'deck' | 'plaza' | 'sand' | 'voxel' | 'air' {
    const p = this.player;
    if (!p) return 'sand';
    const t = p.body.translation();
    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, 1.2, true, undefined, colGroups(COL_PLAYER, COL_WORLD | COL_GROUND | COL_DEBRIS), undefined, p.body);
    if (!hit) return 'air';
    const c = hit.collider;
    const parent = c.parent();
    if (parent && parent.bodyType() === RAPIER.RigidBodyType.Fixed) {
      const py = parent.translation().y;
      const pos = parent.translation();
      const r = Math.hypot(pos.x, pos.z);
      if (py < 0) return 'sand';
      if (Math.abs(py - DECK_TOP / 2) < 1e-3 && r < 0.01) return 'deck';
      if (Math.abs(py - PLAZA_TOP / 2) < 1e-3) return 'plaza';
    }
    return 'voxel';
  }

  // ----------------------------------------------------------------- step

  step(dt: number): { exploded: Vec[] } {
    this.now += dt;
    this.accumulator += Math.min(dt, 0.1);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 3) {
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (this.accumulator > FIXED_DT * 2) this.accumulator = FIXED_DT * 2; // não acumula dívida em frames lentos
    const exploded: Vec[] = [];
    this.bombs = this.bombs.filter((bomb) => {
      const t = bomb.body.translation();
      const age = this.now - bomb.born;
      if (bomb.remote) {
        if (t.y < -2) { this.world.removeRigidBody(bomb.body); return false; }
        return true;
      }
      if (age > 1.55 || t.y < 0.12) {
        exploded.push({ x: t.x, y: t.y, z: t.z });
        this.world.removeRigidBody(bomb.body);
        return false;
      }
      return true;
    });
    this.debris = this.debris.filter((d) => {
      const t = d.body.translation();
      if (this.now - d.born < DEBRIS_LIFE && t.y > -2) return true;
      this.world.removeRigidBody(d.body);
      return false;
    });
    return { exploded };
  }

  debrisPieces(): { pose: Pose; parts: { mat: Voxel['mat']; local: Vec }[]; asleep: boolean }[] {
    return this.debris.map((d) => {
      const t = d.body.translation();
      const r = d.body.rotation();
      return {
        pose: { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w },
        parts: d.parts,
        asleep: d.body.isSleeping(),
      };
    });
  }

  bombPoses(remote?: boolean): Pose[] {
    return this.bombs.filter((b) => remote === undefined || b.remote === remote).map((b) => {
      const t = b.body.translation();
      const r = b.body.rotation();
      return { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w };
    });
  }

  detonateWhere(hit: (x: number, y: number, z: number) => boolean): Vec[] {
    const exploded: Vec[] = [];
    this.bombs = this.bombs.filter((bomb) => {
      if (bomb.remote) return true;
      const t = bomb.body.translation();
      if (!hit(t.x, t.y, t.z)) return true;
      exploded.push({ x: t.x, y: t.y, z: t.z });
      this.world.removeRigidBody(bomb.body);
      return false;
    });
    return exploded;
  }

  diagnostics(): { engine: string; timestep: number; bodies: number; colliders: number; joints: number; bindings: number; dynamic: number } {
    let bodies = 0;
    let colliders = 0;
    let dynamic = 0;
    this.world.forEachRigidBody(() => { bodies += 1; });
    this.world.forEachCollider(() => { colliders += 1; });
    for (const b of this.bindings.values()) if (b.dynamic) dynamic += 1;
    return { engine: 'rapier', timestep: FIXED_DT, bodies, colliders, joints: this.joints.length, bindings: this.bindings.size, dynamic };
  }
}
