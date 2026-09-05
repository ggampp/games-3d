import * as THREE from 'three';

// Western Town Low-Poly Environment Generator
export function createWesternWorld(scene) {
  // 1. Lighting Setup (Three-Point Western Sun)
  const ambientLight = new THREE.AmbientLight(0xf2dfc6, 0.65);
  scene.add(ambientLight);

  // High noon desert sun
  const sunLight = new THREE.DirectionalLight(0xfffae6, 1.8);
  sunLight.position.set(35, 55, 25);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 160;
  const d = 40;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  // Soft sky bounce fill light
  const skyFill = new THREE.DirectionalLight(0x8faec7, 0.5);
  skyFill.position.set(-25, 20, -20);
  scene.add(skyFill);

  // Atmospheric Fog (Dust haze)
  scene.fog = new THREE.FogExp2(0xd1a97d, 0.012);
  scene.background = new THREE.Color(0xd1a97d);

  // 2. Materials
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xc89b6b, // Sunbaked dusty earth
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  const woodLightMat = new THREE.MeshStandardMaterial({
    color: 0x9f7a55, // Weathered cedar planks
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });

  const woodDarkMat = new THREE.MeshStandardMaterial({
    color: 0x6e4e32, // Dark weathered wood
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });

  const adobeMat = new THREE.MeshStandardMaterial({
    color: 0xb58c67, // Clay adobe plaster
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  const cactusMat = new THREE.MeshStandardMaterial({
    color: 0x4a6b3e, // Desert saguaro green
    roughness: 0.7,
    metalness: 0.05,
    flatShading: true,
  });

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x826d5b, // Desert granite
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  // 3. Ground Plane with Low-Poly Uneven Dirt Road
  const groundGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Keep main street (x between -6 and 6) relatively smooth, add subtle bumps outside
    const distFromRoad = Math.abs(x);
    const bump = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.25 + (Math.random() - 0.5) * 0.08;
    if (distFromRoad > 6) {
      pos.setY(i, bump * (distFromRoad * 0.15));
    } else {
      pos.setY(i, (Math.random() - 0.5) * 0.05);
    }
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Group for collidable / interactable world structures
  const structures = [];

  // 4. Saloon (Centerpiece at the end of the street, z = -32)
  const saloon = createBuilding({
    width: 14,
    depth: 18,
    height: 10,
    mainMat: woodLightMat,
    trimMat: woodDarkMat,
    hasPorch: true,
    hasSign: true,
    signText: 'SALOON',
    floors: 2,
  });
  saloon.position.set(0, 0, -32);
  scene.add(saloon);
  structures.push(saloon);

  // 5. Left Side Buildings (Western Street)
  const generalStore = createBuilding({
    width: 10,
    depth: 12,
    height: 7,
    mainMat: woodLightMat,
    trimMat: woodDarkMat,
    hasPorch: true,
    hasSign: true,
    signText: 'GENERAL STORE',
    floors: 1,
  });
  generalStore.position.set(-13, 0, -14);
  generalStore.rotation.y = Math.PI / 2;
  scene.add(generalStore);
  structures.push(generalStore);

  const bank = createBuilding({
    width: 11,
    depth: 14,
    height: 9,
    mainMat: adobeMat,
    trimMat: woodDarkMat,
    hasPorch: true,
    hasSign: true,
    signText: 'BANK',
    floors: 2,
  });
  bank.position.set(-14, 0, 8);
  bank.rotation.y = Math.PI / 2;
  scene.add(bank);
  structures.push(bank);

  // 6. Right Side Buildings
  const sheriff = createBuilding({
    width: 10,
    depth: 12,
    height: 7,
    mainMat: woodLightMat,
    trimMat: woodDarkMat,
    hasPorch: true,
    hasSign: true,
    signText: 'SHERIFF',
    floors: 1,
  });
  sheriff.position.set(13, 0, -14);
  sheriff.rotation.y = -Math.PI / 2;
  scene.add(sheriff);
  structures.push(sheriff);

  const hotel = createBuilding({
    width: 12,
    depth: 15,
    height: 10,
    mainMat: woodLightMat,
    trimMat: woodDarkMat,
    hasPorch: true,
    hasSign: true,
    signText: 'HOTEL',
    floors: 2,
  });
  hotel.position.set(14, 0, 8);
  hotel.rotation.y = -Math.PI / 2;
  scene.add(hotel);
  structures.push(hotel);

  // 7. Water Tower (Right side near the Saloon)
  const waterTower = createWaterTower(woodDarkMat, woodLightMat);
  waterTower.position.set(16, 0, -28);
  scene.add(waterTower);

  const waterTower2 = createWaterTower(woodDarkMat, woodLightMat);
  waterTower2.position.set(-18, 0, -26);
  waterTower2.scale.set(0.85, 0.85, 0.85);
  scene.add(waterTower2);

  // 8. Western Props: Wooden Crates & Barrels along porches
  const propGroup = new THREE.Group();
  
  // Crates
  const crateGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const crateCoords = [
    [-6.5, 0.45, -8], [-6.2, 1.35, -8], [-6.8, 0.45, -9],
    [6.5, 0.45, -7], [6.3, 0.45, -6],
    [-2, 0.45, -22], [2.5, 0.45, -23]
  ];
  crateCoords.forEach(([x, y, z]) => {
    const crate = new THREE.Mesh(crateGeo, woodLightMat);
    crate.position.set(x, y, z);
    crate.rotation.y = Math.random() * Math.PI;
    crate.castShadow = true;
    crate.receiveShadow = true;
    propGroup.add(crate);
  });

  // Barrels
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 8);
  const barrelCoords = [
    [-6.5, 0.55, -5], [6.5, 0.55, -11], [6.8, 0.55, -10],
    [-6.5, 0.55, 4], [7, 0.55, 3], [-3.5, 0.55, -23]
  ];
  barrelCoords.forEach(([x, y, z]) => {
    const b = new THREE.Mesh(barrelGeo, woodDarkMat);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    propGroup.add(b);
  });

  // Saguaro Cacti
  const cactusCoords = [
    [-24, 0, -10], [-26, 0, 15], [24, 0, -8], [26, 0, 20],
    [-18, 0, 32], [18, 0, 30], [-2, 0, 38]
  ];
  cactusCoords.forEach(([x, y, z]) => {
    const c = createSaguaroCactus(cactusMat);
    c.position.set(x, y, z);
    c.rotation.y = Math.random() * Math.PI * 2;
    propGroup.add(c);
  });

  // Desert Rocks
  for (let i = 0; i < 28; i++) {
    const rGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.8, 0);
    const rMesh = new THREE.Mesh(rGeo, rockMat);
    const rx = (Math.random() - 0.5) * 80;
    const rz = (Math.random() - 0.5) * 80;
    if (Math.abs(rx) > 5) { // don't block center road
      rMesh.position.set(rx, 0.3, rz);
      rMesh.scale.set(1 + Math.random() * 0.6, 0.6 + Math.random() * 0.8, 1 + Math.random() * 0.6);
      rMesh.castShadow = true;
      propGroup.add(rMesh);
    }
  }

  scene.add(propGroup);

  // 9. Floating Desert Dust Particles
  const dustCount = 350;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 70;
    dustPositions[i * 3 + 1] = 0.2 + Math.random() * 4.0;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xe8caa4,
    size: 0.12,
    transparent: true,
    opacity: 0.55,
  });
  const dustParticles = new THREE.Points(dustGeo, dustMat);
  scene.add(dustParticles);

  return {
    dustParticles,
    update(delta) {
      // Wind blowing dust slowly along X/Z
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
    }
  };
}

// Procedural Western Building with False-front Facade & Porch
function createBuilding({ width, depth, height, mainMat, trimMat, hasPorch, hasSign, signText, floors }) {
  const group = new THREE.Group();

  // Main body
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const body = new THREE.Mesh(bodyGeo, mainMat);
  body.position.set(0, height / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // False front western parapet on top
  const parapetHeight = 2.4;
  const parapetGeo = new THREE.BoxGeometry(width + 0.4, parapetHeight, 0.4);
  const parapet = new THREE.Mesh(parapetGeo, trimMat);
  parapet.position.set(0, height + parapetHeight / 2, depth / 2 - 0.1);
  parapet.castShadow = true;
  group.add(parapet);

  // Wooden Porch
  if (hasPorch) {
    const porchDepth = 3.5;
    const porchFloorGeo = new THREE.BoxGeometry(width + 0.6, 0.3, porchDepth);
    const porchFloor = new THREE.Mesh(porchFloorGeo, trimMat);
    porchFloor.position.set(0, 0.15, depth / 2 + porchDepth / 2);
    porchFloor.receiveShadow = true;
    group.add(porchFloor);

    // Porch Roof
    const roofGeo = new THREE.BoxGeometry(width + 0.6, 0.25, porchDepth);
    const roof = new THREE.Mesh(roofGeo, trimMat);
    roof.position.set(0, 3.8, depth / 2 + porchDepth / 2);
    roof.castShadow = true;
    group.add(roof);

    // Support pillars
    const pillarCount = 4;
    for (let p = 0; p < pillarCount; p++) {
      const px = -width / 2 + (width / (pillarCount - 1)) * p;
      const pillarGeo = new THREE.BoxGeometry(0.24, 3.8, 0.24);
      const pillar = new THREE.Mesh(pillarGeo, trimMat);
      pillar.position.set(px, 1.9, depth / 2 + porchDepth - 0.15);
      pillar.castShadow = true;
      group.add(pillar);
    }
  }

  // Windows & Doors
  const doorGeo = new THREE.BoxGeometry(1.6, 2.6, 0.1);
  const door = new THREE.Mesh(doorGeo, trimMat);
  door.position.set(0, 1.3, depth / 2 + 0.05);
  group.add(door);

  // Sign Board
  if (hasSign && signText) {
    const signBoardGeo = new THREE.BoxGeometry(width * 0.65, 1.2, 0.18);
    const signBoard = new THREE.Mesh(signBoardGeo, trimMat);
    signBoard.position.set(0, height + 0.8, depth / 2 + 0.12);
    group.add(signBoard);

    // Procedural 2D canvas text texture for sign
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#422a18';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#27170a';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = '#ffdf9e';
    ctx.font = 'bold 54px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(signText, 256, 64);

    const signTex = new THREE.CanvasTexture(canvas);
    signTex.minFilter = THREE.LinearFilter;
    const textMeshGeo = new THREE.PlaneGeometry(width * 0.62, 1.05);
    const textMeshMat = new THREE.MeshBasicMaterial({ map: signTex });
    const textMesh = new THREE.Mesh(textMeshGeo, textMeshMat);
    textMesh.position.set(0, height + 0.8, depth / 2 + 0.22);
    group.add(textMesh);
  }

  return group;
}

// Classic 4-legged wooden water tower
function createWaterTower(legMat, tankMat) {
  const group = new THREE.Group();

  // 4 Legs
  const legHeight = 9;
  const spread = 2.4;
  const legGeo = new THREE.BoxGeometry(0.25, legHeight, 0.25);

  const coords = [
    [-spread, spread], [spread, spread],
    [-spread, -spread], [spread, -spread]
  ];
  coords.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, legHeight / 2, z);
    leg.castShadow = true;
    group.add(leg);
  });

  // Cross beams
  for (let h = 2.5; h <= 7.5; h += 2.5) {
    const beamGeo = new THREE.BoxGeometry(spread * 2 + 0.4, 0.15, 0.15);
    const b1 = new THREE.Mesh(beamGeo, legMat);
    b1.position.set(0, h, spread);
    group.add(b1);
    const b2 = new THREE.Mesh(beamGeo, legMat);
    b2.position.set(0, h, -spread);
    group.add(b2);
  }

  // Wooden tank on top
  const tankGeo = new THREE.CylinderGeometry(2.6, 2.6, 4.0, 10);
  const tank = new THREE.Mesh(tankGeo, tankMat);
  tank.position.set(0, legHeight + 2.0, 0);
  tank.castShadow = true;
  group.add(tank);

  // Conical roof
  const roofGeo = new THREE.ConeGeometry(3.0, 1.6, 10);
  const roof = new THREE.Mesh(roofGeo, legMat);
  roof.position.set(0, legHeight + 4.8, 0);
  roof.castShadow = true;
  group.add(roof);

  return group;
}

// Low-poly desert saguaro cactus
function createSaguaroCactus(mat) {
  const group = new THREE.Group();

  // Main trunk
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.38, 4.5, 7);
  const trunk = new THREE.Mesh(trunkGeo, mat);
  trunk.position.set(0, 2.25, 0);
  trunk.castShadow = true;
  group.add(trunk);

  // Left arm
  const armL1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 6), mat);
  armL1.rotation.z = Math.PI / 2;
  armL1.position.set(-0.7, 2.5, 0);
  armL1.castShadow = true;
  group.add(armL1);

  const armL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 6), mat);
  armL2.position.set(-1.2, 3.1, 0);
  armL2.castShadow = true;
  group.add(armL2);

  // Right arm
  const armR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 6), mat);
  armR1.rotation.z = -Math.PI / 2;
  armR1.position.set(0.65, 1.9, 0);
  armR1.castShadow = true;
  group.add(armR1);

  const armR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 6), mat);
  armR2.position.set(1.1, 2.45, 0);
  armR2.castShadow = true;
  group.add(armR2);

  return group;
}
