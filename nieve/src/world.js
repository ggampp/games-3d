// Cidade: Avenida Corrientes fictícia sob a neve, colisores, pickups, neve, meteoro
import * as THREE from 'three';
import { PLAZA } from './state.js';

// ---------- RNG determinístico ----------
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- Texturas procedurais ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const snowTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#cfd9de'; g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 26000; i++) { const v = 170 + r() * 60; g.fillStyle = `rgba(${v},${v + 8},${v + 14},${0.3 + r() * 0.5})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,110,120,${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
}, [40, 40]);

const facadeTex = (seed, tint) => canvasTex(512, 1024, (g, w, h) => {
  const r = rng(seed);
  g.fillStyle = tint; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = r() * 40; g.fillStyle = `rgba(${v},${v},${v},${r() * 0.35})`; g.fillRect(r() * w, r() * h, 2, 2); }
  // janelas: 4 colunas x 8 andares
  const cols = 4, rows = 8, cw = w / cols, rh = h / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = x * cw + cw * 0.22, py = y * rh + rh * 0.2, ww = cw * 0.56, wh = rh * 0.55;
    const lit = r() < 0.06;
    g.fillStyle = lit ? `rgba(${200 + r() * 40},${150 + r() * 40},${80},1)` : `rgba(${8 + r() * 12},${14 + r() * 12},${20 + r() * 14},1)`;
    g.fillRect(px, py, ww, wh);
    g.fillStyle = 'rgba(210,222,228,0.9)'; g.fillRect(px - 3, py - 4, ww + 6, 5); // parapeito com neve
    if (r() < 0.25) { g.strokeStyle = 'rgba(180,190,195,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + r() * ww, py); g.lineTo(px + r() * ww, py + wh); g.stroke(); } // vidro rachado
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(px, py, ww, wh);
  }
  // térreo: vitrine / persiana
  g.fillStyle = '#1a2229'; g.fillRect(0, h - rh, w, rh);
  for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#222d35' : '#1a232a'; g.fillRect(0, h - rh + i * (rh / 18), w, rh / 18); }
}, [1, 1]);

export function signTex(text, small, bg, fg) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.globalAlpha = 0.3; g.lineWidth = 2; g.strokeRect(12, 12, w - 24, h - 24); g.globalAlpha = 1;
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 76px "Saira Extra Condensed","Arial Narrow",Arial,sans-serif';
    g.fillText(text, w / 2, small ? 110 : 132, 960);
    if (small) { g.font = '24px "Share Tech Mono",monospace'; g.fillText(small, w / 2, 200, 940); }
    const r = rng(text.length * 31);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(5,13,17,${r() * 0.4})`; g.fillRect(r() * w, r() * h, r() * 16 + 1, r() * 4 + 1); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(215,226,230,0.85)'; g.fillRect(r() * w, 0, 40 + r() * 120, 6 + r() * 8); } // neve no topo
  });
}

// ---------- Colisores ----------
export const colliders = []; // {x,z,hw,hd,h}
export function addBox(x, z, w, d, h, angle = 0) {
  if (angle) { const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle)); const nw = w * c + d * s, nd = w * s + d * c; w = nw; d = nd; }
  colliders.push({ x, z, hw: w / 2, hd: d / 2, h });
}
export function blocked(x, z, r) {
  for (const c of colliders) if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true;
  return false;
}
export function resolveCircle(p, r) {
  for (let it = 0; it < 3; it++) {
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const ox = c.hw + r - Math.abs(dx), oz = c.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; }
    }
  }
}
export function lineOfSight(x1, z1, x2, z2) {
  for (const c of colliders) {
    // slab test do segmento contra AABB
    let t0 = 0, t1 = 1; const dx = x2 - x1, dz = z2 - z1;
    const axes = [[x1, dx, c.x - c.hw, c.x + c.hw], [z1, dz, c.z - c.hd, c.z + c.hd]];
    let hit = true;
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) { hit = false; break; } continue; }
      let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { hit = false; break; }
    }
    if (hit) return false;
  }
  return true;
}

// ---------- Dados do nível ----------
export const pickups = [
  { x: -10.3, z: 84, kind: 'ammo' }, { x: 11.5, z: 77, kind: 'health' }, { x: 11.8, z: 6, kind: 'ammo' },
  { x: -11.3, z: 2, kind: 'health' }, { x: 33, z: 43, kind: 'ammo' }, { x: -33, z: -32, kind: 'health' },
  { x: -11, z: -84, kind: 'ammo' }, { x: 11.5, z: -95, kind: 'health' }, { x: 24, z: -155, kind: 'ammo' }, { x: -26, z: -163, kind: 'health' },
];
// entradas de horda (bocas de rua transversal / galerias)
export const entrances = [
  { x: -43, z: 49 }, { x: 43, z: 49 }, { x: -43, z: -29 }, { x: 43, z: -29 }, { x: -12, z: 108 }, { x: 12, z: 108 },
  { x: -43, z: 10 }, { x: 43, z: 10 }, { x: -43, z: -68 }, { x: 43, z: -68 }, { x: -43, z: -107 }, { x: 43, z: -107 },
];
export const plazaEntrances = [{ x: -27, z: -142 }, { x: 27, z: -142 }, { x: -30, z: -168 }, { x: 30, z: -168 }, { x: 0, z: -185 }];
const crossStreets = [88, 49, 10, -29, -68, -107];

// ---------- Construção ----------
export function buildWorld(scene) {
  const r = rng(2026);
  const world = new THREE.Group(); scene.add(world);

  // chão de neve
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: snowTex(), roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);

  // calçadas (levemente elevadas)
  const curbMat = new THREE.MeshStandardMaterial({ color: '#b9c6cc', roughness: 1 });
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 320), curbMat);
    curb.position.set(side * 12.6, 0.09, -35); curb.receiveShadow = true; world.add(curb);
  }

  // prédios ao longo da avenida
  const facades = [facadeTex(11, '#4a5058'), facadeTex(23, '#5a5248'), facadeTex(37, '#434b53'), facadeTex(41, '#6a6158')];
  const roofMat = new THREE.MeshStandardMaterial({ color: '#c8d3d8', roughness: 1 });
  function building(x, z, w, d, h, texIdx) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const tex = facades[texIdx].clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 24)));
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const m = new THREE.Mesh(geo, [mat, mat, roofMat, roofMat, mat, mat]);
    m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; world.add(m);
    addBox(x, z, w, d, h);
  }
  const blocks = [[110, 88], [88, 49], [49, 10], [10, -29], [-29, -68], [-68, -107], [-107, -146]];
  for (const [z0, z1] of blocks) {
    for (const side of [-1, 1]) {
      let z = z0 - 5; const zEnd = z1 + 5;
      while (z - zEnd > 6) {
        const d = Math.min(z - zEnd, 8 + r() * 10);
        const w = 14 + r() * 10, h = 12 + r() * 22;
        building(side * (14.4 + w / 2), z - d / 2, w, d, h, Math.floor(r() * facades.length));
        z -= d;
      }
      // segunda fileira (skyline)
      const h2 = 20 + r() * 30;
      building(side * (14.4 + 24 + 12), (z0 + z1) / 2, 22, z0 - z1 - 10, h2, Math.floor(r() * facades.length));
    }
  }
  // prédios que fecham as ruas transversais ao fundo
  for (const z of crossStreets) for (const side of [-1, 1]) building(side * 70, z, 30, 9, 18 + r() * 14, Math.floor(r() * 4));
  // ao redor da praça
  for (const [x, z] of [[-48, -150], [48, -150], [-48, -178], [48, -178]]) building(x, z, 26, 26, 28 + r() * 20, Math.floor(r() * 4));
  building(0, -205, 60, 20, 26, 1);

  // Obelisco (Plaza de la República)
  const obMat = new THREE.MeshStandardMaterial({ color: '#d9dfe2', roughness: 0.9 });
  const ob = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.3, 60, 4, 1), obMat);
  ob.position.set(PLAZA.x, 30, PLAZA.z); ob.rotation.y = Math.PI / 4; ob.castShadow = true; world.add(ob);
  const obBase = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 7), obMat); obBase.position.set(PLAZA.x, 0.6, PLAZA.z); world.add(obBase);
  addBox(PLAZA.x, PLAZA.z, 6.4, 6.4, 60);

  // vitrines / letreiros (posições na fachada: x = ±14.31, virados para a rua)
  const signs = [
    ['GRAN REX', 'TEATRO · FUNCIONES SUSPENDIDAS', 74, 1, '#6e2a24', '#e9d6b8'], ['CAFÉ PAULÍN', 'CONFITERÍA', 66, -1, '#3e4a46', '#e2d9c3'],
    ['KIOSCO 24 HS', 'DIARIOS Y REVISTAS', 40, 1, '#4b5d3f', '#dfe6c8'], ['ÓPERA', 'A LA REPÚBLICA · 1936', 30, -1, '#5a3d2c', '#efe2c9'],
    ['FARMACIA', 'CARLOS PELLEGRINI', 4, 1, '#2f5f4d', '#dff0e6'], ['LIBRERÍA CORRIENTES', 'LIBROS USADOS', -8, -1, '#4d4335', '#e8dcc2'],
    ['LAS CUARTETAS', 'PIZZERÍA · BAR', -36, 1, '#6d3a2a', '#f0dcc4'], ['SUBTE · B', 'CARLOS PELLEGRINI', -60, -1, '#2d3f57', '#d6e2f0'],
    ['GALERÍA CORRIENTES', 'SE VENDE · INMOBILIARIA 4326-0100', -90, 1, '#4a4c50', '#dde1e5'], ['ÓPTICA CORRIENTES', 'ESMERALDA', -112, -1, '#3b4b5b', '#dbe4ea'],
    ['HOTEL REPÚBLICA', 'SUIPACHA · ENTRADA POR SUIPACHA', -128, 1, '#5a4b3a', '#efe4d0'],
  ];
  for (const [t, s, z, side, bg, fg] of signs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: signTex(t, s, bg, fg), emissive: new THREE.Color(fg), emissiveMap: signTex(t, s, bg, fg), emissiveIntensity: 0.12, roughness: 0.8 }));
    m.position.set(side * 14.3, 3.3, z); m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; world.add(m);
  }
  // avisos de emergência
  const warn = (t, s, x, y, z, ry, bg, fg, w = 2.8, h = 1.4) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTex(t, s, bg, fg), roughness: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = ry; world.add(m); return m;
  };
  warn('NO SALGAN', 'LA NIEVE MATA', -14.29, 1.6, 86, Math.PI / 2, '#8a8a78', '#342e2a');
  warn('EVACUACIÓN', 'PLAZA DE LA REPÚBLICA  →', 10.6, 1.9, -57, 0, '#786c4e', '#272f2d', 3.1, 1.1);
  addBox(10.6, -57.15, 3.2, 0.3, 2.5);

  // carros abandonados
  const carBody = new THREE.BoxGeometry(1.9, 0.75, 4.4), carTop = new THREE.BoxGeometry(1.7, 0.6, 2.2);
  const carCols = ['#4d5a63', '#6b3f3a', '#3d4b3e', '#5c5c5c', '#7a6a4c', '#2f3a52'];
  const snowCap = new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 1 });
  const carPositions = [];
  for (let i = 0; i < 26; i++) {
    const z = 100 - i * 9.5 - r() * 4, lane = (r() < 0.5 ? -1 : 1) * (2.5 + r() * 6), angle = (r() - 0.5) * 0.6 + (r() < 0.12 ? Math.PI / 2 : 0);
    if (Math.abs(z - PLAZA.z) < 30) continue;
    carPositions.push([lane, z, angle]);
  }
  carPositions.push([-6, 62, 0.35], [8, -80, 2.1]);
  for (const [x, z, angle] of carPositions) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: carCols[Math.floor(r() * carCols.length)], roughness: 0.7, metalness: 0.3 });
    const b = new THREE.Mesh(carBody, mat); b.position.y = 0.55; b.castShadow = true; g.add(b);
    const t = new THREE.Mesh(carTop, new THREE.MeshStandardMaterial({ color: '#1a2126', roughness: 0.4, metalness: 0.2 })); t.position.set(0, 1.2, -0.2); g.add(t);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, 2.25), snowCap); cap.position.set(0, 1.58, -0.2); g.add(cap);
    const cap2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.1), snowCap); cap2.position.set(0, 1.0, 1.65); g.add(cap2);
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12), new THREE.MeshStandardMaterial({ color: '#111', roughness: 1 }));
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.34, wz); g.add(w);
    }
    g.position.set(x, 0, z); g.rotation.y = angle; world.add(g);
    addBox(x, z, 1.95, 4.55, 1.5, angle);
  }
  // ônibus Línea 59 atravessado
  const bus = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.0, 10.5), new THREE.MeshStandardMaterial({ color: '#8a2f2a', roughness: 0.7, metalness: 0.2 }));
  bb.position.y = 1.9; bb.castShadow = true; bus.add(bb);
  const bw = new THREE.Mesh(new THREE.BoxGeometry(2.74, 1.0, 9.8), new THREE.MeshStandardMaterial({ color: '#151c21', roughness: 0.4 })); bw.position.y = 2.3; bus.add(bw);
  const bcap = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 10.6), snowCap); bcap.position.y = 3.5; bus.add(bcap);
  const bsign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: signTex('LÍNEA 59', 'BUENOS AIRES · TANGO', '#1f2a33', '#f0d98a'), emissive: '#f0d98a', emissiveIntensity: 0.15 }));
  bsign.position.set(0, 2.95, 5.26); bus.add(bsign);
  bus.position.set(2, 0, -20); bus.rotation.y = 1.1; world.add(bus);
  addBox(2, -20, 2.7, 10.5, 3.5, 1.1);

  // postes de luz (poucos, alguns piscando)
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a4249', roughness: 0.8, metalness: 0.5 });
  const lamps = [];
  for (let i = 0; i < 7; i++) {
    const z = 80 - i * 40, side = i % 2 ? -1 : 1;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), poleMat); p.position.set(side * 12, 3.5, z); world.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2.2), poleMat); arm.position.set(side * 12, 6.9, z); arm.rotation.y = Math.PI / 2; arm.position.x -= side * 1; world.add(arm);
    const works = r() < 0.5;
    if (works) {
      const l = new THREE.PointLight('#ffd9a0', 14, 26, 2); l.position.set(side * 10, 6.7, z); world.add(l);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffe5b8' })); bulb.position.copy(l.position); world.add(bulb);
      lamps.push({ light: l, bulb, base: 14, phase: r() * 10, flicker: r() < 0.6 });
    }
    addBox(side * 12, z, 0.35, 0.35, 7);
  }

  // Meteoro no céu + brilho
  const meteor = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 24), new THREE.MeshBasicMaterial({ color: '#ff5a3a', fog: false }));
  meteor.position.set(60, 95, -420); world.add(meteor);
  const glowTex = canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(255,120,80,0.9)'); gr.addColorStop(0.4, 'rgba(255,60,30,0.35)'); gr.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(160, 160, 1); glow.position.copy(meteor.position); world.add(glow);

  // Pickups (caixas com etiqueta)
  const pickupMeshes = pickups.map((p, i) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: p.kind === 'ammo' ? '#5b6550' : '#c1c1a9', roughness: 0.9 }));
    box.castShadow = true; g.add(box);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.27), new THREE.MeshStandardMaterial({ map: signTex(p.kind === 'ammo' ? '12 GA' : '+', p.kind === 'ammo' ? 'CARTUCHOS' : 'BOTIQUÍN', p.kind === 'ammo' ? '#4a5341' : '#b0b8a6', p.kind === 'ammo' ? '#c4c8a9' : '#83362b'), emissive: '#ffffff', emissiveIntensity: 0.12 }));
    label.position.set(0, 0.03, 0.231); g.add(label);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: '#aabdc5', roughness: 1 })); lid.position.y = 0.25; g.add(lid);
    g.position.set(p.x, 0.25, p.z); g.rotation.y = i * 0.7; world.add(g);
    return g;
  });

  // Neve caindo (Points)
  const N = 6000, pos = new Float32Array(N * 3), vel = new Float32Array(N);
  const sr = rng(99);
  for (let i = 0; i < N; i++) { pos[i * 3] = (sr() - 0.5) * 80; pos[i * 3 + 1] = sr() * 30; pos[i * 3 + 2] = (sr() - 0.5) * 80; vel[i] = 1.2 + sr() * 1.6; }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakeTex = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: flakeTex, transparent: true, depthWrite: false, opacity: 0.85, color: '#dfe9ee' }));
  snow.frustumCulled = false; world.add(snow);

  return {
    group: world, meteor, glow, lamps, pickupMeshes,
    update(dt, t, center) {
      // neve: cai e é envolvida ao redor do jogador, com vento lateral
      const a = snowGeo.attributes.position.array;
      const wind = Math.sin(t * 0.3) * 0.8 + 1.1;
      for (let i = 0; i < N; i++) {
        let y = a[i * 3 + 1] - vel[i] * dt; let x = a[i * 3] + wind * dt + Math.sin(t * 2 + i) * dt * 0.4; let z = a[i * 3 + 2] + dt * 0.3;
        if (y < 0) { y += 30; x = center.x + (sr() - 0.5) * 80; z = center.z + (sr() - 0.5) * 80; }
        if (x - center.x > 40) x -= 80; if (x - center.x < -40) x += 80;
        if (z - center.z > 40) z -= 80; if (z - center.z < -40) z += 80;
        a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
      }
      snowGeo.attributes.position.needsUpdate = true;
      for (const l of lamps) {
        const f = l.flicker ? (Math.sin(t * 17 + l.phase) > 0.85 ? 0.15 : 1) * (0.85 + 0.15 * Math.sin(t * 5.3 + l.phase)) : 1;
        l.light.intensity = l.base * f; l.bulb.visible = f > 0.3;
      }
      const pulse = 0.85 + 0.15 * Math.sin(t * 0.7);
      glow.material.opacity = pulse; glow.scale.setScalar(150 + 20 * Math.sin(t * 0.5));
    },
  };
}
