/**
 * Train Factory & 3D Procedural Mesh Assembler for Acrobatic Train 3D
 * Assembles specialized 3D train models:
 * 1. Cyber Shinkansen (Default)
 * 2. Steam Train 1880 "Old Iron" (50 pts) - Boiler, chimney, steam smoke, brass whistle
 * 3. Passenger Express (100 pts) - Classic regional streamliner, illuminated windows
 * 4. Aero High-Speed Bullet (1,000 pts) - Hyper-aerodynamic duckbill nose, neon trails
 * 5. Southeastern Class 395 Hitachi Javelin (2,000 pts) - Midnight Blue + Warning Yellow, 12 cars!
 */

// Helper Geometry Factories
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (r, h, segs = 16) => new THREE.CylinderGeometry(r, r, h, segs);
export const xCyl = (r, h, segs = 16) => new THREE.CylinderGeometry(r, r, h, segs).rotateZ(Math.PI / 2);
export const zCyl = (r, h, segs = 16) => new THREE.CylinderGeometry(r, r, h, segs).rotateX(Math.PI / 2);
export const std = (color, metalness = 0.5, roughness = 0.5, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, ...opts });

export const TRAIN_CATALOG = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Shinkansen',
    subtitle: 'Protótipo Experimental',
    price: 0,
    unlockedDefault: true,
    description: 'Composição futurista aerodinâmica com iluminação em neon ciano e alta estabilidade de manobra.',
    badge: 'PADRÃO',
    tagColor: '#00f2fe',
    accentColor: '#00f2fe',
    whistleType: 'cyber',
    maxCars: 1,
    gameplay: { maxSpeedMps: 80 / 3.6, accelerationMps2: 0.35 },
    specs: {
      speed: '80 km/h',
      accel: 'Normal',
      handling: 'Ágil',
      special: 'Underglow Neon Ciano'
    }
  },
  steam: {
    id: 'steam',
    name: 'Steam Train 1880',
    subtitle: 'Maria-Fumaça Histórica',
    price: 50,
    unlockedDefault: false,
    description: 'Caldeira de alta pressão com anéis de latão, chaminé com vapor volumétrico em tempo real e apito clássico.',
    badge: '50 PONTOS',
    tagColor: '#ff9f1c',
    accentColor: '#ff9f1c',
    whistleType: 'steam',
    hasSmoke: true,
    maxCars: 2,
    gameplay: { maxSpeedMps: 75 / 3.6, accelerationMps2: 0.35 },
    specs: {
      speed: '75 km/h',
      accel: 'Torque Alto',
      handling: 'Robusto',
      special: 'Fumaça de Vapor 3D & Apito Clássico'
    }
  },
  passenger: {
    id: 'passenger',
    name: 'Passenger Express',
    subtitle: 'Expresso de Passageiros',
    price: 100,
    unlockedDefault: false,
    description: 'Composição clássica regional em azul e marfim com janelas panorâmicas douradas e buzina bi-tom encorpada.',
    badge: '100 PONTOS',
    tagColor: '#38bdf8',
    accentColor: '#38bdf8',
    whistleType: 'passenger',
    maxCars: 3,
    gameplay: { maxSpeedMps: 82 / 3.6, accelerationMps2: 0.35 },
    specs: {
      speed: '82 km/h',
      accel: 'Equilibrado',
      handling: 'Estável',
      special: 'Salão de Passageiros Iluminado'
    }
  },
  highspeed: {
    id: 'highspeed',
    name: 'Aero High-Speed',
    subtitle: 'Trem-Bala Hipersônico',
    price: 1000,
    unlockedDefault: false,
    description: 'Design ultrarrápido com bico afilado estilo Shinkansen E5, faróis de laser e velocidade máxima aprimorada.',
    badge: '1.000 PONTOS',
    tagColor: '#c084fc',
    accentColor: '#c084fc',
    whistleType: 'highspeed',
    maxCars: 4,
    gameplay: { maxSpeedMps: 95 / 3.6, accelerationMps2: 0.35 },
    speedBoost: 10,
    specs: {
      speed: '95 km/h',
      accel: 'Super Rápido',
      handling: 'Aerodinâmico',
      special: '+10 km/h Vel. Máxima'
    }
  },
  class395: {
    id: 'class395',
    name: 'Southeastern Class 395',
    subtitle: 'Hitachi Javelin (12 Vagões!)',
    price: 2000,
    unlockedDefault: false,
    description: 'O trem mais veloz da Grã-Bretanha! Pintura oficial azul marinho com testeira em amarelo de aviso e 12 vagões em cadeia acrobática!',
    badge: '2.000 PONTOS • LENDÁRIO',
    tagColor: '#ffd100',
    accentColor: '#ffd100',
    whistleType: 'british',
    maxCars: 12,
    gameplay: { maxSpeedMps: 100 / 3.6, accelerationMps2: 0.35 },
    is12Cars: true,
    bonusMultiplier: 1.5,
    specs: {
      speed: '100 km/h',
      accel: 'Máximo',
      handling: 'Composição de 12 Vagões',
      special: '12 Carros & Bônus de Pontuação x1.5'
    }
  }
};

/**
 * Procedural Steam Smoke Particle Emitter for the Steam Train
 */
export class SteamSmokeEmitter {
  constructor(scene, chimneyOffset = new THREE.Vector3(3.2, 3.2, 0)) {
    this.scene = scene;
    this.chimneyOffset = chimneyOffset;
    this.particles = [];
    this.maxParticles = 60;
    this.spawnTimer = 0;
    this.spawnInterval = 0.045;

    // Shared geometry & materials for optimal WebGL performance
    this.geo = new THREE.DodecahedronGeometry(0.24, 1);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  update(dt, trainPosition, trainQuaternion, trainSpeed) {
    this.spawnTimer += dt;
    const interval = Math.max(0.02, this.spawnInterval / (trainSpeed / 30));

    if (this.spawnTimer >= interval && this.particles.length < this.maxParticles) {
      this.spawnTimer = 0;
      this.spawnParticle(trainPosition, trainQuaternion, trainSpeed);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const progress = p.age / p.life;
      // Drift backwards and rise up
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      // Expand and fade out
      const scale = p.baseScale * (1 + progress * 3.5);
      p.mesh.scale.set(scale, scale, scale);
      p.mesh.material.opacity = (1 - progress) * 0.55;
    }
  }

  spawnParticle(trainPos, trainQuat, trainSpeed) {
    const mesh = new THREE.Mesh(this.geo.clone(), this.mat.clone());
    const offset = this.chimneyOffset.clone().applyQuaternion(trainQuat);
    mesh.position.copy(trainPos).add(offset);

    // Randomize initial puff
    const p = {
      mesh,
      age: 0,
      life: 0.8 + Math.random() * 0.5,
      baseScale: 0.7 + Math.random() * 0.5,
      vel: new THREE.Vector3(
        -trainSpeed * 0.35 + (Math.random() - 0.5) * 2,
        2.5 + Math.random() * 2.0,
        (Math.random() - 0.5) * 1.5
      )
    };

    this.group.add(mesh);
    this.particles.push(p);
  }

  dispose() {
    this.particles.forEach((p) => {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.particles = [];
    this.scene.remove(this.group);
    this.geo.dispose();
    this.mat.dispose();
  }
}

/**
 * Builds the body mesh hierarchy for the specified train model
 */
export function buildTrainBody(trainId, constants) {
  const { CAR_LEN, CAR_W, SIDE_H, BODY_Y, ROOF_Y, BOGIE, GAUGE, RAIL_TOP, WHEEL_R, WC } = constants;
  const W2 = CAR_W / 2;
  const noseBaseX = CAR_LEN / 2;
  const rearBaseX = -CAR_LEN / 2;

  const g = new THREE.Group();
  const disposables = { geometries: [], materials: [] };

  const add = (geo, mat, x, y, z, parent = g) => {
    disposables.geometries.push(geo);
    if (!disposables.materials.includes(mat)) disposables.materials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const trainMeta = {
    bodyMeshes: [],
    bandMeshes: [],
    lightSpotlights: [],
    lightBeams: [],
    lightLenses: [],
    accentColor: '#00f2fe',
    chimneyPos: new THREE.Vector3(noseBaseX - 0.6, BODY_Y + 1.8, 0)
  };

  switch (trainId) {
    case 'steam': {
      // ==========================================
      // 1. STEAM TRAIN 1880 (MARIA-FUMAÇA)
      // ==========================================
      const ironMat = std(0x22252a, 0.4, 0.5);
      const boilerMat = std(0x181a1e, 0.6, 0.35);
      const brassMat = std(0xffd166, 0.95, 0.15); // Gleaming brass bands & domes
      const copperMat = std(0xd97706, 0.9, 0.2);
      const cabWoodMat = std(0x4a2810, 0.1, 0.85); // Vintage dark wood cab
      const lampGlowMat = std(0xfff3b0, 0.1, 0.1, { emissive: 0xffb703, emissiveIntensity: 2.8 });
      const cowcatcherMat = std(0x1e242d, 0.7, 0.3);

      trainMeta.accentColor = '#ff9f1c';

      // Horizontal Cylindrical Steam Boiler
      const boilerLen = CAR_LEN * 0.62;
      const boilerR = CAR_W * 0.44;
      const boiler = add(xCyl(boilerR, boilerLen, 24), boilerMat, 0.2, BODY_Y + 0.52, 0);
      trainMeta.bodyMeshes.push(boiler);

      // Boiler Front Circular Smoke-box Face
      add(xCyl(boilerR * 1.02, 0.25, 24), ironMat, 0.2 + boilerLen / 2 + 0.12, BODY_Y + 0.52, 0);
      add(xCyl(boilerR * 0.85, 0.1, 16), ironMat, 0.2 + boilerLen / 2 + 0.26, BODY_Y + 0.52, 0);
      // Smoke-box hinge & center dart wheel
      add(cyl(0.12, 0.1, 8), brassMat, 0.2 + boilerLen / 2 + 0.32, BODY_Y + 0.52, 0);

      // 4 Polished Brass Boiler Straps
      [-1.8, -0.6, 0.6, 1.8].forEach((bx) => {
        const ring = add(xCyl(boilerR + 0.018, 0.07, 24), brassMat, bx, BODY_Y + 0.52, 0);
        trainMeta.bandMeshes.push(ring);
      });

      // Front Smokestack / Chimney (with flared top)
      const chimX = noseBaseX - 1.2;
      const chimBaseY = BODY_Y + 0.52 + boilerR;
      add(cyl(0.24, 0.95, 16), ironMat, chimX, chimBaseY + 0.45, 0);
      // Flared brass lip
      add(cyl(0.35, 0.18, 16), brassMat, chimX, chimBaseY + 0.95, 0);
      trainMeta.chimneyPos.set(chimX, chimBaseY + 1.05, 0);

      // Steam Dome (High dome with safety valve)
      const domeX = 0.4;
      add(cyl(0.32, 0.55, 16), brassMat, domeX, chimBaseY + 0.2, 0);
      add(cyl(0.04, 0.25, 8), copperMat, domeX, chimBaseY + 0.55, 0.1);
      add(cyl(0.04, 0.25, 8), copperMat, domeX, chimBaseY + 0.55, -0.1);

      // Sand Dome
      add(cyl(0.28, 0.45, 16), brassMat, -0.9, chimBaseY + 0.15, 0);

      // Vintage Brass Pilot Headlamp on Front Bracket
      const lampX = 0.2 + boilerLen / 2 + 0.55;
      const lampY = BODY_Y + 0.65;
      add(box(0.15, 0.35, 0.15), brassMat, lampX - 0.1, lampY - 0.2, 0); // bracket
      add(box(0.45, 0.55, 0.45), brassMat, lampX, lampY, 0);
      const lens = add(xCyl(0.18, 0.05, 16), lampGlowMat, lampX + 0.24, lampY, 0);
      trainMeta.lightLenses.push(lens);

      // Front Pilot Cowcatcher (Plow bars)
      const ccX = noseBaseX + 0.3;
      const ccY = BODY_Y - 0.15;
      add(box(0.7, 0.12, CAR_W + 0.1), cowcatcherMat, ccX - 0.2, ccY, 0);
      [-0.6, -0.3, 0, 0.3, 0.6].forEach((cz) => {
        const bar = add(cyl(0.03, 0.65, 8), cowcatcherMat, ccX + 0.15 - Math.abs(cz) * 0.2, ccY + 0.12, cz);
        bar.rotation.z = -0.65;
      });

      // Vintage Driver Cab (-X rear)
      const cabLen = CAR_LEN * 0.32;
      const cabW = CAR_W * 1.04;
      const cabH = SIDE_H * 1.08;
      const cabX = rearBaseX + cabLen / 2 + 0.2;
      const cabY = BODY_Y + cabH / 2 - 0.05;
      const cab = add(box(cabLen, cabH, cabW), cabWoodMat, cabX, cabY, 0);
      trainMeta.bodyMeshes.push(cab);

      // Cab Arched Curved Roof
      const roof = add(box(cabLen + 0.25, 0.14, cabW + 0.18), ironMat, cabX - 0.05, cabY + cabH / 2 + 0.07, 0);
      trainMeta.bodyMeshes.push(roof);

      // Cab Windows with incandescent glow
      [-1, 1].forEach((sd) => {
        add(box(0.65, 0.48, 0.04), lampGlowMat, cabX + 0.2, cabY + 0.25, sd * (cabW / 2 + 0.01));
        add(box(0.45, 0.48, 0.04), lampGlowMat, cabX - 0.5, cabY + 0.25, sd * (cabW / 2 + 0.01));
      });

      // Side Running Boards & Handrails
      [-1, 1].forEach((sd) => {
        add(box(boilerLen + 0.4, 0.06, 0.25), ironMat, 0.1, BODY_Y - 0.02, sd * (boilerR + 0.12));
        add(xCyl(0.02, boilerLen + 0.2, 8), brassMat, 0.1, BODY_Y + 0.55, sd * (boilerR + 0.06));
      });

      // Spotlights for vintage lamp
      const spot = new THREE.SpotLight(0xffbe0b, 2.5, 45, Math.PI / 5.5, 0.4, 1.2);
      spot.position.set(lampX + 0.3, lampY, 0);
      const spotTgt = new THREE.Object3D();
      spotTgt.position.set(lampX + 25, lampY - 0.5, 0);
      g.add(spotTgt);
      spot.target = spotTgt;
      g.add(spot);
      trainMeta.lightSpotlights.push(spot);

      // Volumetric warm headlight cone
      const beamGeo = new THREE.ConeGeometry(2.0, 24, 16);
      beamGeo.rotateZ(-Math.PI / 2);
      beamGeo.translate(12, 0, 0);
      disposables.geometries.push(beamGeo);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffbe0b,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      disposables.materials.push(beamMat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(lampX + 0.3, lampY, 0);
      g.add(beam);
      trainMeta.lightBeams.push(beam);
      break;
    }

    case 'passenger': {
      // ==========================================
      // 2. PASSENGER EXPRESS (REGIONAL CLASSIC)
      // ==========================================
      const bodyMat = std(0x163458, 0.7, 0.28); // Deep Navy Blue
      const creamStripeMat = std(0xf3ebdb, 0.5, 0.4); // Elegant Cream/Ivory band
      const goldTrimMat = std(0xd97706, 0.85, 0.2, { emissive: 0xd97706, emissiveIntensity: 0.4 });
      const windowGlowMat = std(0xffe8a3, 0.2, 0.1, { emissive: 0xffd166, emissiveIntensity: 0.85 }); // Warm passenger interior
      const darkTrimMat = std(0x1e242d, 0.8, 0.3);
      const chromeMat = std(0xf1f5f9, 0.95, 0.1);

      trainMeta.accentColor = '#38bdf8';

      // Main Streamlined Body Shell
      const mainBody = add(box(CAR_LEN - 0.2, SIDE_H, CAR_W), bodyMat, 0, BODY_Y + SIDE_H / 2, 0);
      trainMeta.bodyMeshes.push(mainBody);

      // Angled Streamliner Front Nose (+X)
      const noseWedge = add(box(1.5, SIDE_H * 0.94, CAR_W - 0.05), bodyMat, noseBaseX + 0.65, BODY_Y + SIDE_H / 2 - 0.05, 0);
      trainMeta.bodyMeshes.push(noseWedge);

      // Cream speed cheat-line band (Running along side and wrapping front)
      [-1, 1].forEach((sd) => {
        const stripe = add(box(CAR_LEN + 1.2, 0.28, 0.03), creamStripeMat, 0.5, BODY_Y + SIDE_H * 0.45, sd * (W2 + 0.015));
        trainMeta.bandMeshes.push(stripe);
      });
      const frontBand = add(box(0.04, 0.28, CAR_W - 0.06), creamStripeMat, noseBaseX + 1.41, BODY_Y + SIDE_H * 0.45, 0);
      trainMeta.bandMeshes.push(frontBand);

      // Passenger Cabin Windows with individual silhouettes
      [-1, 1].forEach((sd) => {
        [-2.7, -1.8, -0.9, 0.0, 0.9, 1.8].forEach((wx) => {
          add(box(0.72, 0.55, 0.035), darkTrimMat, wx, BODY_Y + SIDE_H * 0.68, sd * (W2 + 0.015));
          add(box(0.66, 0.48, 0.038), windowGlowMat, wx, BODY_Y + SIDE_H * 0.68, sd * (W2 + 0.016));
        });
      });

      // Streamliner Cab Windshield
      const cabGlass = add(box(0.8, 0.52, CAR_W * 0.82), std(0x0a101d, 0.9, 0.1, { emissive: 0x38bdf8, emissiveIntensity: 0.15 }), noseBaseX + 0.42, BODY_Y + SIDE_H * 0.82, 0);
      cabGlass.rotation.z = -0.35;

      // Chrome Dual Headlights
      [-0.42, 0.42].forEach((zOff) => {
        add(xCyl(0.13, 0.12, 16), chromeMat, noseBaseX + 1.4, BODY_Y + SIDE_H * 0.35, zOff);
        const lens = add(xCyl(0.09, 0.04, 16), std(0xffffff, 0.1, 0.1, { emissive: 0xffffff, emissiveIntensity: 2.6 }), noseBaseX + 1.45, BODY_Y + SIDE_H * 0.35, zOff);
        trainMeta.lightLenses.push(lens);

        const spot = new THREE.SpotLight(0xfff5ea, 2.2, 42, Math.PI / 6, 0.35, 1.2);
        spot.position.set(noseBaseX + 1.5, BODY_Y + SIDE_H * 0.35, zOff);
        const tgt = new THREE.Object3D();
        tgt.position.set(noseBaseX + 25, BODY_Y + 0.5, zOff);
        g.add(tgt);
        spot.target = tgt;
        g.add(spot);
        trainMeta.lightSpotlights.push(spot);
      });
      break;
    }

    case 'highspeed': {
      // ==========================================
      // 3. AERO HIGH-SPEED SHINKANSEN
      // ==========================================
      const pearlWhiteMat = std(0xf1f5f9, 0.9, 0.15); // Glossy aerodynamic shell
      const cyanNeonMat = std(0x00f2fe, 0.2, 0.2, { emissive: 0x00f2fe, emissiveIntensity: 1.2 });
      const purpleAccentMat = std(0x9333ea, 0.3, 0.3, { emissive: 0xa855f7, emissiveIntensity: 0.8 });
      const darkGlassMat = std(0x07090e, 0.95, 0.05);

      trainMeta.accentColor = '#a855f7';

      // Sleek low-slung body
      const hsBody = add(box(CAR_LEN, SIDE_H * 0.88, CAR_W * 0.96), pearlWhiteMat, 0, BODY_Y + SIDE_H * 0.44, 0);
      trainMeta.bodyMeshes.push(hsBody);

      // Extended Hyper-Aerodynamic Duckbill Nose (+X)
      const duckLen = 2.4;
      const duckNose = add(box(duckLen, SIDE_H * 0.55, CAR_W * 0.92), pearlWhiteMat, noseBaseX + duckLen / 2, BODY_Y + SIDE_H * 0.28, 0);
      trainMeta.bodyMeshes.push(duckNose);
      const noseTip = add(box(0.8, 0.22, CAR_W * 0.75), pearlWhiteMat, noseBaseX + duckLen + 0.35, BODY_Y + SIDE_H * 0.12, 0);
      trainMeta.bodyMeshes.push(noseTip);

      // High-speed Neon Speedlines
      [-1, 1].forEach((sd) => {
        const neonBand = add(box(CAR_LEN + duckLen, 0.1, 0.03), cyanNeonMat, 0.8, BODY_Y + SIDE_H * 0.4, sd * (W2 * 0.96 + 0.015));
        trainMeta.bandMeshes.push(neonBand);
        const pBand = add(box(CAR_LEN, 0.04, 0.03), purpleAccentMat, 0, BODY_Y + SIDE_H * 0.72, sd * (W2 * 0.96 + 0.015));
        trainMeta.bandMeshes.push(pBand);
      });

      // Sleek continuous cockpit glass strip
      const cockpit = add(box(1.2, 0.38, CAR_W * 0.75), darkGlassMat, noseBaseX + 0.8, BODY_Y + SIDE_H * 0.65, 0);
      cockpit.rotation.z = -0.48;

      // Laser LED Projector Headlights
      [-0.45, 0.45].forEach((zOff) => {
        const lens = add(box(0.12, 0.06, 0.24), cyanNeonMat, noseBaseX + duckLen + 0.4, BODY_Y + SIDE_H * 0.15, zOff);
        trainMeta.lightLenses.push(lens);

        const spot = new THREE.SpotLight(0x00f2fe, 2.5, 48, Math.PI / 6.5, 0.3, 1.2);
        spot.position.set(noseBaseX + duckLen + 0.5, BODY_Y + SIDE_H * 0.15, zOff);
        const tgt = new THREE.Object3D();
        tgt.position.set(noseBaseX + 30, BODY_Y + 0.2, zOff);
        g.add(tgt);
        spot.target = tgt;
        g.add(spot);
        trainMeta.lightSpotlights.push(spot);
      });
      break;
    }

    case 'class395': {
      // ==========================================
      // 4. SOUTHEASTERN CLASS 395 (HITACHI JAVELIN)
      // ==========================================
      // Authentic Southeastern High Speed Livery:
      // - Midnight Blue metallic bodyshell (#0B1E3B)
      // - Full British Warning Yellow front nose & cab brow (#FFD100)
      // - Sky blue accent stripe (#00A3E0) & pure white pinstripe
      const midnightBlueMat = std(0x0b1e3b, 0.82, 0.22);
      const warningYellowMat = std(0xffd100, 0.45, 0.35, { emissive: 0xffd100, emissiveIntensity: 0.15 });
      const skyBlueMat = std(0x00a3e0, 0.5, 0.35);
      const darkCabMat = std(0x0f172a, 0.9, 0.1);
      const chromeMat = std(0xf8fafc, 0.95, 0.1);
      const pantographMat = std(0x334155, 0.8, 0.2);

      trainMeta.accentColor = '#ffd100';

      // 1. Midnight Blue Coach Body
      const javelinBody = add(box(CAR_LEN - 0.3, SIDE_H, CAR_W), midnightBlueMat, -0.15, BODY_Y + SIDE_H / 2, 0);
      trainMeta.bodyMeshes.push(javelinBody);

      // 2. Iconic British Warning Yellow Front Wedge & Cowling (+X)
      const yellowNoseLower = add(box(1.4, SIDE_H * 0.55, CAR_W - 0.02), warningYellowMat, noseBaseX + 0.6, BODY_Y + SIDE_H * 0.28, 0);
      trainMeta.bodyMeshes.push(yellowNoseLower);
      const yellowNoseBrow = add(box(1.0, SIDE_H * 0.42, CAR_W - 0.06), warningYellowMat, noseBaseX + 0.45, BODY_Y + SIDE_H * 0.75, 0);
      trainMeta.bodyMeshes.push(yellowNoseBrow);

      // Class 395 Chin Air Dam / Deflector
      add(box(1.1, 0.18, CAR_W + 0.04), warningYellowMat, noseBaseX + 0.6, BODY_Y - 0.12, 0);

      // 3. Southeastern Sky Blue & Silver Lateral Speedlines
      [-1, 1].forEach((sd) => {
        const blueLine = add(box(CAR_LEN - 0.4, 0.16, 0.035), skyBlueMat, -0.2, BODY_Y + SIDE_H * 0.35, sd * (W2 + 0.015));
        trainMeta.bandMeshes.push(blueLine);
        const silverLine = add(box(CAR_LEN - 0.4, 0.04, 0.035), chromeMat, -0.2, BODY_Y + SIDE_H * 0.48, sd * (W2 + 0.015));
        trainMeta.bandMeshes.push(silverLine);
      });

      // 4. Cockpit Wrap-Around Tinted Windscreen
      const javelinCockpit = add(box(0.75, 0.52, CAR_W * 0.85), darkCabMat, noseBaseX + 0.32, BODY_Y + SIDE_H * 0.8, 0);
      javelinCockpit.rotation.z = -0.44;

      // 5. Dual High-Speed Hitachi Pantographs (Rooftop)
      [-1.4, 1.2].forEach((px) => {
        add(box(0.7, 0.05, 0.65), pantographMat, px, ROOF_Y + 0.03, 0);
        const arm1 = add(cyl(0.02, 0.55, 6), chromeMat, px - 0.1, ROOF_Y + 0.28, 0);
        arm1.rotation.z = 0.52;
        const arm2 = add(cyl(0.018, 0.52, 6), chromeMat, px + 0.02, ROOF_Y + 0.58, 0);
        arm2.rotation.z = -0.55;
        // High-voltage collector shoe
        add(box(0.06, 0.03, 1.2), pantographMat, px, ROOF_Y + 0.8, 0);
      });

      // 6. British Twin-Lens High-Intensity LED Cluster
      [-0.48, 0.48].forEach((zOff) => {
        add(xCyl(0.12, 0.1, 16), darkCabMat, noseBaseX + 1.25, BODY_Y + SIDE_H * 0.38, zOff);
        const lens = add(xCyl(0.09, 0.04, 16), std(0xffffff, 0.1, 0.1, { emissive: 0xffffff, emissiveIntensity: 2.8 }), noseBaseX + 1.3, BODY_Y + SIDE_H * 0.38, zOff);
        trainMeta.lightLenses.push(lens);

        const spot = new THREE.SpotLight(0xfffaed, 2.5, 45, Math.PI / 6, 0.35, 1.2);
        spot.position.set(noseBaseX + 1.35, BODY_Y + SIDE_H * 0.38, zOff);
        const tgt = new THREE.Object3D();
        tgt.position.set(noseBaseX + 26, BODY_Y + 0.3, zOff);
        g.add(tgt);
        spot.target = tgt;
        g.add(spot);
        trainMeta.lightSpotlights.push(spot);
      });
      break;
    }

    default: // 'cyber' - Original Cyber Shinkansen
    {
      const cyberBodyMat = std(0xdfe6ed, 0.8, 0.2);
      const cyberBandMat = std(0x00f2fe, 0.2, 0.3, { emissive: 0x00f2fe, emissiveIntensity: 0.8 });
      const cyberDarkMat = std(0x181e26, 0.8, 0.3);

      trainMeta.accentColor = '#00f2fe';

      const mainBody = add(box(CAR_LEN, SIDE_H, CAR_W), cyberBodyMat, 0, BODY_Y + SIDE_H / 2, 0);
      trainMeta.bodyMeshes.push(mainBody);

      const noseLower = add(box(1.2, 0.78, CAR_W - 0.04), cyberBodyMat, noseBaseX + 0.52, BODY_Y + 0.4, 0);
      trainMeta.bodyMeshes.push(noseLower);
      const noseUpper = add(box(0.9, 0.5, CAR_W - 0.1), cyberBodyMat, noseBaseX + 0.38, BODY_Y + 0.92, 0);
      trainMeta.bodyMeshes.push(noseUpper);

      [-1, 1].forEach((sd) => {
        const stripe = add(box(CAR_LEN - 0.2, 0.12, 0.038), cyberBandMat, 0, BODY_Y + 0.78, sd * (W2 + 0.018));
        trainMeta.bandMeshes.push(stripe);
      });

      [-0.46, 0.46].forEach((zOff) => {
        const lens = add(xCyl(0.09, 0.03, 16), std(0xffffff, 0.1, 0.1, { emissive: 0x00f2fe, emissiveIntensity: 2.8 }), noseBaseX + 1.05, BODY_Y + 0.42, zOff);
        trainMeta.lightLenses.push(lens);

        const spot = new THREE.SpotLight(0x00f2fe, 1.8, 40, Math.PI / 6.5, 0.35, 1.2);
        spot.position.set(noseBaseX + 1.05, BODY_Y + 0.42, zOff);
        const tgt = new THREE.Object3D();
        tgt.position.set(noseBaseX + 22, BODY_Y + 0.2, zOff);
        g.add(tgt);
        spot.target = tgt;
        g.add(spot);
        trainMeta.lightSpotlights.push(spot);
      });
      break;
    }
  }

  return { group: g, meta: trainMeta, disposables };
}

/**
 * Builds an articulated intermediate passenger carriage for extended train formations
 */
export function buildCarriage(trainId, carIndex, totalCars, constants) {
  const { CAR_LEN, CAR_W, SIDE_H, BODY_Y, ROOF_Y } = constants;
  const carriageGroup = new THREE.Group();
  const W2 = CAR_W / 2;

  let matBody, matStripe, matWindow;
  if (trainId === 'class395') {
    matBody = std(0x0b1e3b, 0.82, 0.22);
    matStripe = std(0x00a3e0, 0.5, 0.35);
    matWindow = std(0x10172a, 0.9, 0.1, { emissive: 0xffd100, emissiveIntensity: 0.3 });
  } else if (trainId === 'steam') {
    // Vintage passenger carriage or coal tender
    if (carIndex === 1) {
      // Coal tender immediately behind steam engine
      matBody = std(0x1a1c20, 0.6, 0.4);
      matStripe = std(0xffd166, 0.9, 0.2);
    } else {
      matBody = std(0x4a2810, 0.2, 0.8);
      matStripe = std(0xffd166, 0.9, 0.2);
    }
    matWindow = std(0xffe8a3, 0.2, 0.2, { emissive: 0xffb703, emissiveIntensity: 0.8 });
  } else if (trainId === 'passenger') {
    matBody = std(0x163458, 0.7, 0.28);
    matStripe = std(0xf3ebdb, 0.5, 0.4);
    matWindow = std(0xffe8a3, 0.2, 0.1, { emissive: 0xffd166, emissiveIntensity: 0.85 });
  } else {
    matBody = std(0xdfe6ed, 0.8, 0.2);
    matStripe = std(0x00f2fe, 0.2, 0.3, { emissive: 0x00f2fe, emissiveIntensity: 0.8 });
    matWindow = std(0xffd166, 0.2, 0.1, { emissive: 0xffd166, emissiveIntensity: 0.4 });
  }

  // Coach Body
  const coachLen = CAR_LEN * 0.92;
  const bodyMesh = new THREE.Mesh(box(coachLen, SIDE_H, CAR_W), matBody);
  bodyMesh.position.set(0, BODY_Y + SIDE_H / 2, 0);
  carriageGroup.add(bodyMesh);

  // Speed stripes
  [-1, 1].forEach((sd) => {
    const stripe = new THREE.Mesh(box(coachLen, 0.14, 0.03), matStripe);
    stripe.position.set(0, BODY_Y + SIDE_H * 0.4, sd * (W2 + 0.015));
    carriageGroup.add(stripe);

    // 5 Illuminated Windows per side
    [-2.2, -1.1, 0, 1.1, 2.2].forEach((wx) => {
      const win = new THREE.Mesh(box(0.65, 0.45, 0.035), matWindow);
      win.position.set(wx, BODY_Y + SIDE_H * 0.65, sd * (W2 + 0.016));
      carriageGroup.add(win);
    });
  });

  // Gangway Bellows (Inter-car accordion diaphragm)
  [-coachLen / 2 - 0.15, coachLen / 2 + 0.15].forEach((gx) => {
    const bellow = new THREE.Mesh(box(0.24, SIDE_H * 0.88, CAR_W * 0.78), std(0x18181b, 0.1, 0.85));
    bellow.position.set(gx, BODY_Y + SIDE_H * 0.46, 0);
    carriageGroup.add(bellow);
  });

  return carriageGroup;
}
