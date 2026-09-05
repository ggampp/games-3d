import * as THREE from 'three';
import { Rng } from '../game/deck';

/**
 * Nuvens de papel: cada nuvem é um cacho de esferas achatadas com sombreamento plano,
 * projeta sombra suave no chão e deriva devagar, dando a volta quando sai do diorama.
 */
const CLOUD_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#fffaf0',
  roughness: 1,
  metalness: 0,
  flatShading: true,
  transparent: true,
  opacity: 0.94,
  emissive: '#fff3e0',
  emissiveIntensity: 0.28,
});
const PUFF = new THREE.SphereGeometry(1, 9, 7);
const LIMIT = 13;

type CloudData = { speed: number; bob: number; phase: number; baseY: number };

export function createClouds(seed = 11): THREE.Group {
  const rng = new Rng(seed);
  const group = new THREE.Group();
  for (let i = 0; i < 8; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 4 + rng.int(4);
    const length = 1.4 + rng.next() * 1.6;
    for (let p = 0; p < puffs; p += 1) {
      const t = puffs === 1 ? 0.5 : p / (puffs - 1);
      const r = 0.42 + rng.next() * 0.38 + Math.sin(t * Math.PI) * 0.35;
      const mesh = new THREE.Mesh(PUFF, CLOUD_MATERIAL);
      mesh.scale.set(r * (1.1 + rng.next() * 0.4), r * 0.62, r * (0.9 + rng.next() * 0.3));
      mesh.position.set((t - 0.5) * length * 2, (rng.next() - 0.5) * 0.25 + Math.sin(t * Math.PI) * 0.18, (rng.next() - 0.5) * 0.7);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      cloud.add(mesh);
    }
    // base plana embaixo, como algodão apoiado num vidro
    const base = new THREE.Mesh(PUFF, CLOUD_MATERIAL);
    base.scale.set(length * 0.95, 0.28, 0.55);
    base.position.y = -0.22;
    base.castShadow = true;
    cloud.add(base);

    const baseY = 3.2 + rng.next() * 1.2;
    cloud.position.set(-LIMIT + rng.next() * LIMIT * 2, baseY, -7 + rng.next() * 13);
    cloud.rotation.y = rng.next() * Math.PI;
    const scale = 0.55 + rng.next() * 0.45;
    cloud.scale.setScalar(scale);
    const data: CloudData = {
      speed: 0.18 + rng.next() * 0.22,
      bob: 0.06 + rng.next() * 0.08,
      phase: rng.next() * Math.PI * 2,
      baseY,
    };
    cloud.userData = data;
    group.add(cloud);
  }
  return group;
}

export function driftClouds(group: THREE.Group, dt: number, elapsed: number): void {
  for (const cloud of group.children) {
    const data = cloud.userData as CloudData;
    cloud.position.x += data.speed * dt;
    if (cloud.position.x > LIMIT) cloud.position.x = -LIMIT;
    cloud.position.y = data.baseY + Math.sin(elapsed * 0.35 + data.phase) * data.bob;
  }
}
