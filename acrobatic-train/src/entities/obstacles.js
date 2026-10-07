import { disposeObject } from '../scene/resources.js';
import { GATE, GANTRY, WAGON, gateCycle, gantryBoxes, wagonLat, wagonPhase } from '../physics/hazards.js';
export function createWorkBarrier(Three, { length = 1.6, width = 2.2, height = 3.2 } = {}) {
  const group = new Three.Group();
  const yellow = new Three.MeshStandardMaterial({ color: 0xffc857, roughness: 0.65 });
  const black = new Three.MeshStandardMaterial({ color: 0x121820, roughness: 0.8 });
  const body = new Three.Mesh(new Three.BoxGeometry(length, height, width), yellow);
  body.position.y = height / 2; group.add(body);
  for (const z of [-0.7, 0, 0.7]) {
    const stripe = new Three.Mesh(new Three.BoxGeometry(0.02, height, 0.23), black);
    stripe.position.set(length / 2 + 0.01, height / 2, z); group.add(stripe);
    const back = stripe.clone(); back.position.x = -length / 2 - 0.01; group.add(back);
  }
  group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return { group, dispose: () => disposeObject(group) };
}

const shade = o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; };
/** Railway gate: post, striped boom and warning lights driven by the simulation cycle. */
export function createRailGate(Three, gate) {
  const group = new Three.Group(), red = new Three.MeshStandardMaterial({ color: 0xd62839, roughness: 0.5 });
  const white = new Three.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 });
  const lamp = new Three.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0 });
  const post = new Three.Mesh(new Three.CylinderGeometry(GATE.postRadius, GATE.postRadius, GATE.postHeight, 12).translate(0, GATE.postHeight / 2, 0), white);
  post.position.z = gate.pivotLat; group.add(post);
  for (const dz of [-0.22, 0.22]) {
    const light = new Three.Mesh(new Three.SphereGeometry(0.13, 12, 8), lamp);
    light.position.set(0.12, GATE.postHeight - 0.18, gate.pivotLat + dz); group.add(light);
  }
  const pivot = new Three.Group(), arm = new Three.Group(), pieces = 6, piece = GATE.boomLength / pieces;
  pivot.position.set(0, GATE.pivotY, gate.pivotLat); pivot.rotation.y = gate.dir < 0 ? Math.PI : 0;
  for (let i = 0; i < pieces; i++) {
    const bar = new Three.Mesh(new Three.BoxGeometry(GATE.boomRadius * 2, GATE.boomRadius * 2, piece), i % 2 ? white : red);
    bar.position.z = piece * (i + 0.5); arm.add(bar);
  }
  pivot.add(arm); group.add(pivot); group.traverse(shade);
  const update = timeS => {
    const cycle = gateCycle(gate, timeS);
    arm.rotation.x = -cycle.angle;
    lamp.emissiveIntensity = cycle.phase !== 'open' && Math.floor(timeS * 4) % 2 === 0 ? 2.2 : 0;
    return cycle.phase;
  };
  update(0);
  return { group, movers: [arm], update, dispose: () => disposeObject(group) };
}
/** Gantry: side panels and lintel from the same boxes used by the collider, plus a downward arrow over the opening. */
export function createGantry(Three, gantry) {
  const group = new Three.Group(), steel = new Three.MeshStandardMaterial({ color: 0x9aa5b4, metalness: 0.35, roughness: 0.5, emissive: 0x1c2733, emissiveIntensity: 0.6 });
  const sign = new Three.MeshStandardMaterial({ color: 0x0b3d1f, emissive: 0x2bd96b, emissiveIntensity: 0.9, side: Three.DoubleSide });
  for (const box of gantryBoxes(gantry)) {
    const mesh = new Three.Mesh(new Three.BoxGeometry(box.length, box.yMax - box.yMin, box.width), steel);
    mesh.position.set(0, (box.yMin + box.yMax) / 2, box.lat); group.add(mesh);
  }
  const arrow = new Three.Shape(); arrow.moveTo(-0.45, 0.5); arrow.lineTo(0.45, 0.5); arrow.lineTo(0, -0.35); arrow.closePath();
  const marker = new Three.Mesh(new Three.ShapeGeometry(arrow), sign);
  marker.position.set(-GANTRY.depth / 2 - 0.02, GANTRY.clearance + 0.4, gantry.openLat); marker.rotation.y = -Math.PI / 2; group.add(marker);
  group.traverse(shade);
  return { group, movers: [], update: () => '', dispose: () => disposeObject(group) };
}
/** Maintenance wagon on a perpendicular spur; the ground arrow shows its travel direction. */
export function createMaintenanceWagon(Three, wagon) {
  const group = new Three.Group(), body = new Three.Group();
  const paint = new Three.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.55 });
  const dark = new Three.MeshStandardMaterial({ color: 0x1c2229, roughness: 0.8 });
  const beaconMat = new Three.MeshStandardMaterial({ color: 0x402a00, emissive: 0xffb000, emissiveIntensity: 0 });
  const arrowMat = new Three.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 0.35 });
  const wheelH = 0.55, deck = new Three.Mesh(new Three.BoxGeometry(WAGON.depth, WAGON.height - wheelH, WAGON.length), paint);
  deck.position.y = wheelH + (WAGON.height - wheelH) / 2; body.add(deck);
  for (const x of [-0.85, 0.85]) for (const z of [-1.4, 1.4]) {
    const wheel = new Three.Mesh(new Three.CylinderGeometry(wheelH / 2, wheelH / 2, 0.2, 12), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, wheelH / 2, z); body.add(wheel);
  }
  const beacon = new Three.Mesh(new Three.CylinderGeometry(0.18, 0.18, 0.25, 12), beaconMat);
  beacon.position.y = WAGON.height + 0.125; body.add(beacon);
  for (const x of [-0.75, 0.75]) {
    const near = wagon.side * 5.2, far = wagon.side * (WAGON.restEdge + WAGON.length + 0.8);
    const rail = new Three.Mesh(new Three.BoxGeometry(0.08, 0.14, Math.abs(far - near)), dark);
    rail.position.set(x, 0.07, (near + far) / 2); group.add(rail);
  }
  const head = new Three.Shape(), toward = -wagon.side, tip = wagon.side * 5.3;
  head.moveTo(-0.7, 0); head.lineTo(0.7, 0); head.lineTo(0, 1.1); head.closePath();
  const arrow = new Three.Mesh(new Three.ShapeGeometry(head), arrowMat);
  arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = toward > 0 ? Math.PI : 0; arrow.position.set(0, 0.03, tip - toward * 1.6); group.add(arrow);
  group.add(body); group.traverse(shade);
  const update = timeS => {
    const phase = wagonPhase(wagon, timeS);
    body.position.z = wagonLat(wagon, timeS);
    beaconMat.emissiveIntensity = phase !== 'waiting' && phase !== 'parked' && Math.floor(timeS * 5) % 2 === 0 ? 2.5 : 0.2;
    return phase;
  };
  update(0);
  return { group, movers: [body], update, dispose: () => disposeObject(group) };
}
export const OBSTACLE_MESHES = Object.freeze({ gate: createRailGate, gantry: createGantry, wagon: createMaintenanceWagon });
