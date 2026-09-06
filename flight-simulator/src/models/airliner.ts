import * as THREE from 'three';

/**
 * Construtor procedural de aviões comerciais (nariz +Z, cima +Y, envergadura em X, metros).
 * Um único conjunto de peças parametrizadas gera A350 e A320: fuselagem em lathe com
 * duas cores por vértice, asas com enflechamento/diedro, sharklets, nacelles com fan,
 * empenagem extrudada com espessura, faixa de janelas emissiva, trem de pouso com rodas
 * e luzes de navegação.
 */
export type AirlinerSpec = {
  name: string;
  length: number;
  wingspan: number;
  fuselageRadius: number;
  /** comprimento do cone do nariz e do cone de cauda, em fração do comprimento */
  noseFraction: number;
  tailFraction: number;
  wing: {
    /** meia-envergadura da asa (sem a fuselagem) */
    halfSpan: number;
    rootChord: number;
    tipChordRatio: number;
    sweepBack: number;
    dihedral: number;
    rootZ: number;
    rootY: number;
    thickness: number;
  };
  engine: {
    radius: number;
    length: number;
    x: number;
    y: number;
    z: number;
    blades: number;
  };
  tail: {
    finHeight: number;
    finRootChord: number;
    finTipChord: number;
    finSweep: number;
    finThickness: number;
    hStabHalfSpan: number;
    hStabRootChord: number;
    hStabTipChord: number;
    hStabSweep: number;
    hStabY: number;
    /** z do bordo de ataque da raiz do estabilizador horizontal */
    hStabZ: number;
    /** z do bordo de ataque da raiz da deriva */
    z: number;
  };
  gear: {
    noseZ: number;
    mainZ: number;
    mainX: number;
    strutLength: number;
    wheelRadius: number;
    /** rodas por perna principal (2 ou 4) */
    mainWheels: 2 | 4;
  };
  cabin: { startZ: number; endZ: number; windowPitch: number };
  livery: {
    upper: string;
    belly: string;
    /** faixa entre as duas cores (cheatline) */
    cheatline: string | null;
    wing: string;
    engine: string;
    fin: string;
    finTexture?: () => THREE.Texture;
    stripeTexture?: () => THREE.Texture;
    stripeLength: number;
  };
};

export type AircraftRuntime = {
  root: THREE.Group;
  fans: THREE.Object3D[];
  strobes: THREE.Mesh[];
  beacon: THREE.Mesh;
  gear: THREE.Group;
  gearExtended: number;
  wheels: THREE.Mesh[];
  length: number;
  wingspan: number;
};

export function paint(color: string, extras: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.38,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    ...extras,
  });
}

function fuselageGeometry(spec: AirlinerSpec): THREE.BufferGeometry {
  const L = spec.length;
  const R = spec.fuselageRadius;
  const half = L / 2;
  const nose = L * spec.noseFraction;
  const tail = L * spec.tailFraction;
  const points: THREE.Vector2[] = [];
  // nariz (de +Z para trás): perfil elíptico
  const noseSteps = 7;
  for (let i = 0; i <= noseSteps; i += 1) {
    const u = i / noseSteps; // 0 = ponta
    const r = R * Math.sqrt(1 - (1 - u) ** 2) * (0.985 + u * 0.015);
    points.push(new THREE.Vector2(Math.max(0.04, r), half - nose * (1 - Math.cos((u * Math.PI) / 2))));
  }
  points.push(new THREE.Vector2(R, half - nose));
  points.push(new THREE.Vector2(R, half - nose - (L - nose - tail) * 0.5));
  points.push(new THREE.Vector2(R, -half + tail));
  // cone de cauda: afina com curva suave
  const tailSteps = 6;
  for (let i = 1; i <= tailSteps; i += 1) {
    const u = i / tailSteps;
    const r = R * (1 - u) ** 1.35 + 0.06;
    points.push(new THREE.Vector2(r, -half + tail - tail * u));
  }
  points.push(new THREE.Vector2(0.05, -half));
  const geometry = new THREE.LatheGeometry(points, 56);
  // lathe gira em torno de Y; após rotateX(+90°) a altura (Vector2.y) vira +Z: nariz em +Z.
  geometry.rotateX(Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const upper = new THREE.Color(spec.livery.upper);
  const belly = new THREE.Color(spec.livery.belly);
  const cheat = spec.livery.cheatline ? new THREE.Color(spec.livery.cheatline) : null;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    let color = upper;
    if (y < -R * 0.28) color = belly;
    if (cheat && y < -R * 0.12 && y > -R * 0.28) color = cheat;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function wingGeometry(spec: AirlinerSpec, sign: 1 | -1): THREE.BufferGeometry {
  const w = spec.wing;
  const geometry = new THREE.BoxGeometry(w.halfSpan, w.thickness, w.rootChord, 12, 1, 4);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (x + w.halfSpan / 2) / w.halfSpan; // 0 raiz, 1 ponta
    const taper = 1 - t * (1 - w.tipChordRatio);
    position.setX(i, (x + w.halfSpan / 2) * sign);
    position.setY(i, y * taper + t * w.dihedral);
    position.setZ(i, z * taper - t * w.sweepBack);
  }
  geometry.translate(sign * (spec.fuselageRadius - 0.4), w.rootY, w.rootZ);
  geometry.computeVertexNormals();
  return geometry;
}

function sharklet(spec: AirlinerSpec, sign: 1 | -1): THREE.Mesh {
  const w = spec.wing;
  const height = spec.fuselageRadius * 1.1;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.9, 0);
  shape.lineTo(0.5, height * 0.85);
  shape.lineTo(0.2, height);
  shape.lineTo(-0.15, height * 0.8);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
  geometry.translate(0, 0, -0.07);
  geometry.rotateY(Math.PI / 2); // corda (x) → -Z (para trás), espessura → X
  const mesh = new THREE.Mesh(geometry, paint(spec.livery.wing, { roughness: 0.32 }));
  const tipX = spec.fuselageRadius - 0.4 + w.halfSpan;
  mesh.position.set(sign * (tipX - 0.1), w.rootY + w.dihedral + 0.1, w.rootZ - w.sweepBack - w.rootChord * w.tipChordRatio * 0.15);
  mesh.rotation.z = sign * -0.28;
  mesh.castShadow = true;
  return mesh;
}

function engine(spec: AirlinerSpec, sign: 1 | -1, fan: THREE.Group): THREE.Group {
  const e = spec.engine;
  const group = new THREE.Group();
  group.name = sign > 0 ? 'engineRight' : 'engineLeft';
  const nacelle = new THREE.Mesh(
    new THREE.CylinderGeometry(e.radius, e.radius * 0.9, e.length, 32, 1, true),
    paint(spec.livery.engine, { metalness: 0.62, roughness: 0.3, clearcoat: 0.25, side: THREE.DoubleSide }),
  );
  nacelle.rotation.x = Math.PI / 2;
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(e.radius, e.radius * 0.11, 12, 32),
    paint('#d8d5cf', { metalness: 0.35, roughness: 0.22 }),
  );
  lip.position.z = e.length / 2;
  const intake = new THREE.Mesh(
    new THREE.CircleGeometry(e.radius * 0.9, 32),
    new THREE.MeshPhysicalMaterial({ color: '#0e0f13', roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide }),
  );
  intake.position.z = e.length / 2 - 0.3;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(e.radius * 0.26, 16, 12), paint('#cfd3d8', { metalness: 0.8, roughness: 0.18 }));
  const bladeGeo = new THREE.BoxGeometry(0.06, e.radius * 0.8, 0.2);
  const bladeMat = paint('#b8bec6', { metalness: 0.85, roughness: 0.16 });
  for (let i = 0; i < e.blades; i += 1) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = e.radius * 0.36;
    blade.rotation.y = 0.5;
    const holder = new THREE.Group();
    holder.add(blade);
    holder.rotation.z = (i / e.blades) * Math.PI * 2;
    fan.add(holder);
  }
  fan.add(hub);
  fan.position.z = e.length / 2 - 0.55;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(e.radius * 0.64, e.radius * 0.48, e.length * 0.4, 20),
    paint('#1c1f24', { metalness: 0.6, roughness: 0.4 }),
  );
  core.rotation.x = Math.PI / 2;
  core.position.z = -e.length * 0.55;
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(e.radius * 0.47, e.radius * 0.42, e.length * 0.15, 20, 1, true),
    paint('#4a4e55', { metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide }),
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.z = -e.length * 0.8;
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, e.radius * 1.15, e.length * 0.45), paint(spec.livery.wing, { roughness: 0.4 }));
  pylon.position.set(0, e.radius * 1.05, 0.1);
  pylon.rotation.z = sign * 0.08;
  for (const mesh of [nacelle, lip, intake, core, exhaust, pylon]) {
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.add(fan);
  group.position.set(sign * e.x, e.y, e.z);
  return group;
}

function taperedPlanform(rootChord: number, tipChord: number, span: number, sweep: number, thickness: number): THREE.BufferGeometry {
  // planform no plano XY (X = envergadura, Y = corda, apontando para -Z depois de rotacionar)
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(span, -sweep);
  shape.lineTo(span, -sweep - tipChord);
  shape.lineTo(0, -rootChord);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: thickness * 0.35,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -thickness / 2);
  // corda (−Y) → −Z (para trás); espessura Z → Y
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function empennage(spec: AirlinerSpec): THREE.Group {
  const t = spec.tail;
  const group = new THREE.Group();
  group.name = 'empennage';
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(t.finRootChord, 0);
  finShape.lineTo(t.finRootChord - t.finSweep + t.finTipChord, t.finHeight);
  finShape.lineTo(t.finRootChord - t.finSweep, t.finHeight);
  finShape.lineTo(0.3, t.finHeight * 0.18);
  finShape.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(finShape, {
    depth: t.finThickness,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  finGeometry.translate(0, 0, -t.finThickness / 2);
  finGeometry.rotateY(Math.PI / 2); // corda (x) → −Z, ponta enflechada para trás
  const finMaterial = spec.livery.finTexture
    ? new THREE.MeshPhysicalMaterial({ map: spec.livery.finTexture(), roughness: 0.42, metalness: 0.05, clearcoat: 0.4 })
    : paint(spec.livery.fin);
  const fin = new THREE.Mesh(finGeometry, finMaterial);
  fin.position.set(0, spec.fuselageRadius * 0.55, t.z);
  fin.castShadow = true;
  group.add(fin);

  const hStabMaterial = paint(spec.livery.wing, { roughness: 0.4 });
  for (const sign of [1, -1] as const) {
    const geometry = taperedPlanform(t.hStabRootChord, t.hStabTipChord, t.hStabHalfSpan, t.hStabSweep, 0.3);
    if (sign < 0) geometry.scale(-1, 1, 1);
    const hStab = new THREE.Mesh(geometry, hStabMaterial);
    hStab.position.set(0, t.hStabY, t.hStabZ);
    hStab.rotation.z = sign * 0.06;
    hStab.castShadow = true;
    group.add(hStab);
  }
  return group;
}

function cockpitWindows(spec: AirlinerSpec): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: '#15181f', roughness: 0.08, metalness: 0.4, clearcoat: 0.6 });
  const R = spec.fuselageRadius;
  const z0 = spec.length / 2 - spec.length * spec.noseFraction * 0.42;
  const pane = new THREE.BoxGeometry(R * 0.25, R * 0.15, 0.06);
  const offsets = [
    [-0.42, 0.26, -0.18, -0.36],
    [-0.15, 0.3, 0, -0.13],
    [0.15, 0.3, 0, 0.13],
    [0.42, 0.26, -0.18, 0.36],
  ] as const;
  for (const [x, y, dz, yaw] of offsets) {
    const mesh = new THREE.Mesh(pane, mat);
    mesh.position.set(x * R, y * R, z0 + dz * R);
    mesh.rotation.y = yaw;
    mesh.rotation.x = -0.32;
    group.add(mesh);
  }
  return group;
}

function windowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Window canvas failed');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = 'rgba(255, 224, 170, 1)';
  const w = 34; // ao longo de u = altura da janela na faixa
  const h = 18; // ao longo de v = largura da janela na fuselagem
  ctx.beginPath();
  ctx.roundRect((64 - w) / 2, (64 - h) / 2, w, h, 5);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Faixa de janelas da cabine: segmento de cilindro com textura emissiva repetida. */
function windowBands(spec: AirlinerSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = 'windows';
  const R = spec.fuselageRadius + 0.03;
  const length = spec.cabin.endZ - spec.cabin.startZ;
  const texture = windowTexture();
  texture.repeat.set(1, length / spec.cabin.windowPitch);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    toneMapped: false,
    color: '#ffe2b0',
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const arc = 0.24;
  for (const theta of [Math.PI / 2, (3 * Math.PI) / 2]) {
    const geometry = new THREE.CylinderGeometry(R, R, length, 6, 1, true, theta - arc / 2, arc);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = spec.cabin.startZ + length / 2;
    mesh.position.y = R * 0.05;
    group.add(mesh);
  }
  return group;
}

function landingGear(spec: AirlinerSpec, wheels: THREE.Mesh[]): THREE.Group {
  const g = spec.gear;
  const gear = new THREE.Group();
  gear.name = 'gear';
  const strutMat = paint('#c9ccd2', { metalness: 0.75, roughness: 0.3 });
  const tyreMat = paint('#15161a', { roughness: 0.92, metalness: 0 });
  const rimMat = paint('#a9adb5', { metalness: 0.7, roughness: 0.3 });
  const tyreGeo = new THREE.CylinderGeometry(g.wheelRadius, g.wheelRadius, g.wheelRadius * 0.62, 18);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(g.wheelRadius * 0.55, g.wheelRadius * 0.55, g.wheelRadius * 0.66, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const makeLeg = (x: number, z: number, count: 2 | 4, bay: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(x, -spec.fuselageRadius * 0.7, z);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, g.strutLength, 10), strutMat);
    strut.position.y = -g.strutLength / 2;
    leg.add(strut);
    const rows = count === 4 ? 2 : 1;
    for (let r = 0; r < rows; r += 1) {
      const zOff = rows === 2 ? (r === 0 ? -g.wheelRadius * 1.3 : g.wheelRadius * 1.3) : 0;
      if (rows === 2) {
        const bogie = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, g.wheelRadius * 3.2), strutMat);
        bogie.position.y = -g.strutLength;
        leg.add(bogie);
      }
      for (const side of [-1, 1]) {
        const tyre = new THREE.Mesh(tyreGeo, tyreMat);
        tyre.position.set(side * g.wheelRadius * 0.55, -g.strutLength, zOff);
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.copy(tyre.position);
        leg.add(tyre, rim);
        wheels.push(tyre);
      }
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, bay), paint(spec.livery.belly));
    door.position.set(-0.45, 0.02, 0);
    door.rotation.z = -1.2;
    leg.add(door);
    return leg;
  };

  gear.add(makeLeg(0, g.noseZ, 2, 2.2));
  gear.add(makeLeg(-g.mainX, g.mainZ, g.mainWheels, 3.4));
  gear.add(makeLeg(g.mainX, g.mainZ, g.mainWheels, 3.4));
  return gear;
}

function navLight(color: string, position: THREE.Vector3, size = 0.12): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, toneMapped: false }),
  );
  mesh.position.copy(position);
  return mesh;
}

export function createAirliner(spec: AirlinerSpec): AircraftRuntime {
  const root = new THREE.Group();
  root.name = spec.name;
  const R = spec.fuselageRadius;
  const w = spec.wing;

  const fuselage = new THREE.Mesh(
    fuselageGeometry(spec),
    new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.08, clearcoat: 0.75, clearcoatRoughness: 0.14 }),
  );
  fuselage.name = 'fuselage';
  fuselage.castShadow = true;

  const wingMat = paint(spec.livery.wing, { roughness: 0.4 });
  const leftWing = new THREE.Mesh(wingGeometry(spec, -1), wingMat);
  const rightWing = new THREE.Mesh(wingGeometry(spec, 1), wingMat);
  leftWing.name = 'wingLeft';
  rightWing.name = 'wingRight';
  // carenagem asa-fuselagem
  const fairing = new THREE.Mesh(
    new THREE.BoxGeometry(R * 2.3, R * 0.9, w.rootChord * 1.25, 1, 1, 1),
    paint(spec.livery.belly, { roughness: 0.5 }),
  );
  fairing.position.set(0, -R * 0.62, w.rootZ - 0.6);
  fairing.scale.set(1, 0.7, 1);

  const fanL = new THREE.Group();
  const fanR = new THREE.Group();
  fanL.name = 'fanLeft';
  fanR.name = 'fanRight';

  const wheels: THREE.Mesh[] = [];
  const gear = landingGear(spec, wheels);
  gear.visible = false;

  const tipX = R - 0.4 + w.halfSpan;
  const tipY = w.rootY + w.dihedral;
  const tipZ = w.rootZ - w.sweepBack;
  const beacon = navLight('#ff2a2a', new THREE.Vector3(0, R + 0.1, spec.length * 0.08));
  const bellyBeacon = navLight('#ff2a2a', new THREE.Vector3(0, -R * 1.02, spec.length * 0.02));
  const strobeL = navLight('#ffffff', new THREE.Vector3(-tipX, tipY + 0.2, tipZ - 0.2));
  const strobeR = navLight('#ffffff', new THREE.Vector3(tipX, tipY + 0.2, tipZ - 0.2));
  const navL = navLight('#ff1a1a', new THREE.Vector3(-tipX - 0.15, tipY, tipZ + 0.3), 0.14);
  const navR = navLight('#12e36a', new THREE.Vector3(tipX + 0.15, tipY, tipZ + 0.3), 0.14);
  const tailLight = navLight('#f4f7ff', new THREE.Vector3(0, R * 0.55 + spec.tail.finHeight, spec.tail.z - spec.tail.finSweep));

  root.add(
    fuselage,
    fairing,
    leftWing,
    rightWing,
    sharklet(spec, -1),
    sharklet(spec, 1),
    engine(spec, -1, fanL),
    engine(spec, 1, fanR),
    empennage(spec),
    cockpitWindows(spec),
    windowBands(spec),
    gear,
    beacon,
    bellyBeacon,
    strobeL,
    strobeR,
    navL,
    navR,
    tailLight,
  );

  if (spec.livery.stripeTexture) {
    const texture = spec.livery.stripeTexture();
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(spec.livery.stripeLength, R * 0.35);
    for (const sign of [-1, 1] as const) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(sign * (R + 0.02), -R * 0.02, spec.length * 0.05);
      mesh.rotation.y = sign * (Math.PI / 2);
      root.add(mesh);
    }
  }

  // antenas e detalhes pequenos
  const antennaMat = paint('#e8e4d8');
  const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), antennaMat);
  antenna.position.set(0, R + 0.3, spec.length * 0.2);
  const antenna2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.8), antennaMat);
  antenna2.position.set(0, R + 0.15, -spec.length * 0.12);
  root.add(antenna, antenna2);

  root.userData.sculptRuntime = {
    pivots: { fanLeft: fanL, fanRight: fanR, beacon },
    sockets: { nose: [0, 0.4, spec.length / 2], tail: [0, 1, -spec.length / 2] },
  };

  return {
    root,
    fans: [fanL, fanR],
    strobes: [strobeL, strobeR],
    beacon,
    gear,
    gearExtended: 0,
    wheels,
    length: spec.length,
    wingspan: spec.wingspan,
  };
}

export function updateAircraftEffects(runtime: AircraftRuntime, elapsed: number, speedMps: number): void {
  const rpm = THREE.MathUtils.clamp(speedMps / 40, 0.4, 8);
  for (const fan of runtime.fans) {
    fan.rotation.z = -elapsed * rpm * 22;
  }
  const strobeOn = elapsed % 1.2 < 0.08 || (elapsed % 1.2 > 0.16 && elapsed % 1.2 < 0.22);
  const beaconOn = elapsed % 0.9 < 0.18;
  for (const strobe of runtime.strobes) {
    const material = strobe.material as THREE.MeshBasicMaterial;
    material.opacity = strobeOn ? 1 : 0.08;
    strobe.scale.setScalar(strobeOn ? 1.8 : 0.7);
  }
  const beaconMat = runtime.beacon.material as THREE.MeshBasicMaterial;
  beaconMat.opacity = beaconOn ? 1 : 0.12;
  runtime.beacon.scale.setScalar(beaconOn ? 1.5 : 0.8);
  if (runtime.gear.visible) {
    for (const wheel of runtime.wheels) wheel.rotation.x = elapsed * 2;
  }
}

/** Anima o trem de pouso: 0 = recolhido (invisível), 1 = baixado. */
export function setGear(runtime: AircraftRuntime, extended01: number, dt: number): void {
  const target = THREE.MathUtils.clamp(extended01, 0, 1);
  runtime.gearExtended += (target - runtime.gearExtended) * Math.min(1, dt * 1.8);
  const e = runtime.gearExtended;
  runtime.gear.visible = e > 0.02;
  for (const leg of runtime.gear.children) {
    leg.rotation.x = (1 - e) * 1.45;
    leg.scale.setScalar(0.4 + e * 0.6);
  }
}
