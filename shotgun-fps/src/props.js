import * as THREE from 'three';
import { MAT } from './materials.js';

// Props procedurais do cenário western: barris com aros, caixotes com ripas,
// carroça, estábulo com cavalo de madeira, cactos com braços curvos, caixa de cartuchos.
// Tudo em geometrias compostas com flat shading; geometrias compartilhadas quando repetem.

const G = {
  barrelBody: new THREE.CylinderGeometry(0.40, 0.36, 1.1, 10),
  barrelBelly: new THREE.CylinderGeometry(0.44, 0.44, 0.5, 10),
  barrelHoop: new THREE.CylinderGeometry(0.455, 0.455, 0.07, 10, 1, true),
  crate: new THREE.BoxGeometry(0.9, 0.9, 0.9),
  crateSlat: new THREE.BoxGeometry(0.94, 0.08, 0.06),
  crateSlatZ: new THREE.BoxGeometry(0.06, 0.08, 0.94),
  cactusSeg: new THREE.CylinderGeometry(0.30, 0.34, 1.0, 7),
  cactusTip: new THREE.SphereGeometry(0.30, 7, 5),
  cactusArm: new THREE.CylinderGeometry(0.18, 0.2, 0.8, 6),
  cactusElbow: new THREE.SphereGeometry(0.2, 6, 4),
  cactusArmUp: new THREE.CylinderGeometry(0.16, 0.18, 1.0, 6),
  cactusArmTip: new THREE.SphereGeometry(0.17, 6, 4),
  flower: new THREE.SphereGeometry(0.12, 5, 4),
};

const hoopMat = MAT.iron.clone();
hoopMat.side = THREE.DoubleSide;

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Barril de madeira com barriga e dois aros de ferro
export function createBarrel() {
  const g = new THREE.Group();
  g.add(mesh(G.barrelBody, MAT.woodDark, 0, 0.55, 0));
  g.add(mesh(G.barrelBelly, MAT.woodDark, 0, 0.55, 0));
  g.add(mesh(G.barrelHoop, hoopMat, 0, 0.28, 0));
  g.add(mesh(G.barrelHoop, hoopMat, 0, 0.82, 0));
  g.userData.collider = { sx: 0.9, sz: 0.9, h: 1.1 };
  return g;
}

// Caixote com ripas em relevo
export function createCrate() {
  const g = new THREE.Group();
  g.add(mesh(G.crate, MAT.woodLight));
  for (const y of [-0.36, 0.36]) {
    g.add(mesh(G.crateSlat, MAT.woodDark, 0, y, 0.46));
    g.add(mesh(G.crateSlat, MAT.woodDark, 0, y, -0.46));
    g.add(mesh(G.crateSlatZ, MAT.woodDark, 0.46, y, 0));
    g.add(mesh(G.crateSlatZ, MAT.woodDark, -0.46, y, 0));
  }
  g.userData.collider = { sx: 0.95, sz: 0.95, h: 0.9 };
  return g;
}

// Cacto saguaro com tronco segmentado e braços que sobem em curva (cotovelo + antebraço)
export function createCactus(scale = 1) {
  const g = new THREE.Group();
  const trunkH = 4.2;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const s = mesh(G.cactusSeg, MAT.cactus, 0, 0.5 + i * 1.0, 0);
    s.scale.set(1 - i * 0.06, 1, 1 - i * 0.06);
    g.add(s);
  }
  g.add(mesh(G.cactusTip, MAT.cactus, 0, trunkH + 0.05, 0));
  g.add(mesh(G.flower, MAT.cactusFlower, 0.05, trunkH + 0.32, 0.05));

  const arm = (side, baseY, len) => {
    const a = new THREE.Group();
    const lower = mesh(G.cactusArm, MAT.cactus, side * 0.45, 0, 0);
    lower.rotation.z = side * Math.PI / 2;
    a.add(lower);
    a.add(mesh(G.cactusElbow, MAT.cactus, side * 0.85, 0, 0));
    const upper = mesh(G.cactusArmUp, MAT.cactus, side * 0.85, len / 2, 0);
    upper.scale.y = len;
    a.add(upper);
    a.add(mesh(G.cactusArmTip, MAT.cactus, side * 0.85, len + 0.02, 0));
    if (Math.random() > 0.5) a.add(mesh(G.flower, MAT.cactusFlower, side * 0.85, len + 0.2, 0));
    a.position.y = baseY;
    return a;
  };
  g.add(arm(-1, 2.4, 1.1));
  g.add(arm(1, 1.7, 1.4));
  if (Math.random() > 0.5) {
    const a3 = arm(1, 3.0, 0.7);
    a3.rotation.y = Math.PI / 2;
    g.add(a3);
  }
  g.scale.setScalar(scale);
  g.userData.collider = { sx: 0.8 * scale, sz: 0.8 * scale, h: 4.5 * scale };
  return g;
}

// Roda de carroça com aro, raios e cubo
function createWheel(radius = 0.55) {
  const w = new THREE.Group();
  w.add(mesh(new THREE.TorusGeometry(radius, 0.06, 5, 12), MAT.woodDark));
  const hub = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8), MAT.ironRust);
  hub.rotation.x = Math.PI / 2;
  w.add(hub);
  const spokeGeo = new THREE.BoxGeometry(0.05, radius * 2 - 0.1, 0.05);
  for (let i = 0; i < 4; i++) {
    const s = mesh(spokeGeo, MAT.woodLight);
    s.rotation.z = (Math.PI / 4) * i;
    w.add(s);
  }
  return w;
}

// Carroça de madeira com fardos de feno e varais
export function createWagon() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.16, 3.6), MAT.woodLight, 0, 0.7, 0));
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.7, 3.6), MAT.woodRed, sx * 0.98, 1.1, 0));
    for (let i = 0; i < 4; i++) {
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.8, 0.1), MAT.woodDark, sx * 1.02, 1.1, -1.5 + i * 1.0));
    }
  }
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.7, 0.08), MAT.woodRed, 0, 1.1, -1.78));
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.5, 0.08), MAT.woodRed, 0, 1.0, 1.78));
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), MAT.ironRust, 0, 0.55, -1.1));
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), MAT.ironRust, 0, 0.6, 1.1));
  for (const [x, z, r] of [[-1.25, -1.1, 0.55], [1.25, -1.1, 0.55], [-1.25, 1.1, 0.62], [1.25, 1.1, 0.62]]) {
    const w = createWheel(r);
    w.rotation.y = Math.PI / 2;
    w.position.set(x, r, z);
    g.add(w);
  }
  for (const x of [-0.6, 0.6]) {
    const s = mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), MAT.woodDark, x, 0.75, -2.7);
    s.rotation.x = -0.12;
    g.add(s);
  }
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), MAT.hay, -0.4, 1.03, 0.6));
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), MAT.hay, 0.45, 1.03, -0.2));
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), MAT.hay, 0.0, 1.55, 0.2));
  g.userData.collider = { sx: 2.6, sz: 4.0, h: 1.8 };
  return g;
}

// Cavalo de madeira (cavalete de sela em tamanho real)
export function createWoodenHorse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.55, 0.6, 1.5), MAT.woodPale, 0, 1.15, 0));
  const neck = mesh(new THREE.BoxGeometry(0.3, 0.75, 0.32), MAT.woodPale, 0, 1.65, 0.7);
  neck.rotation.x = -0.5;
  g.add(neck);
  const head = mesh(new THREE.BoxGeometry(0.28, 0.3, 0.6), MAT.woodPale, 0, 2.0, 1.0);
  head.rotation.x = 0.35;
  g.add(head);
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), MAT.woodDark, -0.1, 2.22, 0.85));
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), MAT.woodDark, 0.1, 2.22, 0.85));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.2), MAT.woodDark, 0, 1.95, 0.55));
  for (const [x, z] of [[-0.2, -0.55], [0.2, -0.55], [-0.2, 0.55], [0.2, 0.55]]) {
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), MAT.woodDark, x, 0.45, z));
  }
  const tail = mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), MAT.woodDark, 0, 1.0, -0.8);
  tail.rotation.x = 0.4;
  g.add(tail);
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), MAT.leather, 0, 1.5, -0.1));
  g.userData.collider = { sx: 0.8, sz: 1.7, h: 2.2 };
  return g;
}

// Estábulo aberto: postes, telhado inclinado com tábuas, cocho, feno e cavalo de madeira
export function createStable() {
  const g = new THREE.Group();
  const w = 7, d = 5;
  for (const [x, z, h] of [[-w / 2, -d / 2, 3.6], [w / 2, -d / 2, 3.6], [-w / 2, d / 2, 2.8], [w / 2, d / 2, 2.8]]) {
    g.add(mesh(new THREE.BoxGeometry(0.28, h, 0.28), MAT.woodDark, x, h / 2, z));
  }
  const tilt = Math.atan2(0.8, d);
  const roof = mesh(new THREE.BoxGeometry(w + 0.8, 0.2, d + 0.8), MAT.woodRed, 0, 3.2, 0);
  roof.rotation.x = tilt;
  g.add(roof);
  for (let i = 0; i < 6; i++) {
    const z = -d / 2 + i * (d / 5);
    const t = mesh(new THREE.BoxGeometry(w + 0.8, 0.06, 0.25), MAT.woodDark, 0, 3.32 - z * Math.tan(tilt), z);
    t.rotation.x = tilt;
    g.add(t);
  }
  g.add(mesh(new THREE.BoxGeometry(w, 2.8, 0.15), MAT.woodLight, 0, 1.4, -d / 2));
  g.add(mesh(new THREE.BoxGeometry(0.15, 1.3, d), MAT.woodLight, -w / 2, 0.65, 0));
  g.add(mesh(new THREE.BoxGeometry(0.15, 1.3, d), MAT.woodLight, w / 2, 0.65, 0));
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.5, 0.6), MAT.woodDark, -2.0, 0.5, -1.8));
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.2, 0.4), MAT.hay, -2.0, 0.7, -1.8));
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.6, 0.8), MAT.hay, 2.4, 0.3, -1.6));
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.6, 0.8), MAT.hay, 2.4, 0.9, -1.5));
  const horse = createWoodenHorse();
  horse.position.set(0.6, 0, -0.4);
  horse.rotation.y = 0.5;
  g.add(horse);
  g.userData.collider = { sx: w + 0.4, sz: d + 0.4, h: 3.5 };
  return g;
}

// Caixa de cartuchos (pickup entre rodadas): caixa verde com faixa de latão e luz
export function createAmmoCrate() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), MAT.ammoBox, 0, 0.3, 0));
  g.add(mesh(new THREE.BoxGeometry(0.74, 0.12, 0.54), MAT.ammoBrass, 0, 0.3, 0));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.08, 0.54), MAT.ammoBrass, 0, 0.53, 0));
  const shellGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6);
  for (let i = 0; i < 4; i++) {
    g.add(mesh(shellGeo, MAT.canLabel, -0.22 + i * 0.15, 0.6, 0));
  }
  const light = new THREE.PointLight(0xffc14d, 1.6, 6, 2);
  light.position.set(0, 0.8, 0);
  g.add(light);
  return g;
}
