import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("c");
const $ = (id) => document.getElementById(id);

function mulberry32(a) {
return function () {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}
const rnd = mulberry32(0x57a65);
const r = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[ri(0, a.length - 1)];

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b4d4);
scene.fog = new THREE.FogExp2(0xa8c0c8, 0.0065);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.4, 420);
camera.position.set(58, 54, 72);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 1.2, 4);
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 10;
controls.maxDistance = 170;
controls.maxPolarAngle = Math.PI / 2.12;

const hemi = new THREE.HemisphereLight(0xb8d4e8, 0x3d2a18, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 220;
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0007;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);
const moon = new THREE.DirectionalLight(0x9bb4e0, 0.0);
scene.add(moon);
const fill = new THREE.AmbientLight(0x2a2438, 0.15);
scene.add(fill);

function texNoise(w, h, c1, c2, grain = 28) {
const cnv = document.createElement("canvas");
cnv.width = w; cnv.height = h;
const g = cnv.getContext("2d");
g.fillStyle = c1; g.fillRect(0, 0, w, h);
for (let i = 0; i < w * h * 0.45; i++) {
  g.fillStyle = c2;
  g.globalAlpha = Math.random() * 0.35;
  g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
}
g.globalAlpha = 0.15;
for (let i = 0; i < grain; i++) {
  g.fillStyle = i % 2 ? "#000" : "#fff";
  g.fillRect(0, (i / grain) * h, w, 1);
}
const t = new THREE.CanvasTexture(cnv);
t.wrapS = t.wrapT = THREE.RepeatWrapping;
t.colorSpace = THREE.SRGBColorSpace;
return t;
}

const T = {
plaster: texNoise(64, 64, "#e6d7bc", "#c4b08a"),
thatch: texNoise(64, 64, "#8a6b34", "#5c4420", 40),
tile: texNoise(64, 64, "#7a3228", "#4a1814", 20),
slate: texNoise(64, 64, "#5a5e66", "#2e3238", 16),
stone: texNoise(96, 96, "#8a8478", "#4e4a42", 22),
wood: texNoise(64, 64, "#5a3a22", "#2a160c", 18),
grass: texNoise(128, 128, "#4d6a38", "#2d4420", 10),
dirt: texNoise(64, 64, "#6a5340", "#3a2c22", 14),
cobble: texNoise(96, 96, "#7a7468", "#3e3a34", 8),
};
T.grass.repeat.set(18, 18);
T.dirt.repeat.set(8, 8);

function L(color, map, extra = {}) {
return new THREE.MeshLambertMaterial({ color, map, ...extra });
}
const MAT = {
plaster: L(0xe8dcc4, T.plaster),
plaster2: L(0xd9c4a0, T.plaster),
plaster3: L(0xcbb89a, T.plaster),
timber: L(0x3a2416, T.wood),
thatch: L(0x8a6b34, T.thatch),
tile: L(0x7a3228, T.tile),
slate: L(0x5a5e66, T.slate),
stone: L(0x8a8478, T.stone),
darkStone: L(0x4a463f, T.stone),
wood: L(0x5c3a22, T.wood),
dirt: L(0x6a5340, T.dirt),
grass: L(0x4d6a38, T.grass),
cobble: L(0x7a7468, T.cobble),
crop: L(0x7a8a3a, T.grass),
wheat: L(0xb89640, T.thatch),
water: new THREE.MeshStandardMaterial({ color: 0x3a6a72, roughness: 0.22, metalness: 0.28 }),
glass: L(0x88aacc, null, { emissive: 0x22180c, emissiveIntensity: 0.2 }),
stainR: L(0xaa3344, null, { emissive: 0x551018, emissiveIntensity: 0.35 }),
stainB: L(0x3344aa, null, { emissive: 0x101855, emissiveIntensity: 0.35 }),
stainG: L(0x228855, null, { emissive: 0x083318, emissiveIntensity: 0.3 }),
hearth: L(0xff6622, null, { emissive: 0xff4410, emissiveIntensity: 0.8 }),
lantern: L(0xffcc66, null, { emissive: 0xffaa44, emissiveIntensity: 1.2 }),
flag: L(0x9a2f2a),
leaf: L(0x2f5a28),
leaf2: L(0x3d6b32),
bark: L(0x3a2a18, T.wood),
sheep: L(0xeee8dc),
straw: L(0xc4a15a),
};
const roofMats = [MAT.thatch, MAT.tile, MAT.slate, MAT.thatch, MAT.tile];
const wallMats = [MAT.plaster, MAT.plaster2, MAT.plaster3, MAT.plaster];

const xcache = new Map();
function xrayOf(mat) {
if (xcache.has(mat.uuid)) return xcache.get(mat.uuid);
const m = mat.clone();
m.transparent = true;
m.opacity = 0.18;
m.depthWrite = false;
xcache.set(mat.uuid, m);
return m;
}

function mesh(geo, mat, x, y, z, sx, sy, sz) {
const o = new THREE.Mesh(geo, mat);
o.position.set(x, y, z);
if (sx) o.scale.set(sx, sy ?? 1, sz ?? 1);
o.castShadow = true;
o.receiveShadow = true;
o.userData.omat = mat;
o.userData.xmat = xrayOf(mat);
return o;
}

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const cone = new THREE.ConeGeometry(1, 1, 8);
const sph = new THREE.SphereGeometry(1, 10, 8);

const buildings = [];
const places = {};
const nodes = [];
const NODE_R = 2.6;
let roofCount = 0;
const chimneys = [];
const lanterns = [];
const pickables = [];

function addNode(x, z) {
for (const n of nodes) {
  if ((n.x - x) ** 2 + (n.z - z) ** 2 < NODE_R * NODE_R) return n;
}
const n = { id: nodes.length, x, z, nbs: [] };
nodes.push(n);
return n;
}
function link(a, b) {
if (!a || !b || a === b) return;
if (!a.nbs.includes(b)) a.nbs.push(b);
if (!b.nbs.includes(a)) b.nbs.push(a);
}
function nearestNode(x, z) {
let best = nodes[0], bd = 1e9;
for (const n of nodes) {
  const d = (n.x - x) ** 2 + (n.z - z) ** 2;
  if (d < bd) { bd = d; best = n; }
}
return best;
}
function pave(ax, az, bx, bz, step = 3.4) {
const dx = bx - ax, dz = bz - az;
const len = Math.hypot(dx, dz) || 1;
const steps = Math.max(1, Math.round(len / step));
let prev = addNode(ax, az);
for (let i = 1; i <= steps; i++) {
  const t = i / steps;
  const n = addNode(ax + dx * t, az + dz * t);
  link(prev, n);
  prev = n;
}
const geo = new THREE.BoxGeometry(len, 0.06, 2.15);
const m = mesh(geo, MAT.dirt, (ax + bx) / 2, 0.04, (az + bz) / 2);
m.rotation.y = Math.atan2(dx, dz);
m.receiveShadow = true;
m.castShadow = false;
scene.add(m);
return prev;
}

const OCC = new Set();
function mark(x, z, w, d, pad = 0.7) {
const x0 = Math.floor(x - w / 2 - pad), x1 = Math.ceil(x + w / 2 + pad);
const z0 = Math.floor(z - d / 2 - pad), z1 = Math.ceil(z + d / 2 + pad);
for (let ix = x0; ix <= x1; ix++)
  for (let iz = z0; iz <= z1; iz++) OCC.add(ix + "," + iz);
}
function free(x, z, w, d, pad = 0.7) {
const x0 = Math.floor(x - w / 2 - pad), x1 = Math.ceil(x + w / 2 + pad);
const z0 = Math.floor(z - d / 2 - pad), z1 = Math.ceil(z + d / 2 + pad);
for (let ix = x0; ix <= x1; ix++)
  for (let iz = z0; iz <= z1; iz++) if (OCC.has(ix + "," + iz)) return false;
return true;
}
function inWalls(x, z) {
return (x * x) / (48 * 48) + (z * z) / (44 * 44) < 1;
}

function registerRoof(o, b) {
b.roofs.push(o);
o.userData.baseY = o.position.y;
roofCount++;
}
function tagBuilding(group, b) {
group.traverse((o) => {
  if (o.isMesh) {
    o.userData.building = b;
    pickables.push(o);
  }
});
}

function prismRoof(w, h, d, mat) {
const sh = new THREE.Shape();
sh.moveTo(-w / 2, 0);
sh.lineTo(w / 2, 0);
sh.lineTo(0, h);
sh.closePath();
const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
g.translate(0, 0, -d / 2);
g.rotateX(-Math.PI / 2);
g.rotateY(Math.PI / 2);
// After rotate, extent along Z is w, along X is d — swap by extra yaw if needed.
// Rebuild more predictably:
return mesh(g, mat, 0, 0, 0);
}

function makeGable(w, h, d, mat) {
const sh = new THREE.Shape();
sh.moveTo(-w / 2, 0);
sh.lineTo(w / 2, 0);
sh.lineTo(0, h);
sh.closePath();
const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
g.translate(0, 0, -d / 2);
const m = new THREE.Mesh(g, mat);
m.castShadow = true;
m.receiveShadow = true;
m.userData.omat = mat;
m.userData.xmat = xrayOf(mat);
return m;
}

function addChimney(parent, b, x, y, z) {
const c = mesh(box, MAT.darkStone, x, y + 0.45, z, 0.38, 0.9, 0.38);
parent.add(c);
const cap = mesh(box, MAT.darkStone, x, y + 0.95, z, 0.48, 0.12, 0.48);
parent.add(cap);
const wp = new THREE.Vector3();
chimneys.push({ parent, x, y: y + 1.05, z, wp });
}

function addWindow(parent, x, y, z, w, h, stain) {
const m = mesh(box, stain || MAT.glass, x, y, z, w, h, 0.06);
parent.add(m);
return m;
}

function addTimber(parent, w, h, d) {
const t = 0.08;
parent.add(mesh(box, MAT.timber, 0, h * 0.5, d / 2 + 0.01, w + 0.04, t, t));
parent.add(mesh(box, MAT.timber, 0, 0.08, d / 2 + 0.01, w + 0.04, t, t));
parent.add(mesh(box, MAT.timber, -w / 2, h * 0.5, d / 2 + 0.01, t, h, t));
parent.add(mesh(box, MAT.timber, w / 2, h * 0.5, d / 2 + 0.01, t, h, t));
if (h > 2.2) parent.add(mesh(box, MAT.timber, 0, h * 0.55, d / 2 + 0.01, t, h * 0.9, t));
parent.add(mesh(box, MAT.timber, 0, h * 0.35, d / 2 + 0.02, w * 0.7, t, t));
}

function makeInterior(g, w, d, h) {
g.add(mesh(box, MAT.wood, 0, 0.06, 0, w - 0.2, 0.08, d - 0.2));
g.add(mesh(box, MAT.hearth, 0.15 - w * 0.28, 0.45, -d * 0.28, 0.45, 0.7, 0.28));
g.add(mesh(box, MAT.wood, w * 0.18, 0.32, 0.1, 0.7, 0.08, 0.45));
g.add(mesh(box, MAT.straw, -w * 0.2, 0.16, d * 0.22, 0.7, 0.16, 0.4));
}

function makeHouse(x, z, rot, opts = {}) {
const w = opts.w ?? r(2.6, 3.9);
const d = opts.d ?? r(2.8, 4.2);
const h = opts.h ?? r(1.85, 2.55);
const storeys = opts.storeys ?? (rnd() < 0.28 ? 2 : 1);
const H = storeys === 2 ? h + 1.15 : h;
const wall = opts.wall ?? pick(wallMats);
const roofM = opts.roof ?? pick(roofMats);
const g = new THREE.Group();
g.position.set(x, 0, z);
g.rotation.y = rot || 0;
const b = {
  id: buildings.length, kind: opts.kind || "house", name: opts.name || "cottage",
  group: g, roofs: [], x, z, rot: rot || 0, w, d, H,
  door: { x, z }, occupants: [],
};
const body = mesh(box, wall, 0, H / 2, 0, w, H, d);
g.add(body);
addTimber(g, w, H, d);
g.add(mesh(box, MAT.wood, 0, 0.55, d / 2 + 0.02, 0.42, 1.05, 0.06));
addWindow(g, -w * 0.28, H * 0.55, d / 2 + 0.03, 0.32, 0.38);
addWindow(g, w * 0.28, H * 0.55, d / 2 + 0.03, 0.32, 0.38);
if (storeys === 2) addWindow(g, 0, H * 0.78, d / 2 + 0.03, 0.28, 0.3);
const roof = makeGable(w + 0.35, 1.15 + rnd() * 0.25, d + 0.28, roofM);
roof.position.set(0, H, 0);
g.add(roof);
registerRoof(roof, b);
if (rnd() < 0.85 || opts.chimney !== false) addChimney(g, b, w * 0.28, H + 0.7, -d * 0.1);
if (opts.lean !== false && rnd() < 0.35) {
  const lw = w * 0.55, ld = d * 0.45, lh = H * 0.62;
  g.add(mesh(box, wall, w * 0.55, lh / 2, 0, lw, lh, ld));
  const lr = makeGable(lw + 0.15, 0.7, ld + 0.12, roofM);
  lr.position.set(w * 0.55, lh, 0);
  g.add(lr);
  registerRoof(lr, b);
}
makeInterior(g, w, d, H);
const doorLocal = new THREE.Vector3(0, 0, d / 2 + 0.6);
doorLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y);
b.door = { x: x + doorLocal.x, z: z + doorLocal.z };
const dn = addNode(b.door.x, b.door.z);
link(dn, nearestNode(b.door.x, b.door.z));
scene.add(g);
tagBuilding(g, b);
buildings.push(b);
mark(x, z, w + 0.8, d + 0.8);
return b;
}

function makeStall(x, z, rot, color) {
const g = new THREE.Group();
g.position.set(x, 0, z);
g.rotation.y = rot;
const b = { id: buildings.length, kind: "stall", name: "market stall", group: g, roofs: [], x, z, rot, w: 1.6, d: 1.4, H: 1.4, door: { x, z }, occupants: [] };
g.add(mesh(box, MAT.wood, 0, 0.35, 0, 1.5, 0.08, 1.2));
g.add(mesh(cyl, MAT.wood, -0.65, 0.7, -0.5, 0.05, 1.3, 0.05));
g.add(mesh(cyl, MAT.wood, 0.65, 0.7, -0.5, 0.05, 1.3, 0.05));
g.add(mesh(cyl, MAT.wood, -0.65, 0.7, 0.5, 0.05, 1.3, 0.05));
g.add(mesh(cyl, MAT.wood, 0.65, 0.7, 0.5, 0.05, 1.3, 0.05));
const cloth = mesh(box, L(color, null), 0, 1.38, 0, 1.7, 0.06, 1.4);
cloth.rotation.x = -0.12;
g.add(cloth);
registerRoof(cloth, b);
g.add(mesh(box, MAT.straw, 0, 0.48, 0, 0.7, 0.2, 0.5));
scene.add(g);
tagBuilding(g, b);
buildings.push(b);
mark(x, z, 1.8, 1.6, 0.2);
return b;
}

function makeKeep() {
const x = -46, z = -40;
const g = new THREE.Group();
g.position.set(x, 0, z);
const b = { id: buildings.length, kind: "keep", name: "the Antler Keep", group: g, roofs: [], x, z, rot: 0, w: 14, d: 14, H: 10, door: { x: x + 4, z: z + 8 }, occupants: [] };
g.add(mesh(cyl, MAT.darkStone, 0, 0.4, 0, 9.5, 0.8, 9.5));
const hall = mesh(box, MAT.stone, 0, 3.2, 0, 8.4, 6.4, 8.4);
g.add(hall);
for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) {
  g.add(mesh(cyl, MAT.darkStone, i * 4.1, 4.4, j * 4.1, 1.35, 8.8, 1.35));
  const cap = mesh(cone, MAT.tile, i * 4.1, 9.5, j * 4.1, 1.7, 2.4, 1.7);
  g.add(cap); registerRoof(cap, b);
}
const keepRoof = makeGable(8.8, 2.2, 8.8, MAT.slate);
keepRoof.position.set(0, 6.5, 0);
g.add(keepRoof); registerRoof(keepRoof, b);
for (let i = -3; i <= 3; i++) {
  g.add(mesh(box, MAT.darkStone, i * 1.15, 6.7, 4.3, 0.55, 0.7, 0.3));
  g.add(mesh(box, MAT.darkStone, i * 1.15, 6.7, -4.3, 0.55, 0.7, 0.3));
}
g.add(mesh(box, MAT.wood, 3.6, 1.1, 4.3, 1.1, 2.2, 0.15));
addWindow(g, -1.6, 4.2, 4.25, 0.5, 0.9, MAT.stainR);
addWindow(g, 1.6, 4.2, 4.25, 0.5, 0.9, MAT.stainB);
const flagG = new THREE.Group();
flagG.position.set(-4.1, 10.6, -4.1);
flagG.add(mesh(cyl, MAT.timber, 0, 0.8, 0, 0.05, 1.6, 0.05));
const flag = mesh(box, MAT.flag, 0.55, 1.15, 0, 1.1, 0.55, 0.04);
flag.userData.flag = true;
flagG.add(flag);
g.add(flagG);
addChimney(g, b, 1.6, 7.4, 0.4);
makeInterior(g, 6, 6, 4);
scene.add(g);
tagBuilding(g, b);
buildings.push(b);
mark(x, z, 16, 16);
places.keep = { x, z };
places.keepDoor = b.door;
const dn = addNode(b.door.x, b.door.z);
link(dn, nearestNode(b.door.x, b.door.z));
return b;
}

function makeChurch() {
const x = 30, z = -8;
const g = new THREE.Group();
g.position.set(x, 0, z);
const b = { id: buildings.length, kind: "church", name: "Saint Brannoc's", group: g, roofs: [], x, z, rot: 0, w: 7, d: 14, H: 5, door: { x: x - 4.2, z }, occupants: [] };
g.add(mesh(box, MAT.stone, 0, 2.3, 0.6, 5.6, 4.6, 11.2));
const naveR = makeGable(6.2, 2.4, 11.4, MAT.slate);
naveR.position.set(0, 4.65, 0.6);
g.add(naveR); registerRoof(naveR, b);
g.add(mesh(box, MAT.stone, 0, 4.6, -5.6, 3.2, 9.2, 3.2));
const spire = mesh(cone, MAT.slate, 0, 11.4, -5.6, 2.1, 4.6, 2.1);
g.add(spire); registerRoof(spire, b);
g.add(mesh(box, MAT.wood, -2.85, 1.15, 0.2, 0.12, 2.3, 1.1));
addWindow(g, 2.85, 2.4, 1.6, 0.08, 1.4, MAT.stainR);
addWindow(g, 2.85, 2.4, 3.4, 0.08, 1.4, MAT.stainB);
addWindow(g, 2.85, 2.4, -0.6, 0.08, 1.4, MAT.stainG);
addWindow(g, -2.85, 2.4, 2.4, 0.08, 1.4, MAT.stainB);
addWindow(g, 0, 7.6, -4.0, 0.5, 0.8, MAT.stainR);
for (let i = 0; i < 14; i++) {
  const gx = x + r(-6, 7), gz = z + r(2, 10);
  if (Math.hypot(gx - x, gz - z) < 4) continue;
  scene.add(mesh(box, MAT.stone, gx, 0.28, gz, 0.35, 0.55, 0.18));
}
scene.add(g);
tagBuilding(g, b);
buildings.push(b);
mark(x, z, 10, 16);
places.church = { x, z };
places.churchDoor = b.door;
const dn = addNode(b.door.x, b.door.z);
link(dn, nearestNode(b.door.x, b.door.z));
return b;
}

function makeTavern() {
const x = -7, z = 16;
const b = makeHouse(x, z, 0, { w: 6.2, d: 5.2, h: 2.4, storeys: 2, roof: MAT.tile, wall: MAT.plaster2, kind: "tavern", name: "the Crooked Stag", lean: false, chimney: true });
const sign = mesh(box, MAT.wood, 0, 2.5, 2.75, 0.08, 0.08, 0.7);
b.group.add(sign);
const board = mesh(box, MAT.flag, 0, 2.25, 3.15, 0.7, 0.5, 0.05);
b.group.add(board);
b.group.add(mesh(box, MAT.wood, -1.4, 0.4, 3.1, 0.7, 0.08, 0.7));
b.group.add(mesh(box, MAT.wood, 1.3, 0.4, 3.1, 0.7, 0.08, 0.7));
places.tavern = { x, z };
return b;
}

function makeSmithy() {
const x = 13, z = 15;
const b = makeHouse(x, z, -0.3, { w: 4.4, d: 4.0, h: 2.1, roof: MAT.slate, wall: MAT.plaster3, kind: "smithy", name: "Hob's forge", lean: false });
const forge = mesh(box, MAT.hearth, 1.6, 0.5, 0.2, 0.9, 0.7, 0.8);
b.group.add(forge);
const glow = new THREE.PointLight(0xff6622, 0.0, 8, 2);
glow.position.set(1.6, 0.8, 0.2);
b.group.add(glow);
lanterns.push({ light: glow, day: 0.15, night: 1.6 });
places.smithy = { x, z };
return b;
}

function makeMill() {
const x = -18, z = 30;
const g = new THREE.Group();
g.position.set(x, 0, z);
const b = { id: buildings.length, kind: "mill", name: "mill on the mere", group: g, roofs: [], x, z, rot: 0, w: 4, d: 4, H: 6, door: { x: x + 2.4, z }, occupants: [] };
g.add(mesh(cyl, MAT.plaster2, 0, 2.6, 0, 2.15, 5.2, 2.15));
const cap = mesh(cone, MAT.thatch, 0, 5.9, 0, 2.6, 2.1, 2.6);
g.add(cap); registerRoof(cap, b);
const wheel = new THREE.Group();
wheel.position.set(2.3, 1.8, 0);
for (let i = 0; i < 8; i++) {
  const blade = mesh(box, MAT.wood, 0, 0, 0, 0.12, 2.6, 0.35);
  blade.rotation.z = (i * Math.PI) / 8;
  wheel.add(blade);
}
wheel.add(mesh(cyl, MAT.timber, 0, 0, 0, 0.2, 0.3, 0.2));
g.add(wheel);
b.wheel = wheel;
scene.add(g);
tagBuilding(g, b);
buildings.push(b);
mark(x, z, 7, 7);
places.mill = { x, z };
const dn = addNode(b.door.x, b.door.z);
link(dn, nearestNode(b.door.x, b.door.z));
return b;
}

function makeHall() {
const x = -14, z = -5;
const b = makeHouse(x, z, 0.4, { w: 5.4, d: 4.6, h: 2.5, storeys: 2, roof: MAT.slate, wall: MAT.stone, kind: "hall", name: "parish hall", lean: false });
places.hall = { x, z };
return b;
}

function makeBakery() {
const x = 9, z = -1;
const b = makeHouse(x, z, -0.2, { w: 3.8, d: 3.6, h: 2.2, roof: MAT.tile, kind: "bakery", name: "oven house", lean: false });
places.bakery = { x, z };
return b;
}

function makeClockTower() {
const x = 0, z = -6.5;
const g = new THREE.Group();
g.position.set(x, 0, z);
const b = { id: buildings.length, kind: "tower", name: "the hour tower", group: g, roofs: [], x, z, rot: 0, w: 3, d: 3, H: 9, door: { x, z: z + 1.8 }, occupants: [] };
g.add(mesh(box, MAT.stone, 0, 4.2, 0, 2.8, 8.4, 2.8));
const cap = mesh(cone, MAT.tile, 0, 9.4, 0, 2.1, 2.2, 2.1);
g.add(cap); registerRoof(cap, b);
const face = mesh(cyl, MAT.plaster, 0, 7.1, 1.42, 0.7, 0.08, 0.7);
face.rotation.x = Math.PI / 2;
g.add(face);
const hh = new THREE.Group();
hh.position.set(0, 7.1, 1.49);
hh.add(mesh(box, MAT.timber, 0, 0.18, 0, 0.08, 0.42, 0.04));
const mh = new THREE.Group();
mh.position.set(0, 7.1, 1.52);
mh.add(mesh(box, MAT.tile, 0, 0.26, 0, 0.05, 0.58, 0.04));
g.add(hh); g.add(mh);
b.hands = { hh, mh };
scene.add(g);
tagBuilding(g, b);
buildings.push(b);
mark(x, z, 4, 4);
places.tower = { x, z };
return b;
}

function makeWell() {
const g = new THREE.Group();
g.position.set(0, 0, 3.2);
g.add(mesh(cyl, MAT.stone, 0, 0.35, 0, 1.05, 0.7, 1.05));
g.add(mesh(cyl, MAT.wood, 0, 1.35, 0, 0.06, 1.5, 0.06));
g.add(mesh(cyl, MAT.wood, 0.7, 1.1, 0, 0.05, 1.1, 0.05));
g.add(mesh(cyl, MAT.wood, -0.7, 1.1, 0, 0.05, 1.1, 0.05));
g.add(mesh(box, MAT.thatch, 0, 1.75, 0, 1.6, 0.1, 1.2));
roofCount++;
scene.add(g);
mark(0, 3.2, 2.4, 2.4, 0.4);
places.well = { x: 0, z: 3.2 };
places.square = { x: 0, z: 4 };
}

function makeCross() {
const g = new THREE.Group();
g.position.set(3.4, 0, 1.2);
g.add(mesh(box, MAT.stone, 0, 0.2, 0, 0.9, 0.35, 0.9));
g.add(mesh(box, MAT.stone, 0, 1.1, 0, 0.22, 1.8, 0.18));
g.add(mesh(box, MAT.stone, 0, 1.55, 0, 0.85, 0.16, 0.16));
scene.add(g);
}

function makeWalls() {
const rx = 48, rz = 44;
for (let i = 0; i < 72; i++) {
  const t = (i / 72) * Math.PI * 2;
  const x = Math.cos(t) * rx, z = Math.sin(t) * rz;
  if (Math.abs(Math.cos(t)) > 0.96 || Math.abs(Math.sin(t)) > 0.96) continue;
  const seg = mesh(box, MAT.stone, x, 1.15, z, 4.2, 2.3, 0.7);
  seg.lookAt(0, 1.15, 0);
  scene.add(seg);
  if (i % 2 === 0) {
    const mer = mesh(box, MAT.darkStone, x, 2.45, z, 1.1, 0.55, 0.55);
    mer.lookAt(0, 2.45, 0);
    scene.add(mer);
  }
}
const gates = [
  { x: 0, z: -44, name: "north gate", place: "northGate" },
  { x: 0, z: 44, name: "south gate", place: "southGate" },
  { x: 48, z: 0, name: "east gate", place: "eastGate" },
  { x: -48, z: 0, name: "west gate", place: "westGate" },
];
for (const gt of gates) {
  const g = new THREE.Group();
  g.position.set(gt.x, 0, gt.z);
  if (Math.abs(gt.x) > Math.abs(gt.z)) g.rotation.y = Math.PI / 2;
  const b = { id: buildings.length, kind: "gate", name: gt.name, group: g, roofs: [], x: gt.x, z: gt.z, rot: g.rotation.y, w: 6, d: 4, H: 5, door: { x: gt.x, z: gt.z }, occupants: [] };
  g.add(mesh(box, MAT.stone, -2.4, 2.2, 0, 2.2, 4.4, 2.4));
  g.add(mesh(box, MAT.stone, 2.4, 2.2, 0, 2.2, 4.4, 2.4));
  g.add(mesh(box, MAT.stone, 0, 3.8, 0, 3.2, 1.4, 2.0));
  const r1 = mesh(cone, MAT.tile, -2.4, 5.1, 0, 1.5, 1.5, 1.5);
  const r2 = mesh(cone, MAT.tile, 2.4, 5.1, 0, 1.5, 1.5, 1.5);
  g.add(r1); g.add(r2); registerRoof(r1, b); registerRoof(r2, b);
  scene.add(g);
  tagBuilding(g, b);
  buildings.push(b);
  places[gt.place] = { x: gt.x, z: gt.z };
  addNode(gt.x, gt.z);
}
const towers = [];
for (let k = 0; k < 8; k++) {
  const t = (k / 8) * Math.PI * 2 + Math.PI / 8;
  const x = Math.cos(t) * rx, z = Math.sin(t) * rz;
  if (Math.abs(Math.cos(t)) > 0.92 || Math.abs(Math.sin(t)) > 0.92) continue;
  towers.push({ x, z });
}
for (const tw of towers) {
  const g = new THREE.Group();
  g.position.set(tw.x, 0, tw.z);
  const b = { id: buildings.length, kind: "watch", name: "watch tower", group: g, roofs: [], x: tw.x, z: tw.z, rot: 0, w: 3, d: 3, H: 6, door: tw, occupants: [] };
  g.add(mesh(cyl, MAT.stone, 0, 2.6, 0, 1.4, 5.2, 1.4));
  const cap = mesh(cone, MAT.tile, 0, 5.9, 0, 1.8, 1.6, 1.8);
  g.add(cap); registerRoof(cap, b);
  const lamp = mesh(sph, MAT.lantern, 0, 4.6, 1.3, 0.12, 0.12, 0.12);
  g.add(lamp);
  const pl = new THREE.PointLight(0xffcc77, 0, 10, 2);
  pl.position.set(0, 4.6, 1.3);
  g.add(pl);
  lanterns.push({ light: pl, day: 0, night: 1.1 });
  scene.add(g);
  tagBuilding(g, b);
  buildings.push(b);
  mark(tw.x, tw.z, 3.5, 3.5);
}
}

function makeFarm(x, z, rot) {
const house = makeHouse(x, z, rot, { w: 3.6, d: 3.8, h: 2.1, roof: MAT.thatch, kind: "farm", name: "croft", lean: true });
const bx = x + Math.cos(rot) * 5.2, bz = z + Math.sin(rot) * 5.2;
if (free(bx, bz, 4.4, 3.2, 0.4)) {
  const barn = makeHouse(bx, bz, rot + 0.2, { w: 4.4, d: 3.2, h: 2.6, roof: MAT.thatch, wall: MAT.wood, kind: "barn", name: "barn", lean: false, storeys: 1 });
  barn.group.children[0];
}
const fx = x + Math.cos(rot + 1.2) * 7, fz = z + Math.sin(rot + 1.2) * 7;
const fw = r(7, 11), fd = r(5, 8);
const field = mesh(box, rnd() < 0.5 ? MAT.crop : MAT.wheat, fx, 0.06, fz, fw, 0.1, fd);
field.castShadow = false;
scene.add(field);
mark(fx, fz, fw, fd, 0.2);
const key = "field" + buildings.length;
places[key] = { x: fx, z: fz };
house.field = places[key];
for (let i = 0; i < 4; i++) {
  const px = fx + r(-fw / 2, fw / 2), pz = fz + r(-fd / 2, fd / 2);
  scene.add(mesh(box, MAT.wood, px, 0.35, pz, 0.08, 0.7, 0.08));
}
return house;
}

function makeTrees() {
const trunkG = new THREE.CylinderGeometry(0.16, 0.22, 1.4, 6);
const leafG = new THREE.SphereGeometry(1, 7, 6);
const n = 110;
const trunks = new THREE.InstancedMesh(trunkG, MAT.bark, n);
const leaves = new THREE.InstancedMesh(leafG, MAT.leaf, n);
const leaves2 = new THREE.InstancedMesh(leafG, MAT.leaf2, n);
trunks.castShadow = leaves.castShadow = leaves2.castShadow = true;
const dummy = new THREE.Object3D();
let placed = 0, guard = 0;
while (placed < n && guard++ < 800) {
  const x = r(-88, 88), z = r(-88, 88);
  if (inWalls(x, z) && rnd() < 0.82) continue;
  if (!free(x, z, 1.6, 1.6, 0.4)) continue;
  if (Math.hypot(x + 18, z - 30) < 8) continue;
  dummy.position.set(x, 0.7, z);
  dummy.scale.set(1, r(0.8, 1.4), 1);
  dummy.rotation.y = r(0, 6);
  dummy.updateMatrix();
  trunks.setMatrixAt(placed, dummy.matrix);
  dummy.position.set(x, 2.1 + r(0, 0.4), z);
  dummy.scale.set(r(1.1, 1.7), r(1.0, 1.5), r(1.1, 1.7));
  dummy.updateMatrix();
  leaves.setMatrixAt(placed, dummy.matrix);
  dummy.position.x += r(-0.3, 0.3);
  dummy.position.z += r(-0.3, 0.3);
  dummy.scale.multiplyScalar(0.7);
  dummy.updateMatrix();
  leaves2.setMatrixAt(placed, dummy.matrix);
  mark(x, z, 1.4, 1.4, 0.3);
  placed++;
}
scene.add(trunks, leaves, leaves2);
}

function makeRiver() {
const pts = [
  new THREE.Vector3(-90, -0.35, 58),
  new THREE.Vector3(-50, -0.35, 44),
  new THREE.Vector3(-22, -0.35, 32),
  new THREE.Vector3(6, -0.35, 24),
  new THREE.Vector3(36, -0.35, 20),
  new THREE.Vector3(70, -0.35, 12),
  new THREE.Vector3(95, -0.35, 4),
];
const curve = new THREE.CatmullRomCurve3(pts);
const samples = curve.getPoints(80);
const half = 4.4;
const positions = [];
const indices = [];
for (let i = 0; i < samples.length; i++) {
  const p = samples[i];
  const q = samples[Math.min(i + 1, samples.length - 1)];
  const dx = q.x - p.x, dz = q.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * half, pz = (dx / len) * half;
  positions.push(p.x + px, 0.03, p.z + pz, p.x - px, 0.03, p.z - pz);
}
for (let i = 0; i < samples.length - 1; i++) {
  const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
  indices.push(a, b, c, b, d, c);
}
const rgeo = new THREE.BufferGeometry();
rgeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
rgeo.setIndex(indices);
rgeo.computeVertexNormals();
const river = new THREE.Mesh(rgeo, MAT.water);
river.receiveShadow = true;
scene.add(river);
for (const p of samples) mark(p.x, p.z, 8.5, 8.5, 0);
// banks
for (const p of samples) {
  if (rnd() < 0.35) scene.add(mesh(sph, MAT.stone, p.x + r(-5, 5), 0.08, p.z + r(-2, 2), 0.25, 0.12, 0.2));
}
const brx = 6, brz = 24;
const bridge = new THREE.Group();
bridge.position.set(brx, 0, brz);
bridge.rotation.y = 0.35;
bridge.add(mesh(box, MAT.stone, 0, 0.85, 0, 3.2, 0.28, 11));
bridge.add(mesh(box, MAT.stone, -1.4, 1.15, 0, 0.2, 0.45, 11));
bridge.add(mesh(box, MAT.stone, 1.4, 1.15, 0, 0.2, 0.45, 11));
bridge.add(mesh(cyl, MAT.stone, 0, 0.2, -3, 0.7, 1.1, 0.7));
bridge.add(mesh(cyl, MAT.stone, 0, 0.2, 3, 0.7, 1.1, 0.7));
scene.add(bridge);
places.bridge = { x: brx, z: brz };
pave(brx - 6, brz - 8, brx, brz);
pave(brx, brz, brx + 5, brz + 6);
}

function makeGround() {
const ground = mesh(box, MAT.grass, 0, -0.2, 0, 200, 0.4, 200);
ground.receiveShadow = true;
ground.castShadow = false;
scene.add(ground);
const square = mesh(box, MAT.cobble, 0, 0.03, 3.5, 18, 0.06, 16);
square.receiveShadow = true;
square.castShadow = false;
scene.add(square);
}

function makeLanternPost(x, z) {
const g = new THREE.Group();
g.position.set(x, 0, z);
g.add(mesh(cyl, MAT.timber, 0, 1.1, 0, 0.07, 2.2, 0.07));
g.add(mesh(sph, MAT.lantern, 0, 2.25, 0, 0.16, 0.16, 0.16));
const pl = new THREE.PointLight(0xffcc77, 0, 9, 2);
pl.position.set(0, 2.25, 0);
g.add(pl);
lanterns.push({ light: pl, day: 0, night: 1.25 });
scene.add(g);
}

const pathCache = new Map();
function astar(a, b) {
if (!a || !b) return [];
if (a === b) return [a];
const key = a.id + ">" + b.id;
if (pathCache.has(key)) return pathCache.get(key);
const open = [a];
const came = new Map();
const gS = new Map([[a, 0]]);
const fS = new Map([[a, Math.hypot(a.x - b.x, a.z - b.z)]]);
const seen = new Set();
while (open.length) {
  open.sort((p, q) => (fS.get(p) ?? 1e9) - (fS.get(q) ?? 1e9));
  const cur = open.shift();
  if (cur === b) {
    const path = [cur];
    let k = cur;
    while (came.has(k)) { k = came.get(k); path.push(k); }
    path.reverse();
    pathCache.set(key, path);
    return path;
  }
  seen.add(cur);
  for (const nb of cur.nbs) {
    if (seen.has(nb)) continue;
    const tent = (gS.get(cur) ?? 1e9) + Math.hypot(cur.x - nb.x, cur.z - nb.z);
    if (tent < (gS.get(nb) ?? 1e9)) {
      came.set(nb, cur);
      gS.set(nb, tent);
      fS.set(nb, tent + Math.hypot(nb.x - b.x, nb.z - b.z));
      if (!open.includes(nb)) open.push(nb);
    }
  }
}
pathCache.set(key, [a, b]);
return [a, b];
}
function route(ax, az, bx, bz) {
const path = astar(nearestNode(ax, az), nearestNode(bx, bz));
const pts = [{ x: ax, z: az }, ...path.map((n) => ({ x: n.x, z: n.z })), { x: bx, z: bz }];
return pts;
}
function along(pts, u) {
if (!pts.length) return { x: 0, z: 0 };
if (u <= 0) return pts[0];
if (u >= 1) return pts[pts.length - 1];
let total = 0;
const seg = [];
for (let i = 0; i < pts.length - 1; i++) {
  const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  seg.push(L); total += L;
}
let acc = 0, t = u * (total || 1);
for (let i = 0; i < seg.length; i++) {
  if (acc + seg[i] >= t) {
    const f = seg[i] ? (t - acc) / seg[i] : 0;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, z: pts[i].z + (pts[i + 1].z - pts[i].z) * f };
  }
  acc += seg[i];
}
return pts[pts.length - 1];
}

const FIRST = ["Aldric","Beatrice","Cedric","Dunstan","Edith","Fenella","Godric","Hilda","Ivo","Joan","Kenelm","Leda","Merek","Nell","Osric","Peta","Quen","Rowe","Sibley","Tobin","Una","Wulfric","Ysolda","Hob","Marta","Isolde","Aldous","Brannoc","Tess","Piers","Githa","Elric","Maud","Ralf","Agnes","Col","Brigit","Watt","Efa","Hugh","Rose","Tom","Meg","Will","Kate","Simon","Annis","Giles","Ruth","Owen"];
const LAST = ["Attewell","Baker","Cooper","Miller","Thatcher","Reed","Underhill","of the Mere","Chandler","Fletcher","Wainwright","Sawyer","Herd","Fisher","Clerk","Smith","Wright","Goodale","Penny","Croft","Ash","Bywater","Hollow","Stag","Kettle","Nash","Pottle","Wick","Yarrow","Dunn"];
const ROLES = [
{ id: "farmer", label: "croft-hand", color: 0x8a4a28, n: 38, work: "field" },
{ id: "merchant", label: "chapman", color: 0x2f5d52, n: 14, work: "square" },
{ id: "guard", label: "watch", color: 0x6a2030, n: 10, work: "patrol" },
{ id: "baker", label: "oven-hand", color: 0xc4b08a, n: 5, work: "bakery" },
{ id: "smith", label: "smith", color: 0x33302c, n: 4, work: "smithy" },
{ id: "miller", label: "miller", color: 0x6a7a88, n: 3, work: "mill" },
{ id: "priest", label: "of the parish", color: 0x1a1814, n: 2, work: "church" },
{ id: "tavern", label: "of the Stag", color: 0x9a2f2a, n: 5, work: "tavern" },
{ id: "child", label: "child", color: 0x4a6a88, n: 12, work: "square" },
{ id: "elder", label: "elder", color: 0x8a8478, n: 8, work: "well" },
{ id: "noble", label: "of the keep", color: 0x6a2040, n: 3, work: "keep" },
{ id: "fisher", label: "fisher", color: 0x3a5a6a, n: 8, work: "bridge" },
{ id: "laborer", label: "day-labor", color: 0x5a4a38, n: 20, work: "square" },
{ id: "herd", label: "herd", color: 0x6a7a40, n: 8, work: "field" },
];

function scheduleFor(role, home, work) {
const H = home, W = work, S = "square", T = "tavern", C = "church", E = "well";
if (role === "farmer" || role === "herd")
  return [{ t: 0, a: "asleep", p: H }, { t: 5.2, a: "fetching water", p: E }, { t: 6.1, a: "in the fields", p: W }, { t: 12, a: "at market", p: S }, { t: 13.2, a: "in the fields", p: W }, { t: 18.2, a: "supper at the Stag", p: T }, { t: 20.4, a: "walking home", p: H }, { t: 21.2, a: "asleep", p: H }];
if (role === "baker")
  return [{ t: 0, a: "asleep", p: H }, { t: 3.5, a: "lighting the oven", p: W }, { t: 11, a: "selling bread", p: S }, { t: 14, a: "at the oven", p: W }, { t: 17.5, a: "vespers", p: C }, { t: 18.5, a: "at the Stag", p: T }, { t: 20.5, a: "asleep", p: H }];
if (role === "smith")
  return [{ t: 0, a: "asleep", p: H }, { t: 6, a: "at the forge", p: W }, { t: 12, a: "a pint", p: T }, { t: 13, a: "at the forge", p: W }, { t: 18.5, a: "at the Stag", p: T }, { t: 21, a: "asleep", p: H }];
if (role === "miller")
  return [{ t: 0, a: "asleep", p: H }, { t: 5.5, a: "at the mill", p: W }, { t: 12.5, a: "at market", p: S }, { t: 13.5, a: "at the mill", p: W }, { t: 19, a: "home", p: H }, { t: 21, a: "asleep", p: H }];
if (role === "priest")
  return [{ t: 0, a: "vigil", p: C }, { t: 5.5, a: "matins", p: C }, { t: 8, a: "among the parish", p: S }, { t: 11, a: "nones", p: C }, { t: 15, a: "in the churchyard", p: C }, { t: 17.5, a: "vespers", p: C }, { t: 20, a: "compline", p: C }, { t: 21.5, a: "asleep", p: H }];
if (role === "tavern")
  return [{ t: 0, a: "asleep", p: H }, { t: 8, a: "tapping ale", p: T }, { t: 12, a: "the noon trade", p: T }, { t: 18, a: "the evening rush", p: T }, { t: 23, a: "asleep", p: H }];
if (role === "guard")
  return [{ t: 0, a: "on the night wall", p: "northGate" }, { t: 3, a: "south gate", p: "southGate" }, { t: 6, a: "changing the watch", p: S }, { t: 8, a: "east gate", p: "eastGate" }, { t: 12, a: "at the well", p: E }, { t: 14, a: "west gate", p: "westGate" }, { t: 18, a: "evening circuit", p: "northGate" }, { t: 21, a: "night wall", p: "southGate" }];
if (role === "child")
  return [{ t: 0, a: "asleep", p: H }, { t: 7, a: "chores at the well", p: E }, { t: 8.5, a: "playing the square", p: S }, { t: 12, a: "bread at home", p: H }, { t: 13, a: "underfoot at market", p: S }, { t: 17, a: "called to church", p: C }, { t: 18.5, a: "home", p: H }, { t: 19.5, a: "asleep", p: H }];
if (role === "elder")
  return [{ t: 0, a: "asleep", p: H }, { t: 7.5, a: "at the well", p: E }, { t: 9, a: "on the bench", p: S }, { t: 11.5, a: "at church", p: C }, { t: 14, a: "dozing at home", p: H }, { t: 17, a: "vespers", p: C }, { t: 19, a: "a slow pint", p: T }, { t: 20.5, a: "asleep", p: H }];
if (role === "noble")
  return [{ t: 0, a: "asleep in the keep", p: "keep" }, { t: 8, a: "mass", p: C }, { t: 10, a: "hearing petitions", p: "hall" }, { t: 13, a: "riding the square", p: S }, { t: 16, a: "in the keep", p: "keep" }, { t: 18, a: "supper", p: "keep" }, { t: 22, a: "asleep in the keep", p: "keep" }];
if (role === "fisher")
  return [{ t: 0, a: "asleep", p: H }, { t: 5, a: "to the mere", p: "bridge" }, { t: 11, a: "selling the catch", p: S }, { t: 14, a: "mending nets", p: "bridge" }, { t: 18, a: "at the Stag", p: T }, { t: 20.5, a: "asleep", p: H }];
if (role === "merchant")
  return [{ t: 0, a: "asleep", p: H }, { t: 7, a: "setting the stall", p: S }, { t: 12, a: "the noon trade", p: S }, { t: 17, a: "packing away", p: S }, { t: 18.2, a: "at the Stag", p: T }, { t: 21, a: "asleep", p: H }];
return [{ t: 0, a: "asleep", p: H }, { t: 6.5, a: "day work", p: W }, { t: 12, a: "at market", p: S }, { t: 13, a: "day work", p: W }, { t: 18, a: "at the Stag", p: T }, { t: 21, a: "asleep", p: H }];
}

function slotAt(sched, hour) {
let cur = sched[0], next = sched[1] || sched[0];
for (let i = 0; i < sched.length; i++) {
  if (sched[i].t <= hour) {
    cur = sched[i];
    next = sched[(i + 1) % sched.length];
  }
}
const t0 = cur.t;
let t1 = next.t;
if (t1 <= t0) t1 += 24;
let h = hour;
if (h < t0) h += 24;
const u = Math.max(0, Math.min(1, (h - t0) / Math.max(0.01, t1 - t0)));
return { cur, next, u };
}

function posOf(key) {
const p = places[key];
if (p) return p;
const b = buildings.find((x) => x.name === key || ("home" + x.id) === key);
if (b) return b.door;
return places.square;
}

const souls = [];
const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.38, 3, 6);
const headGeo = new THREE.SphereGeometry(0.13, 8, 6);

function makeSoul(spec) {
const g = new THREE.Group();
const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: spec.color }));
body.position.y = 0.48;
body.castShadow = true;
const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xe8d2b8 }));
head.position.y = 0.86;
head.castShadow = true;
if (spec.role === "priest") {
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 6), new THREE.MeshLambertMaterial({ color: 0x1a1814 }));
  hood.position.y = 1.02;
  g.add(hood);
}
if (spec.role === "guard") {
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 6), new THREE.MeshLambertMaterial({ color: 0x888888 }));
  helm.position.y = 1.0;
  g.add(helm);
}
if (spec.role === "noble") {
  const cape = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x6a2040 }), );
  cape.position.set(0, 0.5, -0.12);
  cape.scale.set(0.32, 0.5, 0.06);
  g.add(cape);
}
g.add(body, head);
if (spec.role === "child") g.scale.setScalar(0.72);
g.userData.soul = spec;
g.traverse((o) => { if (o.isMesh) { o.userData.soul = spec; pickables.push(o); o.userData.skipXray = true; } });
scene.add(g);
spec.mesh = g;
spec.body = body;
spec.px = spec.homePos.x; spec.pz = spec.homePos.z; spec.py = 0;
spec.path = null; spec.pi = 0; spec.inside = false;
souls.push(spec);
}

function buildTown() {
makeGround();
makeRiver();

places.square = { x: 0, z: 4 };
places.well = { x: 0, z: 3.2 };
places.northGate = { x: 0, z: -44 };
places.southGate = { x: 0, z: 44 };
places.eastGate = { x: 48, z: 0 };
places.westGate = { x: -48, z: 0 };
places.bridge = { x: 6, z: 24 };
places.keep = { x: -46, z: -40 };
places.church = { x: 30, z: -8 };
places.tavern = { x: -7, z: 16 };
places.smithy = { x: 13, z: 15 };
places.mill = { x: -18, z: 30 };
places.hall = { x: -14, z: -5 };
places.bakery = { x: 9, z: -1 };

addNode(0, 4);
pave(0, 4, 0, -44);
pave(0, 4, 0, 44);
pave(0, 4, 48, 0);
pave(0, 4, -48, 0);
pave(0, 4, -46, -40);
pave(0, 4, 30, -8);
pave(0, 4, -7, 16);
pave(0, 4, 13, 15);
pave(0, -6.5, -14, -5);
pave(13, 15, 9, -1);
pave(-7, 16, -18, 30);
pave(0, 44, 6, 24);
pave(-30, 10, -20, -20);
pave(20, 18, 28, -20);
pave(-20, -20, 20, -22);

makeWell();
makeCross();
makeClockTower();
makeKeep();
makeChurch();
makeTavern();
makeSmithy();
makeMill();
makeHall();
makeBakery();
makeWalls();

const stallColors = [0x9a2f2a, 0x2f5d52, 0xb08a3e, 0x4a6a88, 0x7a3228, 0x6a4a28];
for (let i = 0; i < 12; i++) {
  const ang = (i / 12) * Math.PI * 2 + 0.2;
  const rad = 6.4;
  makeStall(Math.cos(ang) * rad, 3.5 + Math.sin(ang) * rad * 0.85, ang + Math.PI, stallColors[i % stallColors.length]);
}

const roads = [
  [0, 4, 0, -40], [0, 4, 0, 40], [0, 4, 44, 0], [0, 4, -44, 0],
  [0, 4, -44, -38], [0, 4, 28, -8], [-20, -18, 18, -20], [16, 16, 26, -16],
  [-8, 16, -22, 28], [-28, 8, -18, -18],
];
for (const [ax, az, bx, bz] of roads) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const px = -dz / len, pz = dx / len;
  for (let t = 0.12; t < 0.9; t += 0.085) {
    for (const side of [-1, 1]) {
      const x = ax + dx * t + px * side * r(3.1, 4.4);
      const z = az + dz * t + pz * side * r(3.1, 4.4);
      if (!inWalls(x, z)) continue;
      if (!free(x, z, 3.4, 3.4, 0.55)) continue;
      if (Math.hypot(x, z - 3.5) < 9) continue;
      const rot = Math.atan2(px * side, pz * side) + Math.PI;
      makeHouse(x, z, rot);
    }
  }
}

const farms = [
  [18, 58, 0.2], [-22, 62, -0.4], [40, 40, 1.1], [-55, 28, 0.6],
  [62, 22, 2.2], [-62, -18, 0.3], [58, -36, 1.4], [-28, -62, 0.1],
  [22, -60, -0.6], [70, -8, 2.8], [-70, 8, 0.5], [8, 68, 3.1],
];
for (const [x, z, rot] of farms) makeFarm(x, z, rot);

let guard = 0;
while (roofCount < 155 && guard++ < 400) {
  const ang = r(0, Math.PI * 2);
  const rad = r(14, 46);
  const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
  if (!free(x, z, 3.2, 3.2, 0.5)) continue;
  if (Math.hypot(x, z - 3.5) < 9) continue;
  makeHouse(x, z, r(0, Math.PI * 2), { lean: rnd() < 0.4 });
}
guard = 0;
while (roofCount < 155 && guard++ < 200) {
  const x = r(-80, 80), z = r(-80, 80);
  if (inWalls(x, z)) continue;
  if (!free(x, z, 2.4, 2.2, 0.4)) continue;
  makeHouse(x, z, r(0, 6), { w: 2.2, d: 2.0, h: 1.6, kind: "shed", name: "shed", lean: false, chimney: false, roof: MAT.thatch });
}

for (const p of [[8, 8], [-8, 8], [8, -2], [-10, 0], [20, 6], [-22, 6], [0, 20], [0, -18]]) makeLanternPost(p[0], p[1]);

makeTrees();

const homes = buildings.filter((b) => ["house", "farm", "tavern", "bakery", "smithy", "hall"].includes(b.kind));
const fields = Object.keys(places).filter((k) => k.startsWith("field"));
let nameI = 0;
const roster = [];
for (const role of ROLES) {
  for (let i = 0; i < role.n; i++) roster.push(role);
}
while (roster.length < 150) roster.push(ROLES[ROLES.length - 1]);
roster.length = 150;

const notables = [];
for (let i = 0; i < 150; i++) {
  const role = roster[i];
  const homeB = homes[i % homes.length];
  const homeKey = "home" + homeB.id;
  if (!places[homeKey]) places[homeKey] = homeB.door;
  let workKey = role.work;
  if (workKey === "field") workKey = homeB.field ? Object.keys(places).find((k) => places[k] === homeB.field) || fields[i % Math.max(1, fields.length)] || "square" : (fields[i % Math.max(1, fields.length)] || "square");
  const first = FIRST[nameI++ % FIRST.length];
  const last = i < 8 ? LAST[i] : LAST[i % LAST.length];
  const name = first + " " + last;
  const spec = {
    id: i, name, role: role.id, label: role.label, color: role.color,
    home: homeKey, work: workKey, homePos: homeB.door, homeB,
  };
  spec.sched = scheduleFor(role.id, spec.home, spec.work);
  if (i === 0) { spec.name = "Lady Isolde"; spec.role = "noble"; spec.label = "of the keep"; spec.home = "keep"; spec.work = "keep"; spec.color = 0x6a2040; spec.sched = scheduleFor("noble", "keep", "keep"); spec.notable = true; }
  if (i === 1) { spec.name = "Father Aldous"; spec.role = "priest"; spec.label = "vicar"; spec.home = "church"; spec.work = "church"; spec.color = 0x1a1814; spec.sched = scheduleFor("priest", "church", "church"); spec.notable = true; }
  if (i === 2) { spec.name = "Marta Miller"; spec.role = "miller"; spec.label = "of the mere"; spec.home = spec.home; spec.work = "mill"; spec.sched = scheduleFor("miller", spec.home, "mill"); spec.notable = true; }
  if (i === 3) { spec.name = "Hob Smith"; spec.role = "smith"; spec.label = "the forge"; spec.work = "smithy"; spec.sched = scheduleFor("smith", spec.home, "smithy"); spec.notable = true; }
  if (i === 4) { spec.name = "Nell of the Stag"; spec.role = "tavern"; spec.label = "ale-wife"; spec.home = "tavern"; spec.work = "tavern"; spec.sched = scheduleFor("tavern", "tavern", "tavern"); spec.notable = true; }
  if (i === 5) { spec.name = "Captain Rowe"; spec.role = "guard"; spec.label = "of the watch"; spec.work = "patrol"; spec.sched = scheduleFor("guard", spec.home, "patrol"); spec.notable = true; }
  makeSoul(spec);
  if (spec.notable) notables.push(spec);
}

const boxN = $("notables");
for (const n of notables) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = n.name + " <em>" + n.label + "</em>";
  btn.addEventListener("click", () => followSoul(n));
  boxN.appendChild(btn);
}

// sheep
for (let i = 0; i < 16; i++) {
  const f = fields[i % Math.max(1, fields.length)];
  const p = places[f] || { x: 40, z: 50 };
  const s = mesh(box, MAT.sheep, p.x + r(-3, 3), 0.28, p.z + r(-3, 3), 0.45, 0.32, 0.22);
  s.userData.wander = { x: p.x, z: p.z, t: r(0, 10) };
  scene.add(s);
  sheep.push(s);
}
}

const sheep = [];
const birds = [];
function makeBirds() {
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group();
  const w1 = mesh(box, MAT.darkStone, 0.25, 0, 0, 0.5, 0.04, 0.12);
  const w2 = mesh(box, MAT.darkStone, -0.25, 0, 0, 0.5, 0.04, 0.12);
  g.add(w1, w2);
  g.userData.wings = [w1, w2];
  g.userData.phase = r(0, 6);
  g.userData.rad = r(18, 50);
  g.userData.y = r(10, 18);
  scene.add(g);
  birds.push(g);
}
}

const smoke = [];
function makeSmoke() {
const g = new THREE.SphereGeometry(0.18, 6, 5);
const m = new THREE.MeshLambertMaterial({ color: 0xbbb6ae, transparent: true, opacity: 0.35, depthWrite: false });
for (let i = 0; i < 70; i++) {
  const s = new THREE.Mesh(g, m.clone());
  s.visible = false;
  scene.add(s);
  smoke.push({ mesh: s, life: 0, x: 0, y: 0, z: 0 });
}
}

let clockTower = null;
function afterBuild() {
clockTower = buildings.find((b) => b.kind === "tower");
makeBirds();
makeSmoke();
$("roofN").textContent = String(roofCount);
$("soulN").textContent = String(souls.length);
}

let hour = 8.5;
let playing = true;
let speed = 1;
const HOURS_PER_SEC = 0.28;
let liftAll = false;
let xrayOn = false;
let selectedB = null;
let followed = null;
let hover = null;
let muted = true;
let lastHourBell = -1;

const followRing = new THREE.Mesh(
new THREE.RingGeometry(0.35, 0.48, 20),
new THREE.MeshBasicMaterial({ color: 0xb08a3e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
);
followRing.rotation.x = -Math.PI / 2;
followRing.visible = false;
scene.add(followRing);

function phaseName(h) {
if (h < 5) return "deep night";
if (h < 6.3) return "before dawn";
if (h < 8) return "sunrise";
if (h < 11) return "morning";
if (h < 13.5) return "midday";
if (h < 16.5) return "afternoon";
if (h < 18.5) return "golden hour";
if (h < 20) return "dusk";
if (h < 22) return "lamp-light";
return "night";
}

const SKY = [
{ t: 0, sky: 0x0b1020, fog: 0x10141c, exp: 0.42, sunI: 0.02, hemi: 0.12, moonI: 0.28, amb: 0.22 },
{ t: 5, sky: 0x16142e, fog: 0x1c1830, exp: 0.5, sunI: 0.06, hemi: 0.18, moonI: 0.2, amb: 0.2 },
{ t: 6.3, sky: 0xc46a52, fog: 0xb07058, exp: 0.82, sunI: 0.55, hemi: 0.4, moonI: 0.05, amb: 0.12 },
{ t: 8, sky: 0x87b4d4, fog: 0xa8c0c8, exp: 1.05, sunI: 1.25, hemi: 0.55, moonI: 0, amb: 0.08 },
{ t: 12.5, sky: 0x7eb6e0, fog: 0xb8d0d4, exp: 1.14, sunI: 1.45, hemi: 0.62, moonI: 0, amb: 0.06 },
{ t: 17.2, sky: 0xd4895a, fog: 0xc49070, exp: 0.92, sunI: 0.7, hemi: 0.4, moonI: 0.02, amb: 0.1 },
{ t: 19.4, sky: 0x2a2040, fog: 0x241e38, exp: 0.52, sunI: 0.08, hemi: 0.16, moonI: 0.22, amb: 0.2 },
{ t: 24, sky: 0x0b1020, fog: 0x10141c, exp: 0.42, sunI: 0.02, hemi: 0.12, moonI: 0.28, amb: 0.22 },
];
function lerpHex(a, b, t) {
const A = new THREE.Color(a), B = new THREE.Color(b);
return A.lerp(B, t);
}
function skyAt(h) {
let i = 0;
while (i < SKY.length - 1 && SKY[i + 1].t < h) i++;
const A = SKY[i], B = SKY[i + 1];
const u = (h - A.t) / Math.max(0.001, B.t - A.t);
const mix = (k) => A[k] + (B[k] - A[k]) * u;
return {
  sky: lerpHex(A.sky, B.sky, u),
  fog: lerpHex(A.fog, B.fog, u),
  exp: mix("exp"), sunI: mix("sunI"), hemi: mix("hemi"), moonI: mix("moonI"), amb: mix("amb"),
};
}

function applyTime(h) {
const s = skyAt(h);
scene.background.copy(s.sky);
scene.fog.color.copy(s.fog);
renderer.toneMappingExposure = s.exp;
const ang = ((h - 6) / 12) * Math.PI;
const up = Math.sin(ang);
sun.position.set(Math.cos(ang) * 90, Math.max(up, -0.15) * 75, -35);
sun.target.position.set(0, 0, 0);
sun.intensity = Math.max(0, s.sunI * Math.max(up, 0.02));
hemi.intensity = s.hemi;
fill.intensity = s.amb;
moon.position.set(-sun.position.x * 0.6, 40, 50);
moon.intensity = s.moonI;
const night = h < 6.2 || h > 18.6 ? 1 : h < 7.2 ? 1 - (h - 6.2) : h > 17.6 ? (h - 17.6) / 1.0 : 0;
MAT.glass.emissiveIntensity = 0.15 + night * 1.4;
MAT.stainR.emissiveIntensity = 0.3 + night * 0.9;
MAT.stainB.emissiveIntensity = 0.3 + night * 0.9;
MAT.stainG.emissiveIntensity = 0.25 + night * 0.8;
MAT.hearth.emissiveIntensity = 0.5 + night * 1.4;
MAT.lantern.emissiveIntensity = 0.3 + night * 2.2;
for (const L of lanterns) L.light.intensity = L.day + (L.night - L.day) * night;
const hh = (h % 12) * 30 + (h % 1) * 30;
const mm = (h % 1) * 360;
$("hourHand").setAttribute("transform", `rotate(${hh} 50 50)`);
$("minHand").setAttribute("transform", `rotate(${mm} 50 50)`);
const H = Math.floor(h) % 24;
const M = Math.floor((h % 1) * 60);
$("digits").textContent = String(H).padStart(2, "0") + ":" + String(M).padStart(2, "0");
$("phase").textContent = phaseName(h);
$("timeRange").value = String(Math.floor(h * 60) % 1440);
if (clockTower?.hands) {
  clockTower.hands.hh.rotation.z = -((h % 12) / 12) * Math.PI * 2;
  clockTower.hands.mh.rotation.z = -((h % 1) * Math.PI * 2);
}
const mill = buildings.find((b) => b.wheel);
if (mill) mill.wheel.rotation.z = h * 3.2;
}

function setXray(on) {
xrayOn = on;
$("btnXray").classList.toggle("on", on);
for (const b of buildings) {
  b.group.traverse((o) => {
    if (!o.isMesh || o.userData.skipXray) return;
    if (!o.userData.omat) return;
    o.material = on ? o.userData.xmat : o.userData.omat;
  });
}
}

function roofTarget(b) {
if (liftAll) return 1;
if (selectedB === b) return 1;
if (followed && (followed.homeB === b || placeBuilding(followed) === b)) return 1;
return 0;
}
function placeBuilding(s) {
const { cur } = slotAt(s.sched, hour);
return buildings.find((b) => b.door === places[cur.p] || places[cur.p] === b.door || (places[cur.p] && Math.hypot(places[cur.p].x - b.x, places[cur.p].z - b.z) < 1.2)) || null;
}

function snapSoul(s, h) {
const { cur, next, u } = slotAt(s.sched, h);
const A = posOf(cur.p), B = posOf(next.p);
const travelEnd = 0.38;
let p;
if (cur.p === next.p || u < 0.04) p = A;
else if (u < travelEnd) {
  const pts = route(A.x, A.z, B.x, B.z);
  p = along(pts, (u / travelEnd));
} else p = B;
s.px = p.x + Math.sin(s.id * 2.1) * 0.35;
s.pz = p.z + Math.cos(s.id * 1.7) * 0.35;
const arrived = u >= travelEnd || cur.p === next.p;
s.inside = arrived && (cur.a.includes("asleep") || cur.a.includes("oven") || cur.a.includes("forge") || cur.a.includes("keep") || cur.a.includes("tapping") || cur.a.includes("vigil") || cur.a.includes("matins") || cur.a.includes("compline") || cur.a.includes("dozing") || cur.a.includes("rush") || cur.a.includes("trade") && cur.p === "tavern");
if (s.role === "merchant" && arrived && cur.p === "square") s.inside = false;
s.act = cur.a;
s.dest = next.p;
}

function simulateSoul(s, dtH) {
const { cur, next, u } = slotAt(s.sched, hour);
s.act = cur.a;
const destKey = u < 0.42 ? next.p : cur.p;
const dest = posOf(u < 0.42 ? next.p : cur.p);
const target = dest || places.square;
const dx = target.x - s.px, dz = target.z - s.pz;
const dist = Math.hypot(dx, dz);
if (dist < 0.55) {
  s.inside = cur.a.includes("asleep") || cur.a.includes("oven") || cur.a.includes("forge") || cur.a.includes("keep") || cur.a.includes("vigil") || cur.a.includes("matins") || cur.a.includes("compline") || cur.a.includes("tapping") || cur.a.includes("rush") || (cur.p !== "square" && cur.p !== "well" && cur.p !== "bridge" && (cur.a.includes("work") || cur.a.includes("mill") || cur.a.includes("fields") === false && cur.p !== "square"));
  if (cur.p === "square" || cur.p === "well" || cur.p === "bridge" || (cur.p || "").startsWith("field") || (cur.p || "").includes("Gate")) s.inside = false;
  if (cur.a.includes("fields") || cur.a.includes("playing") || cur.a.includes("market") || cur.a.includes("circuit") || cur.a.includes("gate") || cur.a.includes("wall") || cur.a.includes("bench") || cur.a.includes("parish") || cur.a.includes("petitions") === false && cur.a.includes("riding")) {
    if (cur.a.includes("fields") || cur.a.includes("playing") || cur.a.includes("market") || cur.a.includes("circuit") || cur.a.includes("riding") || cur.a.includes("bench") || cur.a.includes("among")) s.inside = false;
  }
  s.path = null;
  s.px += Math.sin(hour * 8 + s.id) * 0.002;
  return;
}
s.inside = false;
if (!s.path || s.pathDest !== destKey) {
  s.path = route(s.px, s.pz, target.x, target.z);
  s.pi = 0;
  s.pathDest = destKey;
}
const step = 62 * dtH;
let left = step;
while (left > 0 && s.path && s.pi < s.path.length) {
  const n = s.path[s.pi];
  const ddx = n.x - s.px, ddz = n.z - s.pz;
  const dd = Math.hypot(ddx, ddz);
  if (dd < 0.12) { s.pi++; continue; }
  const m = Math.min(left, dd);
  s.px += (ddx / dd) * m;
  s.pz += (ddz / dd) * m;
  s.mesh.rotation.y = Math.atan2(ddx, ddz);
  left -= m;
  if (m === dd) s.pi++;
}
}

function visibleSoul(s) {
if (!s.inside) return true;
if (xrayOn || liftAll) return true;
if (followed === s) return true;
if (selectedB && (s.homeB === selectedB || placeBuilding(s) === selectedB)) return true;
return false;
}

function followSoul(s) {
followed = s;
selectedB = s.homeB || selectedB;
$("btnFree").hidden = false;
renderSoulCard(s);
}

function renderSoulCard(s) {
const card = $("soulCard");
if (!s) { card.hidden = true; return; }
card.hidden = false;
$("soulName").textContent = s.name;
$("soulJob").textContent = s.label;
$("soulNow").textContent = s.act || "walking";
const ol = $("soulItin");
ol.innerHTML = "";
const { cur } = slotAt(s.sched, hour);
for (const e of s.sched) {
  const li = document.createElement("li");
  if (e === cur) li.className = "on";
  const hh = Math.floor(e.t);
  const mm = Math.round((e.t % 1) * 60);
  li.innerHTML = `<span class="hh">${String(hh).padStart(2, "0")}</span><span>${e.a}</span>`;
  ol.appendChild(li);
}
}

function selectBuilding(b) {
selectedB = b;
if (b) {
  const who = souls.filter((s) => s.homeB === b).slice(0, 3).map((s) => s.name).join(", ");
  $("soulCard").hidden = false;
  $("soulName").textContent = b.name;
  $("soulJob").textContent = b.kind;
  $("soulNow").textContent = who ? "household · " + who : "empty at this hour";
  const ol = $("soulItin");
  ol.innerHTML = "";
  const li = document.createElement("li");
  li.innerHTML = `<span class="hh">·</span><span>click a soul to follow their day</span>`;
  ol.appendChild(li);
}
}

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let down = null;

canvas.addEventListener("pointerdown", (e) => {
down = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
if (!down) return;
const dx = e.clientX - down.x, dy = e.clientY - down.y;
down = null;
if (dx * dx + dy * dy > 25) return;
ptr.x = (e.clientX / innerWidth) * 2 - 1;
ptr.y = -(e.clientY / innerHeight) * 2 + 1;
ray.setFromCamera(ptr, camera);
const hits = ray.intersectObjects(pickables, false);
for (const h of hits) {
  if (h.object.userData.soul) { followSoul(h.object.userData.soul); return; }
  if (h.object.userData.building) { selectBuilding(h.object.userData.building); return; }
}
});
canvas.addEventListener("pointermove", (e) => {
ptr.x = (e.clientX / innerWidth) * 2 - 1;
ptr.y = -(e.clientY / innerHeight) * 2 + 1;
ray.setFromCamera(ptr, camera);
const hits = ray.intersectObjects(pickables, false);
hover = null;
for (const h of hits) {
  if (h.object.userData.soul) { hover = h.object.userData.soul; break; }
  if (h.object.userData.building) { hover = h.object.userData.building; break; }
}
const tag = $("hovername");
if (hover) {
  tag.textContent = hover.name;
  tag.style.left = e.clientX + "px";
  tag.style.top = e.clientY + "px";
  tag.classList.add("show");
} else tag.classList.remove("show");
});

$("timeRange").addEventListener("input", (e) => {
hour = (+e.target.value) / 60;
for (const s of souls) snapSoul(s, hour);
});
$("btnPause").addEventListener("click", () => {
playing = !playing;
$("btnPause").classList.toggle("on", !playing);
$("btnPause").textContent = playing ? "halt" : "go";
});
document.querySelectorAll("[data-spd]").forEach((btn) => {
btn.addEventListener("click", () => {
  speed = +btn.dataset.spd;
  document.querySelectorAll("[data-spd]").forEach((b) => b.classList.remove("on"));
  btn.classList.add("on");
  playing = true;
  $("btnPause").classList.remove("on");
  $("btnPause").textContent = "halt";
});
});
$("btnRoofs").addEventListener("click", () => {
liftAll = !liftAll;
$("btnRoofs").classList.toggle("on", liftAll);
});
$("btnXray").addEventListener("click", () => setXray(!xrayOn));
$("btnFree").addEventListener("click", () => {
followed = null;
$("btnFree").hidden = true;
if (!selectedB) $("soulCard").hidden = true;
});
$("btnMute").addEventListener("click", () => {
muted = !muted;
$("btnMute").classList.toggle("on", !muted);
$("btnMute").textContent = muted ? "quiet" : "sound";
if (!muted) startAudio();
});

addEventListener("keydown", (e) => {
if (e.code === "Space") { e.preventDefault(); $("btnPause").click(); }
if (e.key === "x" || e.key === "X") $("btnXray").click();
if (e.key === "r" || e.key === "R") $("btnRoofs").click();
if (e.key === "Escape") { followed = null; selectedB = null; $("btnFree").hidden = true; $("soulCard").hidden = true; }
});

let audioCtx = null, gain = null, birdTimer = 0;
function startAudio() {
if (audioCtx) return;
audioCtx = new (window.AudioContext || window.webkitAudioContext)();
gain = audioCtx.createGain();
gain.gain.value = 0.04;
gain.connect(audioCtx.destination);
const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
const d = buf.getChannelData(0);
for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
const n = audioCtx.createBufferSource();
n.buffer = buf; n.loop = true;
const f = audioCtx.createBiquadFilter();
f.type = "lowpass"; f.frequency.value = 400;
n.connect(f); f.connect(gain); n.start();
}
function chime() {
if (muted || !audioCtx) return;
const o = audioCtx.createOscillator();
const g = audioCtx.createGain();
o.type = "sine"; o.frequency.value = 440;
g.gain.setValueAtTime(0.08, audioCtx.currentTime);
g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);
o.connect(g); g.connect(audioCtx.destination);
o.start(); o.stop(audioCtx.currentTime + 1.5);
}

addEventListener("resize", () => {
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let smokeI = 0;

function tickSmoke(dt) {
const night = hour < 6 || hour > 19;
const rate = night ? 18 : 10;
smokeI += dt * rate;
while (smokeI > 1) {
  smokeI--;
  const ch = chimneys[ri(0, chimneys.length - 1)];
  if (!ch) break;
  const p = smoke.find((s) => s.life <= 0) || smoke[0];
  ch.parent.localToWorld(ch.wp.set(ch.x, ch.y, ch.z));
  p.x = ch.wp.x; p.y = ch.wp.y; p.z = ch.wp.z;
  p.life = 1;
  p.mesh.visible = true;
  p.mesh.position.copy(ch.wp);
}
for (const p of smoke) {
  if (p.life <= 0) { p.mesh.visible = false; continue; }
  p.life -= dt * 0.35;
  p.y += dt * 1.1;
  p.x += dt * 0.25;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.scale.setScalar(1 + (1 - p.life) * 1.8);
  p.mesh.material.opacity = Math.max(0, p.life * 0.28);
}
}

buildTown();
afterBuild();
for (const s of souls) snapSoul(s, hour);
applyTime(hour);
$("boot").classList.add("gone");
setTimeout(() => $("boot").remove(), 800);

function frame() {
requestAnimationFrame(frame);
const dt = Math.min(0.05, clock.getDelta());
const dtH = playing ? dt * HOURS_PER_SEC * speed : 0;
if (dtH) {
  hour = (hour + dtH) % 24;
  if (Math.abs(dtH) > 0.12) for (const s of souls) snapSoul(s, hour);
  else for (const s of souls) simulateSoul(s, dtH);
}
applyTime(hour);

let abroad = 0;
const t = clock.elapsedTime;
for (const s of souls) {
  const show = visibleSoul(s);
  s.mesh.visible = show;
  s.mesh.position.set(s.px, s.py, s.pz);
  if (show && !s.inside) {
    abroad++;
    if (!reduceMotion) s.mesh.position.y = Math.abs(Math.sin(t * 8 + s.id)) * 0.06;
  }
  if (s.inside && s.act && s.act.includes("asleep")) {
    s.mesh.rotation.x = 1.15;
    s.mesh.position.y = 0.28;
  } else s.mesh.rotation.x = 0;
}
$("outN").textContent = String(abroad);
if (followed) {
  renderSoulCard(followed);
  followRing.visible = true;
  followRing.position.set(followed.px, 0.08, followed.pz);
  followRing.rotation.z = t * 0.8;
  const want = new THREE.Vector3(followed.px + 11, 14, followed.pz + 11);
  camera.position.lerp(want, 1 - Math.pow(0.001, dt));
  controls.target.lerp(new THREE.Vector3(followed.px, 0.8, followed.pz), 1 - Math.pow(0.001, dt));
} else followRing.visible = false;

for (const b of buildings) {
  const want = roofTarget(b);
  b.lift = (b.lift ?? 0) + (want - (b.lift ?? 0)) * (1 - Math.pow(0.0008, dt));
  for (const rf of b.roofs) {
    rf.position.y = (rf.userData.baseY ?? rf.position.y) + b.lift * 3.4;
    rf.rotation.z = b.lift * 0.18;
  }
}

if (!reduceMotion) {
  scene.traverse((o) => {
    if (o.userData.flag) o.rotation.z = Math.sin(t * 2.2) * 0.25;
  });
}
for (const sh of sheep) {
  const w = sh.userData.wander;
  w.t += dt;
  sh.position.x = w.x + Math.sin(w.t * 0.3 + sh.id) * 2.2;
  sh.position.z = w.z + Math.cos(w.t * 0.25) * 1.8;
}
const day = hour > 6.2 && hour < 19.5;
for (let i = 0; i < birds.length; i++) {
  const b = birds[i];
  b.visible = day;
  if (!day) continue;
  const a = t * 0.25 + b.userData.phase;
  b.position.set(Math.cos(a) * b.userData.rad, b.userData.y + Math.sin(a * 3) * 0.4, Math.sin(a) * b.userData.rad * 0.8);
  b.rotation.y = -a + Math.PI / 2;
  const flap = Math.sin(t * 10 + i) * 0.45;
  b.userData.wings[0].rotation.z = flap;
  b.userData.wings[1].rotation.z = -flap;
}
tickSmoke(dt);

const ih = Math.floor(hour);
if (ih !== lastHourBell && (ih === 8 || ih === 12 || ih === 18)) { lastHourBell = ih; chime(); }

controls.update();
renderer.render(scene, camera);
}

window.__TOWN__ = {
hour: () => hour, roofs: () => roofCount, souls: () => souls.length,
renderer, buildings, souls, places,
info: () => renderer.info,
};
frame();
