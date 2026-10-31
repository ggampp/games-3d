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
  // Textura própria: antes a estrada reaproveitava a da areia e o
  // repeat (3, 8) dela esticava o chão inteiro.
  const roadTex = textures.sand.clone();
  roadTex.needsUpdate = true;
  roadTex.repeat.set(3, 8);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xcaa06e,
    map: roadTex,
    roughness: 0.95,
    metalness: 0.01,
  });
  const mainStreet = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 22), roadMat);
  mainStreet.rotation.x = -Math.PI / 2;
  mainStreet.position.set(0, 0.01, -1.0);
  mainStreet.receiveShadow = true;
  mainStreet.name = 'road';
  scene.add(mainStreet);

  // Deserto além da vila: anel de areia até perto do horizonte (some na névoa).
  const outerTex = textures.sand.clone();
  outerTex.needsUpdate = true;
  outerTex.repeat.set(60, 60);
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(GROUND_RADIUS - 0.05, 140, 64, 1),
    new THREE.MeshStandardMaterial({ color: 0xe0c9a0, map: outerTex, roughness: 1, metalness: 0 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.005;
  outer.receiveShadow = true;
  outer.name = 'desert';
  scene.add(outer);

  // Trilhas de carroça saindo da vila (faixas de terra mais escura).
  const trailMat = new THREE.MeshStandardMaterial({ color: 0xb08a5c, map: roadTex, roughness: 1, metalness: 0 });
  for (const [x, z, rot, len] of [[0, 22, 0, 26], [0, -24, 0, 26], [-24, 2, Math.PI / 2, 26]] as const) {
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(3.2, len), trailMat);
    trail.rotation.set(-Math.PI / 2, 0, rot);
    trail.position.set(x, 0.006, z);
    trail.receiveShadow = true;
    scene.add(trail);
  }

  scene.add(createMesas());
}

/** Mesas e buttes vermelhos em camadas no horizonte (low-poly, flat shading). */
function createMesas(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mesas';
  const bands = [0xa8553a, 0xc46e48, 0x9a4a34, 0xd08458, 0xb45e40].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, flatShading: true }),
  );
  const talus = new THREE.MeshStandardMaterial({ color: 0xc8956a, roughness: 1, flatShading: true });
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const spots = 11;
  for (let i = 0; i < spots; i++) {
    const a = (i / spots) * Math.PI * 2 + rnd() * 0.35;
    const d = 46 + rnd() * 22;
    const mesa = new THREE.Group();
    const wide = rnd() < 0.55;
    const r = wide ? 6 + rnd() * 6 : 2 + rnd() * 2;
    const h = wide ? 7 + rnd() * 6 : 9 + rnd() * 8;
    // saia de detritos na base
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.7, h * 0.3, 7), talus);
    skirt.position.y = h * 0.15;
    mesa.add(skirt);
    // paredes em faixas de cor
    const layers = 4;
    for (let k = 0; k < layers; k++) {
      const lh = (h * 0.75) / layers;
      const rr = r * (1 - k * 0.04);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.97, rr, lh, 7), bands[(i + k) % bands.length]);
      m.position.y = h * 0.25 + lh * (k + 0.5);
      mesa.add(m);
    }
    mesa.scale.z = wide ? 0.55 + rnd() * 0.3 : 1;
    mesa.rotation.y = rnd() * Math.PI;
    mesa.position.set(Math.cos(a) * d, -0.4, Math.sin(a) * d);
    g.add(mesa);
  }
  return g;
}
