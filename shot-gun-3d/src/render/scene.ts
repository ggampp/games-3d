import * as THREE from 'three';
import { GAZEBO, GROUND_RADIUS, PLAZA_TOP } from '../voxels/town.ts';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}

export const LANTERN_LIGHTS = 6;

export function createLighting(scene: THREE.Scene): {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  lanterns: THREE.PointLight[];
  muzzle: THREE.PointLight;
} {
  scene.background = new THREE.Color(0xb9cfe0);
  scene.fog = new THREE.Fog(0xc5d6e6, 22, 70);

  const hemi = new THREE.HemisphereLight(0xe8f2ff, 0xc4a574, 0.72);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d0, 1.55);
  sun.position.set(12, 22, 9);
  sun.castShadow = true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  const r = 14;
  sun.shadow.camera.left = -r;
  sun.shadow.camera.right = r;
  sun.shadow.camera.top = r;
  sun.shadow.camera.bottom = -r;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x9bb7d4, 0.28);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  const lanterns: THREE.PointLight[] = [];
  for (let i = 0; i < LANTERN_LIGHTS; i++) {
    const light = new THREE.PointLight(0xffb45a, 1.15, 6.5, 1.8);
    light.castShadow = false;
    scene.add(light);
    lanterns.push(light);
  }

  const muzzle = new THREE.PointLight(0xffe6a0, 0, 4.5, 2);
  scene.add(muzzle);
  return { sun, hemi, lanterns, muzzle };
}

/** A câmera de sombra segue o jogador (em passos de 1 m para não tremer). */
export function followShadow(sun: THREE.DirectionalLight, x: number, z: number, dir: THREE.Vector3): void {
  const sx = Math.round(x);
  const sz = Math.round(z);
  sun.target.position.set(sx, 0, sz);
  sun.position.set(sx + dir.x * 26, Math.max(6, dir.y * 26), sz + dir.z * 26);
  sun.target.updateMatrixWorld();
}

export function createWorldKit(
  scene: THREE.Scene,
  textures: Record<string, THREE.Texture>,
): void {
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xf2e6cf,
    map: textures.sand,
    roughness: 0.96,
    metalness: 0,
  });
  textures.sand.repeat.set(24, 24);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_RADIUS, 64), sandMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'sand';
  scene.add(ground);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xd8cbb8,
    map: textures.adobe,
    roughness: 0.94,
    metalness: 0.02,
  });
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(GAZEBO.radius, GAZEBO.radius + 0.08, PLAZA_TOP, 24), stoneMat);
  plaza.position.set(GAZEBO.x, PLAZA_TOP / 2, GAZEBO.z);
  plaza.castShadow = true;
  plaza.receiveShadow = true;
  plaza.name = 'plaza';
  scene.add(plaza);

  // Estrada principal de terra batida da Main Street (corredor central como na foto de referência)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xcaa06e,
    map: textures.sand,
    roughness: 0.95,
    metalness: 0.01,
  });
  textures.sand.repeat.set(3, 8);
  const mainStreet = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 22), roadMat);
  mainStreet.rotation.x = -Math.PI / 2;
  mainStreet.position.set(0, 0.01, -1.0);
  mainStreet.receiveShadow = true;
  mainStreet.name = 'road';
  scene.add(mainStreet);
}
