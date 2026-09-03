import * as THREE from 'three';
import { MATERIALS, MAT_IDS, VOXEL_SIZE } from '../voxels/types.ts';
import type { MatId, Voxel } from '../voxels/types.ts';
import type { PhysicsSim } from '../physics/sim.ts';
import type { VoxelGrid } from '../voxels/grid.ts';

const DEBRIS_CAP = 1800;
const CHUNK = 16;
const CHUNKS_PER_FRAME = 10;
const dummy = new THREE.Object3D();
const quat = new THREE.Quaternion();
const pos = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const color = new THREE.Color();
const tmpM = new THREE.Matrix4();

function tintK(id: number): number {
  const n = ((id * 1103515245 + 12345) >>> 0) % 1000;
  return (n / 1000 - 0.5) * 0.18;
}

function tintOf(id: number, out: THREE.Color): THREE.Color {
  const k = tintK(id);
  return out.setRGB(1 + k, 1 + k * 0.8, 1 + k * 0.5);
}

/** Cor base do material: com textura, cede parte para ela. */
function baseColor(id: MatId, textured: boolean): THREE.Color {
  const def = MATERIALS[id];
  const c = new THREE.Color(def.color);
  if (textured) c.lerp(new THREE.Color(0xffffff), def.texTint ?? 0.6);
  return c;
}

interface Layer {
  mesh: THREE.InstancedMesh;
  slot: Map<number, number>;
  at: Voxel[];
  count: number;
  dirty: boolean;
}

type V3 = [number, number, number];

// Faces: normal, 4 cantos (0/1 no cubo), eixos u/v para UV. Ordem dos cantos = anti-horária vista de fora.
const FACES: { n: V3; c: V3[]; u: V3; v: V3 }[] = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, -1, 0], c: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], u: [1, 0, 0], v: [0, 1, 0] },
];

function chunkKey(cx: number, cy: number, cz: number): number {
  return ((cx + 512) * 1024 + (cy + 512)) * 1024 + (cz + 512);
}

interface ChunkRec {
  cx: number; cy: number; cz: number;
  mesh: THREE.Mesh | null;
}

interface Buf { p: number[]; n: number[]; uv: number[]; col: number[]; idx: number[] }

/**
 * Estáticos: malha fundida por chunk 16³ com faces internas removidas,
 * ambient occlusion por vértice e UV em coordenadas de mundo.
 * Dinâmicos e entulho: InstancedMesh por material.
 */
export class VoxelView {
  readonly group = new THREE.Group();
  private layers = new Map<MatId, Layer>();
  private debrisMeshes = new Map<MatId, THREE.InstancedMesh>();
  private instMaterials = new Map<MatId, THREE.MeshStandardMaterial>();
  private chunkMaterials = new Map<MatId, THREE.MeshStandardMaterial>();
  private geo: THREE.BoxGeometry;
  private grid: VoxelGrid | null = null;
  private physics: PhysicsSim | null = null;
  private chunks = new Map<number, ChunkRec>();
  private dirtyChunks = new Set<number>();
  private burning = new Set<number>();
  private dynamicIds = new Set<number>();

  constructor(textures: Record<string, THREE.Texture>) {
    this.group.name = 'voxels';
    this.geo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    for (const id of MAT_IDS) {
      const def = MATERIALS[id];
      const map = id === 'wood' || id === 'plank' ? textures.wood
        : id === 'adobe' || id === 'rock' ? textures.adobe
          : id === 'steel' || id === 'hinge' ? textures.steel
            : id === 'brick' ? textures.brick
              : id === 'hay' || id === 'cactus' ? textures.hay
                : undefined;
      const common = {
        map: map ?? null,
        roughness: def.roughness,
        metalness: def.metalness,
        emissive: new THREE.Color(def.emissive),
        emissiveIntensity: def.emissiveIntensity,
        transparent: !!def.transparent,
        opacity: def.transparent ? 0.5 : 1,
        depthWrite: !def.transparent,
      };
      const inst = new THREE.MeshStandardMaterial({ ...common, color: baseColor(id, !!map) });
      const chunk = new THREE.MeshStandardMaterial({ ...common, color: baseColor(id, !!map), vertexColors: true });
      this.instMaterials.set(id, inst);
      this.chunkMaterials.set(id, chunk);
      const debris = new THREE.InstancedMesh(this.geo, inst, DEBRIS_CAP);
      debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      debris.castShadow = true;
      debris.receiveShadow = true;
      debris.count = 0;
      debris.frustumCulled = false;
      debris.name = `debris-${id}`;
      this.debrisMeshes.set(id, debris);
      this.group.add(debris);
    }
  }

  /** Recria tudo para uma grade nova. */
  rebuild(grid: VoxelGrid, physics: PhysicsSim): void {
    this.grid = grid;
    this.physics = physics;
    for (const c of this.chunks.values()) this.disposeChunk(c);
    this.chunks.clear();
    this.dirtyChunks.clear();
    this.burning.clear();
    this.dynamicIds.clear();
    for (const layer of this.layers.values()) {
      this.group.remove(layer.mesh);
      layer.mesh.dispose();
    }
    this.layers.clear();
    const counts = new Map<MatId, number>();
    for (const v of grid.values()) {
      if (physics.isDynamic(v)) counts.set(v.mat, (counts.get(v.mat) ?? 0) + 1);
      this.touchChunk(v.ix, v.iy, v.iz);
    }
    for (const id of MAT_IDS) this.ensureLayer(id, (counts.get(id) ?? 0) + 600);
    for (const v of grid.values()) if (physics.isDynamic(v)) this.place(v);
    for (const layer of this.layers.values()) this.flushLayer(layer);
    for (const key of this.dirtyChunks) this.buildChunk(key);
    this.dirtyChunks.clear();
  }

  private ensureLayer(id: MatId, cap: number): Layer {
    let layer = this.layers.get(id);
    if (layer && layer.mesh.instanceMatrix.count >= cap) return layer;
    const old = layer;
    const mesh = new THREE.InstancedMesh(this.geo, this.instMaterials.get(id)!, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.name = `vox-${id}`;
    layer = { mesh, slot: new Map(), at: [], count: 0, dirty: true };
    if (old) {
      for (let i = 0; i < old.count; i++) {
        old.mesh.getMatrixAt(i, tmpM);
        mesh.setMatrixAt(i, tmpM);
        if (old.mesh.instanceColor) {
          old.mesh.getColorAt(i, color);
          mesh.setColorAt(i, color);
        }
        layer.at[i] = old.at[i];
        layer.slot.set(old.at[i].id, i);
      }
      layer.count = old.count;
      mesh.count = old.count;
      this.group.remove(old.mesh);
      old.mesh.dispose();
    }
    this.layers.set(id, layer);
    this.group.add(mesh);
    return layer;
  }

  private place(v: Voxel): void {
    let layer = this.layers.get(v.mat) ?? this.ensureLayer(v.mat, 600);
    if (layer.slot.has(v.id)) return;
    if (layer.count >= layer.mesh.instanceMatrix.count) {
      layer = this.ensureLayer(v.mat, Math.ceil(layer.mesh.instanceMatrix.count * 1.6));
    }
    const i = layer.count++;
    layer.slot.set(v.id, i);
    layer.at[i] = v;
    this.writeSlot(layer, i, v);
    layer.mesh.setColorAt(i, tintOf(v.id, color));
    layer.dirty = true;
    this.dynamicIds.add(v.id);
  }

  private writeSlot(layer: Layer, i: number, v: Voxel): void {
    const pose = this.physics!.poseOf(v);
    if (pose) {
      pos.set(pose.x, pose.y, pose.z);
      quat.set(pose.qx, pose.qy, pose.qz, pose.qw);
    } else {
      pos.set(v.ix * VOXEL_SIZE, v.iy * VOXEL_SIZE + VOXEL_SIZE * 0.5, v.iz * VOXEL_SIZE);
      quat.identity();
    }
    dummy.position.copy(pos);
    dummy.quaternion.copy(quat);
    dummy.scale.setScalar(0.98);
    dummy.updateMatrix();
    layer.mesh.setMatrixAt(i, dummy.matrix);
  }

  private unplace(v: Voxel): void {
    const layer = this.layers.get(v.mat);
    if (!layer) return;
    const i = layer.slot.get(v.id);
    if (i === undefined) return;
    const last = layer.count - 1;
    if (i !== last) {
      const mv = layer.at[last];
      layer.mesh.getMatrixAt(last, tmpM);
      layer.mesh.setMatrixAt(i, tmpM);
      if (layer.mesh.instanceColor) {
        layer.mesh.getColorAt(last, color);
        layer.mesh.setColorAt(i, color);
      }
      layer.at[i] = mv;
      layer.slot.set(mv.id, i);
    }
    layer.slot.delete(v.id);
    layer.at.length = last;
    layer.count = last;
    layer.mesh.count = last;
    layer.dirty = true;
    this.dynamicIds.delete(v.id);
  }

  private flushLayer(layer: Layer): void {
    if (!layer.dirty) return;
    layer.dirty = false;
    layer.mesh.count = layer.count;
    layer.mesh.instanceMatrix.needsUpdate = true;
    if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------ chunks

  private touchChunk(ix: number, iy: number, iz: number): void {
    const cx = Math.floor(ix / CHUNK);
    const cy = Math.floor(iy / CHUNK);
    const cz = Math.floor(iz / CHUNK);
    const key = chunkKey(cx, cy, cz);
    if (!this.chunks.has(key)) this.chunks.set(key, { cx, cy, cz, mesh: null });
    this.dirtyChunks.add(key);
  }

  private markDirty(v: Voxel): void {
    this.touchChunk(v.ix, v.iy, v.iz);
    const lx = ((v.ix % CHUNK) + CHUNK) % CHUNK;
    const ly = ((v.iy % CHUNK) + CHUNK) % CHUNK;
    const lz = ((v.iz % CHUNK) + CHUNK) % CHUNK;
    if (lx === 0) this.touchChunk(v.ix - 1, v.iy, v.iz);
    if (lx === CHUNK - 1) this.touchChunk(v.ix + 1, v.iy, v.iz);
    if (ly === 0) this.touchChunk(v.ix, v.iy - 1, v.iz);
    if (ly === CHUNK - 1) this.touchChunk(v.ix, v.iy + 1, v.iz);
    if (lz === 0) this.touchChunk(v.ix, v.iy, v.iz - 1);
    if (lz === CHUNK - 1) this.touchChunk(v.ix, v.iy, v.iz + 1);
  }

  /** Voxels destruídos. */
  remove(voxels: Iterable<Voxel>): void {
    for (const v of voxels) {
      this.unplace(v);
      this.burning.delete(v.id);
      this.markDirty(v);
    }
  }

  /** Voxels cujo corpo mudou (podem ter virado dinâmicos ou voltado a estáticos). */
  changed(voxels: Iterable<Voxel>): void {
    const physics = this.physics!;
    for (const v of voxels) {
      const dyn = physics.isDynamic(v);
      const had = this.dynamicIds.has(v.id);
      if (dyn && !had) { this.place(v); this.markDirty(v); }
      else if (!dyn && had) { this.unplace(v); this.markDirty(v); }
    }
  }

  /** Voxel em chamas: escurece e alaranja no chunk. */
  setBurning(v: Voxel, on: boolean): void {
    const had = this.burning.has(v.id);
    if (on === had) return;
    if (on) this.burning.add(v.id); else this.burning.delete(v.id);
    if (!this.dynamicIds.has(v.id)) this.markDirty(v);
  }

  private staticAt(ix: number, iy: number, iz: number): Voxel | undefined {
    const n = this.grid!.get(ix, iy, iz);
    if (!n || this.physics!.isDynamic(n)) return undefined;
    return n;
  }

  private occluder(ix: number, iy: number, iz: number): number {
    const n = this.grid!.get(ix, iy, iz);
    if (!n || this.physics!.isDynamic(n) || MATERIALS[n.mat].transparent) return 0;
    return 1;
  }

  private disposeChunk(c: ChunkRec): void {
    if (!c.mesh) return;
    this.group.remove(c.mesh);
    c.mesh.geometry.dispose();
    c.mesh = null;
  }

  private buildChunk(key: number): void {
    const c = this.chunks.get(key);
    if (!c) return;
    const grid = this.grid!;
    const physics = this.physics!;
    this.disposeChunk(c);

    const byMat = new Map<MatId, Buf>();
    const x0 = c.cx * CHUNK;
    const y0 = c.cy * CHUNK;
    const z0 = c.cz * CHUNK;
    const S = VOXEL_SIZE;
    let any = false;
    for (let iy = y0; iy < y0 + CHUNK; iy++) {
      for (let iz = z0; iz < z0 + CHUNK; iz++) {
        for (let ix = x0; ix < x0 + CHUNK; ix++) {
          const v = grid.get(ix, iy, iz);
          if (!v || physics.isDynamic(v)) continue;
          const def = MATERIALS[v.mat];
          const k = tintK(v.id);
          const burning = this.burning.has(v.id);
          let buf = byMat.get(v.mat);
          if (!buf) {
            buf = { p: [], n: [], uv: [], col: [], idx: [] };
            byMat.set(v.mat, buf);
          }
          const bx = ix * S - S / 2;
          const by = iy * S;
          const bz = iz * S - S / 2;
          for (const f of FACES) {
            const nb = this.staticAt(ix + f.n[0], iy + f.n[1], iz + f.n[2]);
            if (nb) {
              const nt = !!MATERIALS[nb.mat].transparent;
              if (!def.transparent && !nt) continue;
              if (def.transparent && nt) continue;
            }
            any = true;
            const base = buf.p.length / 3;
            const ox = ix + f.n[0], oy = iy + f.n[1], oz = iz + f.n[2];
            const aos: number[] = [];
            for (let ci = 0; ci < 4; ci++) {
              const corner = f.c[ci];
              const px = bx + corner[0] * S;
              const py = by + corner[1] * S;
              const pz = bz + corner[2] * S;
              buf.p.push(px, py, pz);
              buf.n.push(f.n[0], f.n[1], f.n[2]);
              const uu = (px * f.u[0] + py * f.u[1] + pz * f.u[2]) * 2;
              const vv = (px * f.v[0] + py * f.v[1] + pz * f.v[2]) * 2;
              buf.uv.push(uu, vv);
              // AO: os dois vizinhos tangentes e a diagonal, na camada de fora da face.
              const sx = corner[0] * 2 - 1, sy = corner[1] * 2 - 1, sz = corner[2] * 2 - 1;
              let t1: V3, t2: V3;
              if (f.n[0] !== 0) { t1 = [0, sy, 0]; t2 = [0, 0, sz]; }
              else if (f.n[1] !== 0) { t1 = [sx, 0, 0]; t2 = [0, 0, sz]; }
              else { t1 = [sx, 0, 0]; t2 = [0, sy, 0]; }
              const s1 = this.occluder(ox + t1[0], oy + t1[1], oz + t1[2]);
              const s2 = this.occluder(ox + t2[0], oy + t2[1], oz + t2[2]);
              const cc = this.occluder(ox + t1[0] + t2[0], oy + t1[1] + t2[1], oz + t1[2] + t2[2]);
              const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
              aos.push(ao);
              const shade = 0.52 + 0.48 * (ao / 3);
              let r = (1 + k) * shade, g = (1 + k * 0.8) * shade, b = (1 + k * 0.5) * shade;
              if (burning) { r *= 0.9; g *= 0.35; b *= 0.15; }
              buf.col.push(r, g, b);
            }
            // Escolhe a diagonal que não cria o artefato de AO.
            if (aos[0] + aos[2] > aos[1] + aos[3]) {
              buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            } else {
              buf.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            }
          }
        }
      }
    }
    if (!any) return;
    const geo = new THREE.BufferGeometry();
    const P: number[] = [], N: number[] = [], UV: number[] = [], C: number[] = [], I: number[] = [];
    const mats: THREE.Material[] = [];
    let offset = 0;
    for (const [mat, buf] of byMat) {
      const vertBase = P.length / 3;
      for (let i = 0; i < buf.p.length; i++) P.push(buf.p[i]);
      for (let i = 0; i < buf.n.length; i++) N.push(buf.n[i]);
      for (let i = 0; i < buf.uv.length; i++) UV.push(buf.uv[i]);
      for (let i = 0; i < buf.col.length; i++) C.push(buf.col[i]);
      for (let i = 0; i < buf.idx.length; i++) I.push(buf.idx[i] + vertBase);
      geo.addGroup(offset, buf.idx.length, mats.length);
      mats.push(this.chunkMaterials.get(mat)!);
      offset += buf.idx.length;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geo.setIndex(I);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `chunk-${c.cx},${c.cy},${c.cz}`;
    c.mesh = mesh;
    this.group.add(mesh);
  }

  /** Atualiza o que se mexe e refaz chunks sujos (com teto por frame). */
  sync(grid: VoxelGrid, physics: PhysicsSim): void {
    if (this.grid !== grid) this.rebuild(grid, physics);
    for (const b of physics.movingBindings()) {
      for (const v of b.voxels) {
        const layer = this.layers.get(v.mat);
        const i = layer?.slot.get(v.id);
        if (!layer || i === undefined) { this.place(v); this.markDirty(v); continue; }
        this.writeSlot(layer, i, v);
        layer.dirty = true;
      }
    }
    for (const layer of this.layers.values()) this.flushLayer(layer);

    let n = 0;
    for (const key of this.dirtyChunks) {
      this.buildChunk(key);
      this.dirtyChunks.delete(key);
      if (++n >= CHUNKS_PER_FRAME) break;
    }

    const dCounts = new Map<MatId, number>();
    for (const id of MAT_IDS) dCounts.set(id, 0);
    for (const piece of physics.debrisPieces()) {
      quat.set(piece.pose.qx, piece.pose.qy, piece.pose.qz, piece.pose.qw);
      for (const part of piece.parts) {
        const mesh = this.debrisMeshes.get(part.mat);
        if (!mesh) continue;
        const i = dCounts.get(part.mat) ?? 0;
        if (i >= DEBRIS_CAP) continue;
        tmpV.set(part.local.x, part.local.y, part.local.z).applyQuaternion(quat);
        dummy.position.set(piece.pose.x + tmpV.x, piece.pose.y + tmpV.y, piece.pose.z + tmpV.z);
        dummy.quaternion.copy(quat);
        dummy.scale.setScalar(0.9);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        dCounts.set(part.mat, i + 1);
      }
    }
    for (const id of MAT_IDS) {
      const mesh = this.debrisMeshes.get(id)!;
      mesh.count = dCounts.get(id) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  get instanceCount(): number {
    let n = 0;
    for (const l of this.layers.values()) n += l.count;
    return n;
  }

  get chunkCount(): number {
    let n = 0;
    for (const c of this.chunks.values()) if (c.mesh) n += 1;
    return n;
  }

  get pendingChunks(): number {
    return this.dirtyChunks.size;
  }
}
