import * as THREE from 'three';

export type AircraftRuntime = {
  root: THREE.Group;
  fans: THREE.Object3D[];
  strobes: THREE.Mesh[];
  beacon: THREE.Mesh;
  length: number;
  wingspan: number;
};

function paint(color: string, extras: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.38,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    ...extras,
  });
}

function unionJackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Union Jack canvas failed');
  ctx.fillStyle = '#012169';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 90;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(512, 512);
  ctx.moveTo(512, 0);
  ctx.lineTo(0, 512);
  ctx.stroke();
  ctx.strokeStyle = '#c8102e';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(512, 512);
  ctx.moveTo(512, 0);
  ctx.lineTo(0, 512);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(216, 0, 80, 512);
  ctx.fillRect(0, 216, 512, 80);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(236, 0, 40, 512);
  ctx.fillRect(0, 236, 512, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function speedmarqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Speedmarque canvas failed');
  const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, 'rgba(12, 35, 90, 0)');
  gradient.addColorStop(0.08, '#0b2a66');
  gradient.addColorStop(0.42, '#0b2a66');
  gradient.addColorStop(0.43, '#c8102e');
  gradient.addColorStop(0.78, '#c8102e');
  gradient.addColorStop(1, 'rgba(200, 16, 46, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.lineTo(980, 8);
  ctx.lineTo(1024, 64);
  ctx.lineTo(940, 120);
  ctx.lineTo(0, 100);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function fuselageGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.04, 36.9),
    new THREE.Vector2(0.55, 36.35),
    new THREE.Vector2(1.35, 35.4),
    new THREE.Vector2(2.15, 33.8),
    new THREE.Vector2(2.72, 31.6),
    new THREE.Vector2(2.96, 28.4),
    new THREE.Vector2(2.99, 22),
    new THREE.Vector2(2.99, 8),
    new THREE.Vector2(2.99, -6),
    new THREE.Vector2(2.96, -18),
    new THREE.Vector2(2.7, -26.5),
    new THREE.Vector2(2.1, -31.8),
    new THREE.Vector2(1.25, -35.1),
    new THREE.Vector2(0.45, -36.5),
    new THREE.Vector2(0.08, -36.9),
  ];
  const geometry = new THREE.LatheGeometry(points, 64);
  geometry.rotateX(Math.PI / 2);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const white = new THREE.Color('#f3eee4');
  const grey = new THREE.Color('#6e747c');
  const windowBand = new THREE.Color('#1a1d22');
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const x = position.getX(i);
    const z = position.getZ(i);
    let color = white;
    if (y < -0.55) color = grey;
    const along = z;
    const side = Math.abs(x);
    if (y > -0.35 && y < 0.55 && side > 2.2 && along < 28 && along > -24) {
      color = windowBand;
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function wingGeometry(sign: 1 | -1): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(31.2, 0.32, 9.4, 12, 1, 4);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (x + 15.6) / 31.2;
    const taper = 1 - t * 0.72;
    position.setX(i, x * sign);
    position.setY(i, y * taper + t * 1.1);
    position.setZ(i, z * taper - t * 11.5);
  }
  geometry.translate(sign * 18.2, -0.15, -1.4);
  geometry.computeVertexNormals();
  return geometry;
}

function sharklet(sign: 1 | -1): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.18, 0);
  shape.lineTo(0.12, 2.8);
  shape.lineTo(-0.05, 3.4);
  shape.lineTo(-0.22, 2.6);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
  geometry.center();
  const mesh = new THREE.Mesh(geometry, paint('#d9d4c8', { roughness: 0.32 }));
  mesh.position.set(sign * 33.5, 1.35, -12.4);
  mesh.rotation.set(-0.12, sign * 0.15, sign * 0.55);
  mesh.castShadow = true;
  return mesh;
}

function engine(sign: 1 | -1, fan: THREE.Group): THREE.Group {
  const group = new THREE.Group();
  group.name = sign > 0 ? 'engineRight' : 'engineLeft';
  const nacelle = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.32, 5.6, 32, 1, true),
    paint('#2c3036', { metalness: 0.72, roughness: 0.28, clearcoat: 0.2 }),
  );
  nacelle.rotation.x = Math.PI / 2;
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(1.48, 0.16, 12, 32),
    paint('#d8d5cf', { metalness: 0.35, roughness: 0.22 }),
  );
  lip.position.z = 2.85;
  const intake = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 32),
    new THREE.MeshPhysicalMaterial({ color: '#111216', roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide }),
  );
  intake.position.z = 2.72;
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 12),
    paint('#cfd3d8', { metalness: 0.8, roughness: 0.18 }),
  );
  hub.position.z = 2.35;
  const bladeGeo = new THREE.BoxGeometry(0.08, 1.18, 0.22);
  const bladeMat = paint('#b8bec6', { metalness: 0.85, roughness: 0.16 });
  for (let i = 0; i < 18; i += 1) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.52;
    const holder = new THREE.Group();
    holder.add(blade);
    holder.rotation.z = (i / 18) * Math.PI * 2;
    fan.add(holder);
  }
  fan.add(hub);
  fan.position.z = 2.15;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.72, 2.2, 20),
    paint('#1c1f24', { metalness: 0.6, roughness: 0.4 }),
  );
  core.rotation.x = Math.PI / 2;
  core.position.z = -1.1;
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.62, 0.8, 20, 1, true),
    paint('#4a4e55', { metalness: 0.7, roughness: 0.25 }),
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.z = -2.55;
  const pylon = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.7, 2.4),
    paint('#ece7dc', { roughness: 0.4 }),
  );
  pylon.position.set(0, 1.55, 0.2);
  pylon.rotation.z = sign * 0.08;
  for (const mesh of [nacelle, lip, intake, core, exhaust, pylon]) {
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.add(fan);
  group.position.set(sign * 10.4, -2.05, 2.35);
  group.rotation.y = 0;
  return group;
}

function stabilizer(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'empennage';
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(4.8, 0.2);
  finShape.lineTo(7.4, 8.4);
  finShape.lineTo(5.1, 8.7);
  finShape.lineTo(0.2, 1.6);
  finShape.closePath();
  const fin = new THREE.Mesh(
    new THREE.ExtrudeGeometry(finShape, { depth: 0.28, bevelEnabled: false }),
    new THREE.MeshPhysicalMaterial({
      map: unionJackTexture(),
      roughness: 0.42,
      metalness: 0.05,
      clearcoat: 0.4,
    }),
  );
  fin.rotation.y = -Math.PI / 2;
  fin.position.set(0.14, 0.4, -32.4);
  fin.castShadow = true;
  const hStabGeo = new THREE.BoxGeometry(18.4, 0.22, 3.6);
  hStabGeo.translate(0, 0, -1.1);
  const hStab = new THREE.Mesh(hStabGeo, paint('#efeae0'));
  hStab.position.set(0, 1.15, -33.2);
  hStab.rotation.x = 0.04;
  hStab.castShadow = true;
  group.add(fin, hStab);
  return group;
}

function cockpitWindows(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#15181f',
    roughness: 0.08,
    metalness: 0.4,
    transmission: 0.15,
    thickness: 0.04,
    opacity: 0.96,
    transparent: true,
  });
  const pane = new THREE.BoxGeometry(0.72, 0.42, 0.06);
  const offsets = [
    [-1.15, 0.72, 33.6, -0.28],
    [-0.42, 0.86, 34.05, -0.12],
    [0.42, 0.86, 34.05, 0.12],
    [1.15, 0.72, 33.6, 0.28],
  ] as const;
  for (const [x, y, z, yaw] of offsets) {
    const mesh = new THREE.Mesh(pane, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.rotation.x = -0.32;
    group.add(mesh);
  }
  return group;
}

function navLight(color: string, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );
  mesh.position.copy(position);
  return mesh;
}

/**
 * Procedural Airbus A350-1000 in British Airways Chatham Dockyard livery.
 * Rebuilt in code from `assets/references/a350-ba-reference.png` (owned generated still).
 * Nose +Z, up +Y, span along X. Units are metres.
 */
export function createA350Model(): AircraftRuntime {
  const root = new THREE.Group();
  root.name = 'A350-1000-BA';

  const fuselage = new THREE.Mesh(
    fuselageGeometry(),
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    }),
  );
  fuselage.castShadow = true;
  fuselage.name = 'fuselage';

  const wingMat = paint('#e7e2d6', { roughness: 0.4 });
  const leftWing = new THREE.Mesh(wingGeometry(-1), wingMat);
  const rightWing = new THREE.Mesh(wingGeometry(1), wingMat);
  leftWing.name = 'wingLeft';
  rightWing.name = 'wingRight';
  leftWing.castShadow = true;
  rightWing.castShadow = true;

  const marque = speedmarqueTexture();
  const marqueMat = new THREE.MeshBasicMaterial({
    map: marque,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const marqueGeo = new THREE.PlaneGeometry(28, 1.05);
  const marqueL = new THREE.Mesh(marqueGeo, marqueMat);
  const marqueR = new THREE.Mesh(marqueGeo, marqueMat);
  marqueL.position.set(-3.02, 0.12, 4);
  marqueR.position.set(3.02, 0.12, 4);
  marqueL.rotation.y = -Math.PI / 2;
  marqueR.rotation.y = Math.PI / 2;

  const fanL = new THREE.Group();
  const fanR = new THREE.Group();
  fanL.name = 'fanLeft';
  fanR.name = 'fanRight';

  const beacon = navLight('#ff2a2a', new THREE.Vector3(0, 3.15, 6.5));
  const strobeL = navLight('#ffffff', new THREE.Vector3(-33.6, 1.2, -12.3));
  const strobeR = navLight('#ffffff', new THREE.Vector3(33.6, 1.2, -12.3));
  const navL = navLight('#ff1a1a', new THREE.Vector3(-33.7, 0.95, -11.9));
  const navR = navLight('#12e36a', new THREE.Vector3(33.7, 0.95, -11.9));
  const tailLight = navLight('#f4f7ff', new THREE.Vector3(0, 8.6, -33.6));

  root.add(
    fuselage,
    leftWing,
    rightWing,
    sharklet(-1),
    sharklet(1),
    engine(-1, fanL),
    engine(1, fanR),
    stabilizer(),
    cockpitWindows(),
    marqueL,
    marqueR,
    beacon,
    strobeL,
    strobeR,
    navL,
    navR,
    tailLight,
  );

  root.userData.sculptRuntime = {
    pivots: { fanLeft: fanL, fanRight: fanR, beacon },
    sockets: { nose: [0, 0.4, 36.9], tail: [0, 1, -36.9] },
  };

  return {
    root,
    fans: [fanL, fanR],
    strobes: [strobeL, strobeR],
    beacon,
    length: 73.79,
    wingspan: 64.75,
  };
}

export function updateAircraftEffects(runtime: AircraftRuntime, elapsed: number, speedMps: number): void {
  const rpm = THREE.MathUtils.clamp(speedMps / 40, 0.4, 8);
  for (const fan of runtime.fans) {
    fan.rotation.z -= elapsed * rpm * 22;
  }
  const strobeOn = elapsed % 1.2 < 0.08;
  const beaconOn = elapsed % 0.9 < 0.18;
  for (const strobe of runtime.strobes) {
    const material = strobe.material as THREE.MeshBasicMaterial;
    material.opacity = strobeOn ? 1 : 0.08;
    strobe.scale.setScalar(strobeOn ? 1.6 : 0.7);
  }
  const beaconMat = runtime.beacon.material as THREE.MeshBasicMaterial;
  beaconMat.opacity = beaconOn ? 1 : 0.12;
}
