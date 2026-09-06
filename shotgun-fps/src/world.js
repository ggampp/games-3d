import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { MAT } from './materials.js';
import { CollisionWorld } from './collision.js';
import { createBarrel, createCrate, createCactus, createWagon, createStable } from './props.js';

const FONT = new FontLoader().parse(helvetikerBold);

// Gerador da cidade western low-poly.
// Retorna: { update, collision, solids, spawnPoints, targetAnchors }
export function createWesternWorld(scene) {
  // 1. Iluminação (sol de meio-dia + preenchimento do céu)
  scene.add(new THREE.AmbientLight(0xf2dfc6, 0.65));

  const sunLight = new THREE.DirectionalLight(0xfffae6, 1.8);
  sunLight.position.set(35, 55, 25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 160;
  const d = 45;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  const skyFill = new THREE.DirectionalLight(0x8faec7, 0.5);
  skyFill.position.set(-25, 20, -20);
  scene.add(skyFill);

  scene.fog = new THREE.FogExp2(0xd1a97d, 0.012);
  scene.background = new THREE.Color(0xd1a97d);

  const collision = new CollisionWorld();
  const solids = [];        // meshes que bloqueiam os pellets (raycast)
  const spawnPoints = [];   // { pos: Vector3, type: 'door'|'window'|'balcony'|'roof'|'street', facing }
  const targetAnchors = []; // { pos: Vector3, kind: 'can'|'bottle'|'cutout' }

  // 2. Chão de terra batida irregular (rua central lisa)
  const groundGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const distFromRoad = Math.abs(x);
    const bump = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.25 + (Math.random() - 0.5) * 0.08;
    if (distFromRoad > 6) pos.setY(i, bump * (distFromRoad * 0.15));
    else pos.setY(i, (Math.random() - 0.5) * 0.05);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, MAT.ground);
  ground.receiveShadow = true;
  scene.add(ground);
  solids.push(ground);

  // 3. Prédios. Cada prédio registra colisores e pontos de spawn.
  const buildings = [
    { name: 'SALOON', width: 14, depth: 18, height: 10, mat: MAT.woodLight, floors: 2, pos: [0, 0, -32], rot: 0 },
    { name: 'ARMAZEM', width: 10, depth: 12, height: 7, mat: MAT.woodLight, floors: 1, pos: [-13, 0, -14], rot: Math.PI / 2 },
    { name: 'BANCO', width: 11, depth: 14, height: 9, mat: MAT.adobe, floors: 2, pos: [-14, 0, 8], rot: Math.PI / 2 },
    { name: 'XERIFE', width: 10, depth: 12, height: 7, mat: MAT.woodLight, floors: 1, pos: [13, 0, -14], rot: -Math.PI / 2 },
    { name: 'HOTEL', width: 12, depth: 15, height: 10, mat: MAT.woodLight, floors: 2, pos: [14, 0, 8], rot: -Math.PI / 2 },
  ];

  for (const b of buildings) {
    const built = createBuilding(b);
    built.group.position.set(...b.pos);
    built.group.rotation.y = b.rot;
    scene.add(built.group);
    built.group.updateMatrixWorld(true);

    // Colisão: corpo do prédio + pilares da varanda
    collision.addFromObject(built.body, 0.15);
    for (const p of built.pillars) collision.addFromObject(p, 0.05);
    built.group.traverse((o) => { if (o.isMesh) solids.push(o); });

    for (const sp of built.spawns) {
      spawnPoints.push({
        pos: sp.pos.applyMatrix4(built.group.matrixWorld),
        type: sp.type,
        building: b.name,
      });
    }
    for (const a of built.anchors) {
      targetAnchors.push({ pos: a.pos.applyMatrix4(built.group.matrixWorld), kind: a.kind });
    }
  }

  // 4. Caixas d'água
  const waterTower = createWaterTower();
  waterTower.position.set(16, 0, -28);
  scene.add(waterTower);
  const waterTower2 = createWaterTower();
  waterTower2.position.set(-18, 0, -26);
  waterTower2.scale.setScalar(0.85);
  scene.add(waterTower2);
  for (const t of [waterTower, waterTower2]) {
    t.updateMatrixWorld(true);
    t.traverse((o) => { if (o.isMesh) solids.push(o); });
    for (const leg of t.userData.legs) collision.addFromObject(leg, 0.1);
  }
  // Plataforma da caixa d'água como ponto de spawn de telhado
  spawnPoints.push({ pos: new THREE.Vector3(16, 8.7, -25.0), type: 'roof', building: 'TORRE' });

  // 5. Estábulo com cavalo de madeira (lado esquerdo, depois do banco)
  const stable = createStable();
  stable.position.set(-16, 0, 24);
  stable.rotation.y = Math.PI / 2;
  scene.add(stable);
  stable.updateMatrixWorld(true);
  stable.traverse((o) => { if (o.isMesh) solids.push(o); });
  // colisores: postes, paredes e cavalo (filhos específicos)
  stable.children.forEach((c, i) => {
    if (i < 4) collision.addFromObject(c, 0.05);            // postes
  });
  collision.addBoxAt(-18.6, 24, 0.6, 7.4, 2.8);              // parede dos fundos
  collision.addBoxAt(-16, 20.5, 5.4, 0.5, 1.3);              // laterais
  collision.addBoxAt(-16, 27.5, 5.4, 0.5, 1.3);
  collision.addBoxAt(-15.6, 23.4, 1.7, 1.0, 2.2);            // cavalo
  spawnPoints.push({ pos: new THREE.Vector3(-13.2, 0, 24), type: 'street', building: 'ESTABULO' });

  // 6. Carroça na rua (cobertura perto do jogador)
  const wagon = createWagon();
  wagon.position.set(7.2, 0, 22);
  wagon.rotation.y = 0.35;
  scene.add(wagon);
  wagon.updateMatrixWorld(true);
  wagon.traverse((o) => { if (o.isMesh) solids.push(o); });
  collision.addFromObject(wagon, -0.2);
  targetAnchors.push({ pos: new THREE.Vector3(7.0, 1.85, 22.6), kind: 'bottle' });
  targetAnchors.push({ pos: new THREE.Vector3(7.6, 1.85, 21.4), kind: 'can' });

  // 7. Props: caixotes, barris, cactos, pedras
  const propGroup = new THREE.Group();
  const place = (obj, x, z, ry = Math.random() * Math.PI) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    propGroup.add(obj);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { if (o.isMesh) solids.push(o); });
    const c = obj.userData.collider;
    if (c) {
      const s = Math.max(c.sx, c.sz);
      collision.addBoxAt(x, z, s, s, c.h);
    }
    return obj;
  };

  const crateCoords = [[-6.5, -8], [-6.8, -9.2], [6.5, -7], [6.3, -6], [-2, -22], [2.5, -23], [-7, 14]];
  crateCoords.forEach(([x, z]) => place(createCrate(), x, z).position.y = 0.45);
  const stacked = createCrate();
  stacked.position.set(-6.5, 1.35, -8);
  propGroup.add(stacked);
  stacked.traverse((o) => { if (o.isMesh) solids.push(o); });
  targetAnchors.push({ pos: new THREE.Vector3(-6.5, 1.8, -8), kind: 'can' });
  targetAnchors.push({ pos: new THREE.Vector3(6.5, 0.9, -7), kind: 'bottle' });
  targetAnchors.push({ pos: new THREE.Vector3(2.5, 0.9, -23), kind: 'can' });

  const barrelCoords = [[-6.5, -5], [6.5, -11], [6.8, -10], [-6.5, 4], [7, 3], [-3.5, -23], [-8, 18], [6.5, 14]];
  barrelCoords.forEach(([x, z]) => place(createBarrel(), x, z));
  targetAnchors.push({ pos: new THREE.Vector3(-6.5, 1.1, -5), kind: 'bottle' });
  targetAnchors.push({ pos: new THREE.Vector3(6.5, 1.1, -11), kind: 'can' });
  targetAnchors.push({ pos: new THREE.Vector3(-6.5, 1.1, 4), kind: 'can' });
  targetAnchors.push({ pos: new THREE.Vector3(7, 1.1, 3), kind: 'bottle' });
  targetAnchors.push({ pos: new THREE.Vector3(-3.5, 1.1, -23), kind: 'bottle' });
  targetAnchors.push({ pos: new THREE.Vector3(-8, 1.1, 18), kind: 'can' });

  const cactusCoords = [[-24, -10, 1], [-26, 15, 1.2], [24, -8, 0.9], [26, 20, 1.1], [-18, 34, 1], [18, 30, 1.3], [-2, 40, 1], [22, 2, 0.8], [-24, 0, 0.9]];
  cactusCoords.forEach(([x, z, s]) => place(createCactus(s), x, z));

  for (let i = 0; i < 28; i++) {
    const rGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.8, 0);
    const rMesh = new THREE.Mesh(rGeo, MAT.rock);
    const rx = (Math.random() - 0.5) * 80;
    const rz = (Math.random() - 0.5) * 80;
    if (Math.abs(rx) > 9 && Math.abs(rx) < 40) {
      rMesh.position.set(rx, 0.3, rz);
      rMesh.scale.set(1 + Math.random() * 0.6, 0.6 + Math.random() * 0.8, 1 + Math.random() * 0.6);
      rMesh.castShadow = true;
      propGroup.add(rMesh);
      solids.push(rMesh);
    }
  }
  scene.add(propGroup);

  // Alvos de madeira (silhuetas de bandido) no fim da rua e nas laterais
  targetAnchors.push({ pos: new THREE.Vector3(-4, 0, -26), kind: 'cutout' });
  targetAnchors.push({ pos: new THREE.Vector3(4.5, 0, -26.5), kind: 'cutout' });
  targetAnchors.push({ pos: new THREE.Vector3(-8.5, 0, 0), kind: 'cutout' });
  targetAnchors.push({ pos: new THREE.Vector3(8.5, 0, -2), kind: 'cutout' });
  targetAnchors.push({ pos: new THREE.Vector3(0, 0, 34), kind: 'cutout' });

  // Spawns de rua (bandidos que avançam)
  spawnPoints.push({ pos: new THREE.Vector3(0, 0, -24), type: 'street', building: 'RUA' });
  spawnPoints.push({ pos: new THREE.Vector3(-3, 0, 36), type: 'street', building: 'RUA' });
  spawnPoints.push({ pos: new THREE.Vector3(4, 0, 38), type: 'street', building: 'RUA' });

  // 8. Poeira flutuante
  const dustCount = 350;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 70;
    dustPositions[i * 3 + 1] = 0.2 + Math.random() * 4.0;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xe8caa4, size: 0.12, transparent: true, opacity: 0.55 });
  const dustParticles = new THREE.Points(dustGeo, dustMat);
  scene.add(dustParticles);

  return {
    dustParticles,
    collision,
    solids,
    spawnPoints,
    targetAnchors,
    update(delta) {
      const p = dustParticles.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        let x = p.getX(i) + delta * 1.8;
        let z = p.getZ(i) - delta * 0.8;
        if (x > 35) x = -35;
        if (z < -35) z = 35;
        p.setX(i, x);
        p.setZ(i, z);
      }
      p.needsUpdate = true;
    },
  };
}

function box(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// Janela com caixilho (moldura, travessas, peitoril e vidro escuro recuado).
// Fica encostada em uma parede cujo plano é z = zFace (normal +z no espaço local do prédio).
function addWindow(group, x, y, zFace, w = 1.2, h = 1.6, mat = MAT.woodDark) {
  const t = 0.1;
  const g = new THREE.Group();
  g.position.set(x, y, zFace);
  g.add(box(w + t * 2, t, t * 1.6, mat, 0, h / 2, 0));
  g.add(box(w + t * 2, t, t * 1.6, mat, 0, -h / 2, 0));
  g.add(box(t, h, t * 1.6, mat, -w / 2, 0, 0));
  g.add(box(t, h, t * 1.6, mat, w / 2, 0, 0));
  g.add(box(0.05, h, 0.06, mat, 0, 0, 0.02));        // montante central
  g.add(box(w, 0.05, 0.06, mat, 0, 0.1, 0.02));      // travessa
  g.add(box(w + 0.5, 0.12, 0.35, mat, 0, -h / 2 - 0.1, 0.1)); // peitoril
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glassDark);
  glass.position.z = -0.03;
  g.add(glass);
  group.add(g);
  return g;
}

// Grade de varanda com balaústres instanciados (1 draw call por trecho)
function addRailing(group, x0, x1, y, z, mat = MAT.woodDark) {
  const len = Math.abs(x1 - x0);
  const cx = (x0 + x1) / 2;
  group.add(box(len, 0.08, 0.1, mat, cx, y + 0.95, z));
  group.add(box(len, 0.06, 0.08, mat, cx, y + 0.1, z));
  const count = Math.max(2, Math.floor(len / 0.32));
  const balGeo = new THREE.BoxGeometry(0.06, 0.85, 0.06);
  const inst = new THREE.InstancedMesh(balGeo, MAT.woodPale, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const bx = x0 + (len / count) * (i + 0.5);
    m.makeTranslation(bx, y + 0.52, z);
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = true;
  group.add(inst);
}

// Letreiro em relevo: tábua com moldura e letras extrudadas (TextGeometry)
function addSign(group, text, width, y, z) {
  const boardW = Math.min(width * 0.8, text.length * 0.75 + 1.2);
  group.add(box(boardW, 1.3, 0.16, MAT.woodRed, 0, y, z));
  group.add(box(boardW + 0.2, 0.12, 0.26, MAT.woodDark, 0, y + 0.65, z));
  group.add(box(boardW + 0.2, 0.12, 0.26, MAT.woodDark, 0, y - 0.65, z));
  group.add(box(0.12, 1.4, 0.26, MAT.woodDark, -boardW / 2, y, z));
  group.add(box(0.12, 1.4, 0.26, MAT.woodDark, boardW / 2, y, z));

  const geo = new TextGeometry(text, {
    font: FONT,
    size: 0.62,
    depth: 0.1,
    curveSegments: 2,
    bevelEnabled: false,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
  const letters = new THREE.Mesh(geo, MAT.signGold);
  letters.position.set(0, y, z + 0.08);
  letters.castShadow = true;
  group.add(letters);
}

// Prédio western: corpo, fachada falsa com cornija, varanda com balaústres,
// janelas com caixilho, porta com moldura, letreiro em relevo, sacada no 2º andar.
function createBuilding({ name, width, depth, height, mat, floors }) {
  const group = new THREE.Group();
  const trim = MAT.woodDark;
  const spawns = [];
  const anchors = [];
  const pillars = [];

  const body = box(width, height, depth, mat, 0, height / 2, 0);
  group.add(body);

  // Vigas verticais de canto e faixas horizontais (relevo na fachada)
  for (const sx of [-1, 1]) {
    group.add(box(0.3, height, 0.3, trim, sx * (width / 2), height / 2, depth / 2));
    group.add(box(0.3, height, 0.3, trim, sx * (width / 2), height / 2, -depth / 2));
  }
  if (floors === 2) {
    group.add(box(width + 0.2, 0.25, 0.25, trim, 0, height * 0.5, depth / 2));
  }

  // Fachada falsa escalonada: seção central alta com cornija e frontão, laterais baixas
  const parapetH = 2.0;
  const sideH = 0.9;
  const midW = width * 0.5;
  group.add(box(midW + 0.4, parapetH, 0.4, trim, 0, height + parapetH / 2, depth / 2 - 0.1));
  group.add(box(midW + 0.8, 0.3, 0.7, mat, 0, height + parapetH + 0.1, depth / 2 - 0.05));
  for (const sx of [-1, 1]) {
    const sw = (width - midW) / 2 + 0.2;
    group.add(box(sw, sideH, 0.4, trim, sx * (midW / 2 + sw / 2 - 0.2), height + sideH / 2, depth / 2 - 0.1));
    group.add(box(sw + 0.2, 0.25, 0.6, mat, sx * (midW / 2 + sw / 2 - 0.2), height + sideH + 0.08, depth / 2 - 0.05));
  }
  const pediment = new THREE.Mesh(new THREE.CylinderGeometry(0, midW * 0.35, 0.8, 3), trim);
  pediment.rotation.y = Math.PI;
  pediment.position.set(0, height + parapetH + 0.65, depth / 2 - 0.1);
  pediment.scale.z = 0.35;
  pediment.castShadow = true;
  group.add(pediment);

  // Varanda
  const porchDepth = 3.5;
  const porchZ = depth / 2 + porchDepth / 2;
  const porchFloor = box(width + 0.6, 0.3, porchDepth, trim, 0, 0.15, porchZ);
  group.add(porchFloor);
  // degraus
  group.add(box(2.4, 0.15, 0.5, trim, 0, 0.075, depth / 2 + porchDepth + 0.25));
  const roof = box(width + 0.6, 0.25, porchDepth, trim, 0, 3.8, porchZ);
  group.add(roof);
  const pillarCount = 4;
  for (let p = 0; p < pillarCount; p++) {
    const px = -width / 2 + (width / (pillarCount - 1)) * p;
    const pillar = box(0.24, 3.8, 0.24, trim, px, 1.9, depth / 2 + porchDepth - 0.15);
    group.add(pillar);
    pillars.push(pillar);
    // mão-francesa
    const brace = box(0.12, 0.6, 0.12, trim, px + 0.25, 3.4, depth / 2 + porchDepth - 0.15);
    brace.rotation.z = -0.8;
    group.add(brace);
  }
  // grade da varanda (deixa passagem no centro)
  const railZ = depth / 2 + porchDepth - 0.15;
  addRailing(group, -width / 2 + 0.15, -1.4, 0.3, railZ);
  addRailing(group, 1.4, width / 2 - 0.15, 0.3, railZ);

  // Porta com moldura e batentes
  const doorW = 1.6, doorH = 2.6;
  group.add(box(doorW + 0.3, doorH + 0.15, 0.2, trim, 0, doorH / 2 + 0.05, depth / 2 + 0.05));
  group.add(box(doorW, doorH, 0.1, MAT.woodRed, 0, doorH / 2, depth / 2 + 0.12));
  group.add(box(0.05, doorH - 0.2, 0.05, trim, 0, doorH / 2, depth / 2 + 0.2));
  group.add(box(doorW - 0.3, 0.12, 0.05, trim, 0, doorH * 0.35, depth / 2 + 0.2));

  // Janelas do térreo
  const winY = 1.7;
  addWindow(group, -width * 0.3, winY, depth / 2 + 0.06);
  addWindow(group, width * 0.3, winY, depth / 2 + 0.06);

  // Sacada e janelas do 2º andar
  if (floors === 2) {
    const balY = 3.95;
    addRailing(group, -width / 2 - 0.15, width / 2 + 0.15, balY, depth / 2 + porchDepth - 0.15);
    // laterais da sacada
    for (const sx of [-1, 1]) {
      const sideRail = new THREE.Group();
      addRailing(sideRail, 0, porchDepth - 0.3, 0, 0);
      sideRail.rotation.y = Math.PI / 2;
      sideRail.position.set(sx * (width / 2 + 0.15), balY, depth / 2 + porchDepth - 0.15);
      group.add(sideRail);
    }
    const upperY = height * 0.5 + 1.6;
    addWindow(group, -width * 0.3, upperY, depth / 2 + 0.06);
    addWindow(group, width * 0.3, upperY, depth / 2 + 0.06);
    // porta da sacada
    group.add(box(1.3, 2.3, 0.15, trim, 0, balY + 1.15, depth / 2 + 0.06));
    group.add(box(1.0, 2.0, 0.1, MAT.woodRed, 0, balY + 1.1, depth / 2 + 0.12));
    spawns.push({ pos: new THREE.Vector3(-width * 0.28, balY + 0.1, depth / 2 + 1.5), type: 'balcony' });
    spawns.push({ pos: new THREE.Vector3(width * 0.28, balY + 0.1, depth / 2 + 1.5), type: 'balcony' });
  }

  // Janelas laterais (uma por andar)
  for (const sx of [-1, 1]) {
    const side = new THREE.Group();
    addWindow(side, 0, winY, 0);
    if (floors === 2) addWindow(side, 0, height * 0.5 + 1.6, 0);
    side.rotation.y = sx * Math.PI / 2;
    side.position.set(sx * (width / 2 + 0.06), 0, -depth * 0.1);
    group.add(side);
  }

  // Letreiro
  addSign(group, name, midW + 0.4, height + 0.85, depth / 2 + 0.22);

  // Telhado: platibanda lateral baixa (esconde parcialmente quem está em cima)
  group.add(box(0.3, 0.6, depth, trim, -width / 2, height + 0.3, 0));
  group.add(box(0.3, 0.6, depth, trim, width / 2, height + 0.3, 0));

  // Pontos de spawn
  spawns.push({ pos: new THREE.Vector3(0, 0.3, depth / 2 + 1.2), type: 'door' });
  spawns.push({ pos: new THREE.Vector3(-width * 0.3, 0.3, depth / 2 + 1.4), type: 'window' });
  spawns.push({ pos: new THREE.Vector3(width * 0.3, 0.3, depth / 2 + 1.4), type: 'window' });
  spawns.push({ pos: new THREE.Vector3(-width / 2 + 1.2, height, depth / 2 - 0.9), type: 'roof' });
  spawns.push({ pos: new THREE.Vector3(width / 2 - 1.2, height, depth / 2 - 0.9), type: 'roof' });

  // Âncoras de alvos: latas na grade da varanda
  anchors.push({ pos: new THREE.Vector3(-width / 2 + 1.0, 1.3, railZ), kind: 'can' });
  anchors.push({ pos: new THREE.Vector3(width / 2 - 1.0, 1.3, railZ), kind: 'bottle' });

  return { group, body, pillars, spawns, anchors };
}

// Caixa d'água de madeira com quatro pernas, travessas em X, tanque com aros e telhado cônico
function createWaterTower() {
  const group = new THREE.Group();
  const legMat = MAT.woodDark;
  const legHeight = 9;
  const spread = 2.4;
  const legs = [];
  for (const [x, z] of [[-spread, spread], [spread, spread], [-spread, -spread], [spread, -spread]]) {
    const leg = box(0.25, legHeight, 0.25, legMat, x, legHeight / 2, z);
    leg.rotation.set(-z / spread * 0.06, 0, x / spread * 0.06);
    group.add(leg);
    legs.push(leg);
  }
  for (let h = 2.5; h <= 7.5; h += 2.5) {
    for (const s of [-1, 1]) {
      group.add(box(spread * 2 + 0.4, 0.15, 0.15, legMat, 0, h, s * spread));
      group.add(box(0.15, 0.15, spread * 2 + 0.4, legMat, s * spread, h, 0));
      const x1 = box(0.12, 0.12, spread * 2.6, legMat, 0, h + 1.2, s * spread);
      x1.rotation.y = Math.PI / 2;
      x1.rotation.z = 0.75;
      group.add(x1);
      const x2 = box(0.12, 0.12, spread * 2.6, legMat, 0, h + 1.2, s * spread);
      x2.rotation.y = Math.PI / 2;
      x2.rotation.z = -0.75;
      group.add(x2);
    }
  }
  // plataforma
  group.add(box(spread * 2 + 1.6, 0.2, spread * 2 + 1.6, legMat, 0, legHeight - 0.4, 0));
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.5, 4.0, 12), MAT.woodLight);
  tank.position.set(0, legHeight + 2.0, 0);
  tank.castShadow = true;
  group.add(tank);
  for (const hy of [legHeight + 0.5, legHeight + 2.0, legHeight + 3.5]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.68, 0.12, 12, 1, true), MAT.iron);
    hoop.material = MAT.iron.clone();
    hoop.material.side = THREE.DoubleSide;
    hoop.position.set(0, hy, 0);
    group.add(hoop);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.6, 12), legMat);
  roof.position.set(0, legHeight + 4.8, 0);
  roof.castShadow = true;
  group.add(roof);
  group.userData.legs = legs;
  return group;
}
