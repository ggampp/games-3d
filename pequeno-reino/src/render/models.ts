import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HEX_SIZE } from '../game/hex';

/** Tiles que têm um modelo GLB gerado (FAL Trellis) em public/models/. */
export const MODEL_IDS = ['moinho_vento', 'capela', 'farol', 'engenho', 'sobrado', 'cais', 'escola', 'mercado'] as const;

type Loaded = { scene: THREE.Group; footprint: number };

/**
 * Carrega os modelos gerados uma vez e entrega clones já normalizados: centrados no hex,
 * apoiados no chão (y = 0) e com a maior dimensão horizontal ajustada à largura do tile.
 */
export class ModelLibrary {
  private readonly loader = new GLTFLoader();
  private readonly models = new Map<string, Loaded>();
  private readonly failed = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();
  onLoaded: ((id: string) => void) | null = null;

  has(id: string): boolean {
    return this.models.has(id);
  }

  preload(ids: readonly string[] = MODEL_IDS): void {
    for (const id of ids) void this.load(id);
  }

  clone(id: string): THREE.Group | null {
    const loaded = this.models.get(id);
    if (!loaded) return null;
    const clone = loaded.scene.clone(true);
    clone.userData.model = true;
    return clone;
  }

  private load(id: string): Promise<void> {
    if (this.models.has(id) || this.failed.has(id)) return Promise.resolve();
    const inflight = this.pending.get(id);
    if (inflight) return inflight;
    const task = new Promise<void>((resolve) => {
      this.loader.load(
        `/models/${id}.glb`,
        (gltf) => {
          this.models.set(id, normalize(gltf.scene));
          this.pending.delete(id);
          this.onLoaded?.(id);
          resolve();
        },
        undefined,
        () => {
          this.failed.add(id);
          this.pending.delete(id);
          resolve();
        },
      );
    });
    this.pending.set(id, task);
    return task;
  }
}

function normalize(scene: THREE.Group): Loaded {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material && 'roughness' in material) {
      material.roughness = Math.max(material.roughness ?? 0.8, 0.7);
      material.metalness = Math.min(material.metalness ?? 0, 0.1);
    }
  });
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const footprint = Math.max(size.x, size.z, 1e-4);
  // O modelo cabe dentro do hex (largura) e não passa de ~1,2 unidades de altura, o que quer
  // que o Trellis tenha reconstruído (só o prédio ou o tile inteiro).
  const scale = Math.min((HEX_SIZE * 1.6) / footprint, 1.35 / Math.max(size.y, 1e-4));
  const wrapper = new THREE.Group();
  scene.position.set(-center.x, -box.min.y, -center.z);
  wrapper.add(scene);
  wrapper.scale.setScalar(scale);
  return { scene: wrapper, footprint };
}
