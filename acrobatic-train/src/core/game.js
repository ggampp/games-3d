/**
 * Acrobatic Train 3D - High-Octane Engine & Gameplay Coordinator
 * Features:
 * - Three.js WebGL with PBR & Volumetric Lighting
 * - Dynamic Physical Spark Particles on Rails & Drift
 * - Overhead Electrical Catenaries & Realistic Ballast
 * - Interactive Railroad Switch Tracks (Chaves de Desvio)
 * - Selectable Train Skins (Cyber, Crimson, Midnight)
 * - Continuous Drift Combo Multiplier (x1 to x4)
 * - Cinematic Bullet-Time Stunt Camera
 * - TypeSafe Jev AI Stunt Judge & Telemetry Analyzer
 */

import { sound } from './audio.js';
import { KeyboardController } from './keyboard.js';
import { HudManager } from '../ui/hud.js';

(() => {
  'use strict';

  // ---------- CONSTANTS & GEOMETRY SPECS ----------
  const TRACK_BEHIND = 60;
  const TRACK_AHEAD = 700;
  const TIE_BACK = 30;
  const TIE_FRONT = 150;
  const STRAIGHT_TIME = [4, 6.5];
  const CURVE_R_MIN = 45, CURVE_R_MAX = 110;
  const CURVE_DEG_MIN = 20, CURVE_DEG_MAX = 60;
  const GAUGE = 1.0;
  const TRACK_SPACING = 3.4;
  const TRACKS = [-TRACK_SPACING, 0, TRACK_SPACING];
  const SLEEPER_STEP = 0.5;
  const BALLAST_H = 0.18;
  const BALLAST_U = 1.5;
  const RAIL_BASE = 0.23;
  const RAIL_H = 0.14;
  const RAIL_TOP = RAIL_BASE + RAIL_H;

  // Speeds & Acceleration
  const SPEED_START = 28;
  const SPEED_MAX = 80;
  const SPEED_ACCEL = 0.35;
  const BLUR_N = 5;
  const BLUR_A = 1 - Math.pow(0.05, 1 / BLUR_N);

  // Train Carriage Geometry
  const DIAG_GAP = 3.4;
  const OVERHANG = 0.9;
  const BOGIE = Math.hypot(DIAG_GAP, TRACK_SPACING * 2) / 2;
  const CAR_LEN = (BOGIE + OVERHANG) * 2;
  const CAR_W = 1.7;
  const SIDE_H = 1.75;
  const AXLE = 0.5;
  const WHEEL_R = 0.3;
  const WC = RAIL_TOP + WHEEL_R;
  const BODY_Y = WC + 0.39;
  const W2 = CAR_W / 2;
  const ROOF_Y = BODY_Y + SIDE_H + 0.34;
  const DOOR_PITCH = CAR_LEN / 4;
  const DOORS = [-1.5, -0.5, 0.5, 1.5].map((k) => k * DOOR_PITCH);
  const AC_X = [-BOGIE + 0.6, -0.3];

  // Camera Specs
  const CAM_TARGET = [4, 0.8, 0];
  const CAM_OFFSET = [-13, 4.2, 3.0];
  const CAM_JUMP_FOLLOW = 0.75;

  // Movement & Acrobatics
  const CROSS_TIME = 0.28;
  const HOP = 0.9;
  const AIR_MAX = 0.5;
  const AIR_FADE = 0.15;
  const ease = (t) => t * t * (3 - 2 * t);
  const easeD = (t) => 6 * t * (1 - t);

  // Jump Ramps & Stunt Lines
  const RAMP_LEN = 7;
  const RAMP_H = 1.0;
  const RAMP_W = GAUGE + 0.7;
  const RAMP_HIT = 0.7;
  const RAMP_END_MARGIN = 15;
  const LINE_AIR1 = 4;
  const LINE_AIR2 = LINE_AIR1 * 2;
  const JUMP_G = 56;
  const JUMP_PITCH = 0.25;
  const SPIN_PIVOT_Y = 1.6;
  const JUMP_LAND = 1.5;

  // Hazards & Points
  const GAP_MIN = 10, GAP_MAX = 20;
  const RAMP_GAP_RATE = 0.6;
  const RAMP_GAP_MIN = 6, RAMP_GAP_MAX = 11;
  const SAFE_LIFT = 0.15;
  const POLE_H = 3.2;
  const POLE_R = 0.16;
  const POLE_STEP = 3.5;
  const POLE_MIN_N = 3;
  const ITEM_POINTS = [10, 30, 50];
  const ITEM_Y = 1.6;
  const ITEM_R = 0.45;
  const ITEM_ROW = 5, ITEM_STEP = 3;
  const DIAG_MIN = TRACK_SPACING * 0.5;
  const DIAG_POINTS = 20;
  const SAFE_START = 80;

  // Suspension Springs
  const SAG_K = 170, SAG_C = 11, SAG_HIT = 2.4;
  const ROLL_K = 120, ROLL_C = 7, ROLL_HIT = 0.9;
  const SHAKE_HIT = 0.35, SHAKE_DECAY = 9;

  // Crash Rigid Body
  const CRASH_FLOOR = BALLAST_H;
  const CRASH_G = 22;
  const CRASH_BOUNCE = 0.15;
  const CRASH_FRICTION = 0.55;
  const COM_Y = 1.6;

  // Vectors
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);
  const SPIN_AXIS = V(1, 0, 0);
  const FLIP_AXIS = V(0, 0, 1);
  const FLIP_TURNS = 1;
  const FLIP_DIR = 1;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- TRAIN SKINS PALETTE ----------
  const SKINS = {
    cyber: {
      name: 'Cyber Shinkansen',
      accentColor: '#00f2fe',
      bodyColor: 0xdfe6ed,
      bodyMetal: 0.8,
      bodyRough: 0.2,
      bandColor: 0x00f2fe,
      bandEmissive: 0x00f2fe,
      lightColor: 0x00f2fe,
      lightIntensity: 1.8,
    },
    crimson: {
      name: 'Crimson Bullet',
      accentColor: '#ef476f',
      bodyColor: 0x8a1c2e,
      bodyMetal: 0.6,
      bodyRough: 0.3,
      bandColor: 0xffd166,
      bandEmissive: 0xffd166,
      lightColor: 0xffea00,
      lightIntensity: 2.0,
    },
    midnight: {
      name: 'Midnight Gold',
      accentColor: '#ffd166',
      bodyColor: 0x121418,
      bodyMetal: 0.9,
      bodyRough: 0.15,
      bandColor: 0xffd166,
      bandEmissive: 0xffd166,
      lightColor: 0xffd166,
      lightIntensity: 2.2,
    }
  };
  const skinKeys = Object.keys(SKINS);
  let currentSkinIdx = 0;

  // ---------- GAME STATE & HUD ----------
  const hud = new HudManager();
  let speed = SPEED_START;
  let dist = 0;
  let score = 0;
  let best = 0;
  let mode = 'ready'; // 'ready', 'playing', 'crash', 'over'
  let shake = 0;
  let camLift = 0;
  let camH = 0;
  let blurSpan = 0;

  // Drift Combo Multiplier
  let driftTime = 0;
  let driftCombo = 1.0;
  let lastComboStep = 1;

  try {
    best = Math.max(0, parseInt(localStorage.getItem('acrobatic_train_best'), 10) || 0);
  } catch {}

  // Bogie End States
  const ends = { front: 0, rear: 0 };
  const moves = {
    front: { from: 0, to: 0, t: 1, h0: 0, airT: 0 },
    rear: { from: 0, to: 0, t: 1, h0: 0, airT: 0 }
  };
  const riding = { front: null, rear: null };
  const jump = { on: false, t: 0, T: 1, y0: 0, vy: 0, spin: false, dir: 1, p0: 0 };
  const sag = { front: { x: 0, v: 0 }, rear: { x: 0, v: 0 } };
  const roll = { x: 0, v: 0 };
  const lands = [];
  const rb = { p: V(0, 0, 0), v: V(0, 0, 0), q: new THREE.Quaternion(), w: V(0, 0, 0) };

  // Pose representation
  const pose = { x: 0, z: 0, h: 0, yaw: 0, mx: 0, mz: 0, ma: 0, air: 0 };
  const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), qSpin = new THREE.Quaternion();
  const pivA = V(0, 0, 0), pivB = V(0, 0, 0);

  // Slope and lift helpers
  const slopeOf = (end) => {
    const m = moves[end];
    return m.t >= 1 ? 0 : ((m.to - m.from) * easeD(m.t)) / (speed * CROSS_TIME);
  };
  const liftOf = (end) => {
    const m = moves[end];
    if (m.t >= 1) return 0;
    const fade = Math.max(0, Math.min(1, 1 - (m.airT - AIR_MAX) / AIR_FADE));
    return Math.max(m.h0 * (1 - ease(m.t)), HOP * Math.sin(Math.PI * m.t)) * fade;
  };

  function setTarget(end, track) {
    const m = moves[end];
    if (track === m.to) return;
    m.h0 = Math.min(liftOf(end), HOP);
    m.from = ends[end];
    m.to = track;
    m.t = 0;
    sound.hop();
  }

  function stepMoves(dt) {
    ['front', 'rear'].forEach((end) => {
      const m = moves[end];
      if (m.t >= 1) return;
      m.t = Math.min(1, m.t + dt / CROSS_TIME);
      m.airT = m.t >= 1 ? 0 : m.airT + dt;
      ends[end] = m.from + (m.to - m.from) * ease(m.t);
      if (m.t >= 1 && !jump.on) onLand(end, Math.sign(m.to - m.from));
    });
  }

  function onLand(end, dir) {
    sag[end].v -= SAG_HIT;
    roll.v += dir * ROLL_HIT;
    shake = Math.min(shake + SHAKE_HIT, SHAKE_HIT * 1.6);
    lands.push(end);
    if (mode === 'playing') sound.land();
  }

  function stepSprings(dt) {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) {
      [sag.front, sag.rear].forEach((sp) => {
        sp.v += (-SAG_K * sp.x - SAG_C * sp.v) * h;
        sp.x += sp.v * h;
      });
      roll.v += (-ROLL_K * roll.x - ROLL_C * roll.v) * h;
      roll.x += roll.v * h;
    }
    shake *= Math.exp(-SHAKE_DECAY * dt);
  }

  // ---------- THREE.JS WEBGL RENDERER & SCENE ----------
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0a0e17);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a101d, 0.0028);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);

  // Cinematic Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2838, 0.45));
  const sun = new THREE.DirectionalLight(0xfff5e6, 0.95);
  sun.position.set(8, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const SUN_OFFSET = V(8, 20, 10);
  scene.add(sun, sun.target);

  // Background Environment & Mountains
  const bg = new THREE.Group();
  {
    const R = 2600, geo = new THREE.SphereGeometry(R, 32, 16);
    const pos = geo.attributes.position, col = [];
    const top = new THREE.Color(0x050b14), hor = new THREE.Color(0x0e2238), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.copy(hor).lerp(top, Math.pow(Math.max(0, pos.getY(i) / R), 0.6));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthTest: false, depthWrite: false }));
    sky.renderOrder = -1;
    bg.add(sky);

    const MOUNTAINS = [
      { r: 2200, h: [90, 260], color: 0x091929, seed: 1 },
      { r: 1500, h: [40, 150], color: 0x0c251f, seed: 7 },
    ];
    MOUNTAINS.forEach((m) => {
      const N = 360, v = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const w = 0.5 + 0.5 * (0.5 * Math.sin(a * 3 + m.seed) + 0.3 * Math.sin(a * 7 + m.seed * 2.3) + 0.2 * Math.sin(a * 17 + m.seed * 4.1));
        const h = m.h[0] + (m.h[1] - m.h[0]) * w;
        v.push(Math.cos(a) * m.r, -20, Math.sin(a) * m.r, Math.cos(a) * m.r, h, Math.sin(a) * m.r);
        if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(idx);
      bg.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: m.color, side: THREE.DoubleSide })));
    });
  }
  scene.add(bg);

  // Ground Plane
  function makeGrassTexture() {
    const S = 512, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#112217';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(28, 55, 36, 0.7)');
      gr.addColorStop(1, 'rgba(28, 55, 36, 0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(120, 120);
    return t;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.9, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // Helpers & Materials
  const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, metalness, roughness }, extra));
  const geoCache = new Map();
  const cached = (key, make) => {
    if (!geoCache.has(key)) geoCache.set(key, make());
    return geoCache.get(key);
  };
  const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (r, len, seg = 12) => cached(`c${r},${len},${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg));
  const zCyl = (r, len, seg = 12) => cached(`z${r},${len},${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2));
  const xCyl = (r, len, seg = 12) => cached(`x${r},${len},${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2));

  // Dynamic Physical Sparks Particle System
  const SPARK_MAX = 200;
  const sparkPos = new Float32Array(SPARK_MAX * 3);
  const sparkCol = new Float32Array(SPARK_MAX * 3);
  const sparks = [];
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);

  function emitSparks(posOrigin, count = 4, vxBias = 0) {
    for (let i = 0; i < count; i++) {
      if (sparks.length >= SPARK_MAX) sparks.shift();
      sparks.push({
        x: posOrigin.x + rnd(-0.2, 0.2),
        y: posOrigin.y + 0.1,
        z: posOrigin.z + rnd(-0.2, 0.2),
        vx: vxBias + rnd(-3, 3),
        vy: rnd(2, 6),
        vz: rnd(-3, 3),
        age: 0,
        life: rnd(0.2, 0.45)
      });
    }
  }

  function updateSparks(dt) {
    let activeCount = 0;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) {
        sparks.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < BALLAST_H) {
        p.y = BALLAST_H;
        p.vy *= -0.3;
      }
      const k = 1 - p.age / p.life;
      sparkPos.set([p.x, p.y, p.z], activeCount * 3);
      sparkCol.set([1.0, 0.7 * k, 0.2 * k * k], activeCount * 3);
      activeCount++;
    }
    sparkGeo.setDrawRange(0, activeCount);
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  }

  // ---------- TRACK SPLINE GENERATION ----------
  const segs = [];
  function segAt(seg, u) {
    const h = seg.h0 + seg.k * u;
    if (seg.k === 0) return { x: seg.x0 + Math.cos(h) * u, z: seg.z0 + Math.sin(h) * u, h };
    return {
      x: seg.x0 + (Math.sin(h) - Math.sin(seg.h0)) / seg.k,
      z: seg.z0 - (Math.cos(h) - Math.cos(seg.h0)) / seg.k,
      h
    };
  }

  function pathAt(s) {
    let seg = segs[0];
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].s0 <= s) {
        seg = segs[i];
        break;
      }
    }
    return seg ? segAt(seg, s - seg.s0) : { x: 0, z: 0, h: 0 };
  }

  const offsetPt = (p, l) => ({ x: p.x - Math.sin(p.h) * l, z: p.z + Math.cos(p.h) * l });

  function sweepSeg(seg, profile, closed, uLen, ua = 0, ub = seg.len) {
    const n = seg.k === 0 ? 1 : Math.max(2, Math.ceil((ub - ua) / 1.5));
    const pos = [], uv = [], idx = [], m = profile.length;
    for (let i = 0; i <= n; i++) {
      const u = ua + ((ub - ua) * i) / n, p = segAt(seg, u);
      profile.forEach(([l, y], j) => {
        const q = offsetPt(p, l);
        pos.push(q.x, y, q.z);
        uv.push((seg.s0 + u) / uLen, j / (m - 1));
      });
    }
    const sides = closed ? m : m - 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % m;
        const a = i * m + j, b = i * m + j2, c = (i + 1) * m + j, d = (i + 1) * m + j2;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Materials
  const ballastMat = std(0x565c66, 0.1, 0.9, { side: THREE.DoubleSide });
  const BW = TRACK_SPACING;
  const BALLAST_PROFILE = [[-BW - 1.6, 0], [-BW - 1.15, BALLAST_H], [BW + 1.15, BALLAST_H], [BW + 1.6, 0]];
  const RAIL_PROFILE = [
    [-0.07, 0], [0.07, 0], [0.07, 0.02], [0.016, 0.035], [0.016, 0.095], [0.036, 0.102],
    [0.036, 0.14], [-0.036, 0.14], [-0.036, 0.102], [-0.016, 0.095], [-0.016, 0.035], [-0.07, 0.02]
  ];
  const railMat = std(0x8a929a, 0.8, 0.4, { flatShading: true, side: THREE.DoubleSide });
  const railTopMat = std(0xe0e6ed, 0.95, 0.15, { side: THREE.DoubleSide });
  const gapMat = std(0x2d1f14, 0, 1, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  const ramps = [], poles = [], items = [], gaps = [];

  function railRanges(seg, tz) {
    let ranges = [[0, seg.len]];
    seg.gaps.filter((g) => g.tz === tz).forEach((g) => {
      const a = g.a - seg.s0, b = g.b - seg.s0;
      ranges = ranges.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : [[x, Math.max(x, a)], [Math.min(y, b), y]].filter(([p, q]) => q - p > 0.01)));
    });
    return ranges;
  }



  function buildSeg(seg) {
    seg.meshes = [];
    const ballast = new THREE.Mesh(sweepSeg(seg, BALLAST_PROFILE, false, BALLAST_U), ballastMat);
    ballast.receiveShadow = true;
    seg.meshes.push(ballast);

    // Rails
    TRACKS.forEach((tz) => {
      const ranges = railRanges(seg, tz);
      [-GAUGE / 2, GAUGE / 2].forEach((off) => {
        const c = tz + off;
        ranges.forEach(([ua, ub]) => {
          const rail = new THREE.Mesh(sweepSeg(seg, RAIL_PROFILE.map(([l, y]) => [c + l, RAIL_BASE + y]), true, 1, ua, ub), railMat);
          const top = new THREE.Mesh(sweepSeg(seg, [[c - 0.03, RAIL_TOP + 0.002], [c + 0.03, RAIL_TOP + 0.002]], false, 1, ua, ub), railTopMat);
          rail.castShadow = rail.receiveShadow = top.receiveShadow = true;
          seg.meshes.push(rail, top);
        });
      });
    });

    // Gaps
    seg.gaps.forEach((g) => {
      const m = new THREE.Mesh(sweepSeg(seg, [[g.tz - 0.95, BALLAST_H + 0.01], [g.tz + 0.95, BALLAST_H + 0.01]], false, 1, g.a - seg.s0, g.b - seg.s0), gapMat);
      m.receiveShadow = true;
      seg.meshes.push(m);
    });


    seg.meshes.forEach((m) => scene.add(m));
  }

  function disposeSeg(seg) {
    seg.meshes.forEach((m) => {
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
    });
    const drop = (list, arr) => list.forEach((o) => {
      if (o.mesh) scene.remove(o.mesh);
      const i = arr.indexOf(o);
      if (i >= 0) arr.splice(i, 1);
    });
    drop(seg.ramps, ramps);
    drop(seg.poles, poles);
    drop(seg.items, items);
    drop(seg.gaps, gaps);
  }

  const newSeg = (s0, len, x0, z0, h0, k) => ({
    s0, len, x0, z0, h0, k,
    ramps: [], poles: [], items: [], gaps: [], meshes: []
  });

  // Track ties (sleepers) instancing
  const tmpObj = new THREE.Object3D();
  const tiesPerTrack = Math.floor((TIE_BACK + TIE_FRONT) / SLEEPER_STEP);
  const sleeperCount = tiesPerTrack * TRACKS.length;
  const sleepers = new THREE.InstancedMesh(box(0.24, 0.1, GAUGE + 0.8), std(0xa0a5ab, 0, 0.85), sleeperCount);
  sleepers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const ties = new THREE.Group();
  const tieLayers = [];
  for (let i = 0; i < BLUR_N; i++) {
    const layer = new THREE.Group();
    const m = new THREE.InstancedMesh(sleepers.geometry, std(0xa0a5ab, 0, 0.85, { transparent: true, opacity: BLUR_A, depthWrite: false }), sleepers.count);
    m.instanceMatrix = sleepers.instanceMatrix;
    m.frustumCulled = false;
    layer.add(m);
    ties.add(layer);
    tieLayers.push(layer);
  }
  scene.add(ties);

  const gapAt = (tz, s) => gaps.some((g) => g.tz === tz && s >= g.a && s <= g.b);
  const gapUnder = (lat, s) => gaps.some((g) => Math.abs(lat - g.tz) < RAMP_HIT && s >= g.a && s <= g.b);

  function placeTies() {
    const k0 = Math.ceil((dist - TIE_BACK) / SLEEPER_STEP);
    let n = 0;
    for (let i = 0; i < tiesPerTrack; i++) {
      const sk = (k0 + i) * SLEEPER_STEP;
      const p = pathAt(sk);
      tmpObj.rotation.set(0, -p.h, 0);
      TRACKS.forEach((tz) => {
        const q = offsetPt(p, tz);
        tmpObj.position.set(q.x, BALLAST_H, q.z);
        tmpObj.scale.setScalar(gapAt(tz, sk) ? 0 : 1);
        tmpObj.updateMatrix();
        sleepers.setMatrixAt(n, tmpObj.matrix);
        n++;
      });
    }
    tmpObj.scale.setScalar(1);
    sleepers.instanceMatrix.needsUpdate = true;
  }

  // ---------- HAZARDS & SWITCHES (CHAVES DE DESVIO) ----------
  const rampGeo = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, BALLAST_H);
    sh.lineTo(0, RAIL_TOP);
    sh.lineTo(RAMP_LEN, RAIL_TOP + RAMP_H);
    sh.lineTo(RAMP_LEN, BALLAST_H);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: RAMP_W, bevelEnabled: false });
    g.translate(0, 0, -RAMP_W / 2);
    return g;
  })();
  const rampMat = std(0xf39c12, 0.4, 0.4);

  function addRamp(seg, s, tz) {
    const p = segAt(seg, s - seg.s0), q = offsetPt(p, tz);
    const mesh = new THREE.Mesh(rampGeo, rampMat);
    mesh.position.set(q.x, 0, q.z);
    mesh.rotation.y = -p.h;
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const r = { s, tz, mesh };
    ramps.push(r);
    seg.ramps.push(r);
  }

  function rampAt(s, lat) {
    for (const r of ramps) {
      const u = s - r.s;
      if (u >= 0 && u <= RAMP_LEN && Math.abs(lat - r.tz) < RAMP_HIT) return r;
    }
    return null;
  }

  // Hazard Poles
  const poleGeo = new THREE.CylinderGeometry(POLE_R, POLE_R, POLE_H, 12).translate(0, POLE_H / 2, 0);
  const poleMat = std(0xef476f, 0.2, 0.4, { emissive: 0xef476f, emissiveIntensity: 0.4 });
  function addPole(seg, s, lat) {
    const p = segAt(seg, s - seg.s0), q = offsetPt(p, lat);
    const mesh = new THREE.Mesh(poleGeo, poleMat);
    mesh.position.set(q.x, BALLAST_H, q.z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const o = { s, lat, mesh, h: POLE_H, r: POLE_R };
    seg.poles.push(o);
    poles.push(o);
  }


  // Collectible Rings / Items
  const ringGeo = new THREE.TorusGeometry(2.0, 0.16, 8, 32);
  const itemGeo = new THREE.OctahedronGeometry(ITEM_R);
  const itemMats = [
    std(0xffd166, 0.3, 0.3, { emissive: 0xffd166, emissiveIntensity: 0.7 }),
    std(0x00f2fe, 0.3, 0.3, { emissive: 0x00f2fe, emissiveIntensity: 0.8 }),
    std(0xff5fd2, 0.3, 0.3, { emissive: 0xff5fd2, emissiveIntensity: 0.9 }),
  ];

  function addItem(seg, s, lat, level, diag = false, pts = ITEM_POINTS[level]) {
    const p = segAt(seg, s - seg.s0), q = offsetPt(p, lat);
    const y = (level === 0 ? 0 : level === 1 ? LINE_AIR1 : LINE_AIR2) + ITEM_Y;
    const ring = level > 0;
    const mesh = new THREE.Mesh(ring ? ringGeo : itemGeo, itemMats[level]);
    mesh.position.set(q.x, y, q.z);
    mesh.rotation.y = ring ? Math.PI / 2 - p.h : -p.h + Math.PI / 4;
    mesh.castShadow = true;
    scene.add(mesh);
    const o = { s, lat, y, level, mesh, taken: false, diag, pts, ring };
    seg.items.push(o);
    items.push(o);
  }

  function addGap(seg, tz, a, b) {
    const g = { tz, a, b };
    seg.gaps.push(g);
    gaps.push(g);
  }

  const PATTERNS = {
    ramp(seg, s, end) {
      const lip = s + RAMP_LEN;
      const level = Math.random() < 0.5 ? 2 : 1;
      const len = RAMP_LEN + 25;
      if (s + len > end) return 0;
      const tz = pick(TRACKS);
      addRamp(seg, s, tz);
      if (Math.random() < RAMP_GAP_RATE) addGap(seg, tz, lip + 1, lip + 1 + rnd(RAMP_GAP_MIN, RAMP_GAP_MAX));
      for (let i = 0; i < 5; i++) addItem(seg, lip + 10 + i * 4, tz, level);
      return len;
    },
    gap(seg, s, end) {
      const len = rnd(GAP_MIN, GAP_MAX);
      if (s + len > end) return 0;
      const order = TRACKS.slice().sort(() => Math.random() - 0.5);
      const n = Math.random() < 0.5 ? 2 : 1;
      order.slice(0, n).forEach((tz) => addGap(seg, tz, s, s + len));
      for (let x = s + 1; x < s + len; x += ITEM_STEP) addItem(seg, x, order[n], 0);
      return len;
    },
    poles(seg, s, end) {
      const n = Math.floor(rnd(POLE_MIN_N, 7)), len = (n - 1) * POLE_STEP;
      if (s + len > end) return 0;
      const half = TRACK_SPACING / 2;
      const lats = Math.random() < 0.5 ? [-half, half] : [pick([-half, half])];
      lats.forEach((lat) => {
        for (let i = 0; i < n; i++) addPole(seg, s + i * POLE_STEP, lat);
      });
      const tz = pick(TRACKS);
      for (let x = s; x <= s + len; x += ITEM_STEP) addItem(seg, x, tz, 0);
      return len;
    },
    items(seg, s, end) {
      const len = (ITEM_ROW - 1) * ITEM_STEP;
      if (s + len > end) return 0;
      const tz = pick(TRACKS);
      for (let i = 0; i < ITEM_ROW; i++) addItem(seg, s + i * ITEM_STEP, tz, 0);
      return len;
    },
    diag(seg, s, end) {
      const len = (ITEM_ROW - 1) * ITEM_STEP;
      if (s + len > end) return 0;
      const lat = pick([-1, 1]) * (TRACK_SPACING / 2);
      for (let i = 0; i < ITEM_ROW; i++) addItem(seg, s + i * ITEM_STEP, lat, 0, true, DIAG_POINTS);
      return len;
    }
  };

  function placeHazards(seg, from) {
    const end = seg.s0 + seg.len - RAMP_END_MARGIN;
    for (let s = Math.max(from, SAFE_START); s < end; ) {
      const names = ['ramp', 'gap', 'poles', 'items', 'diag'];
      const name = pick(names);
      const used = PATTERNS[name](seg, s, end);
      const next = used ? rnd(15, 30) : 10;
      s += (used || 5) + next;
    }
  }

  function addSeg() {
    const last = segs[segs.length - 1];
    const e = segAt(last, last.len);
    let len, k = 0;
    if (last.k === 0) {
      const r = rnd(CURVE_R_MIN, CURVE_R_MAX), ang = THREE.MathUtils.degToRad(rnd(CURVE_DEG_MIN, CURVE_DEG_MAX));
      k = (Math.random() < 0.5 ? -1 : 1) / r;
      len = ang * r;
    } else {
      len = rnd(STRAIGHT_TIME[0], STRAIGHT_TIME[1]) * 35;
    }
    const seg = newSeg(last.s0 + last.len, len, e.x, e.z, e.h, k);
    placeHazards(seg, seg.s0 + rnd(10, 25));
    buildSeg(seg);
    segs.push(seg);
  }

  function maintainTrack() {
    let last = segs[segs.length - 1];
    while (last.s0 + last.len < dist + TRACK_AHEAD) {
      addSeg();
      last = segs[segs.length - 1];
    }
    while (segs.length > 1 && segs[0].s0 + segs[0].len < dist - TRACK_BEHIND) {
      disposeSeg(segs.shift());
    }
  }

  function initTrack() {
    const seg = newSeg(-TRACK_BEHIND - 10, TRACK_BEHIND + 10 + 140, -TRACK_BEHIND - 10, 0, 0, 0);
    placeHazards(seg, SAFE_START);
    buildSeg(seg);
    segs.push(seg);
    maintainTrack();
  }

  // ---------- 3D TRAIN CARRIAGE MODEL WITH VOLUMETRIC LIGHTS ----------
  function makeBodyGeo() {
    const s = new THREE.Shape(), r = 0.3;
    s.moveTo(-W2, 0);
    s.lineTo(W2, 0);
    s.lineTo(W2, SIDE_H);
    s.quadraticCurveTo(W2, SIDE_H + r, W2 - r, SIDE_H + r + 0.02);
    s.quadraticCurveTo(0, SIDE_H + r + 0.12, -(W2 - r), SIDE_H + r + 0.02);
    s.quadraticCurveTo(-W2, SIDE_H + r, -W2, SIDE_H);
    const bt = 0.05;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: CAR_LEN - bt * 2,
      curveSegments: 10,
      bevelEnabled: true,
      bevelThickness: bt,
      bevelSize: 0.03,
      bevelOffset: -0.03,
      bevelSegments: 3
    });
    geo.translate(0, 0, -(CAR_LEN - bt * 2) / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  }

  function makeBogie() {
    const b = new THREE.Group();
    const add = (geo, mat, x, y, z, parent = b) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const wheelsets = [];
    const SZ = GAUGE / 2 + 0.12;
    const rimMat = std(0xe2e8f0, 0.95, 0.1);
    const hubMat = std(0x2d3748, 0.7, 0.4);
    const brakeMat = std(0x8a929a, 0.85, 0.2);
    const bogieFrameMat = std(0x1e242d, 0.5, 0.5);
    const springMat = std(0x64748b, 0.9, 0.2);

    [-AXLE, AXLE].forEach((ax) => {
      const ws = new THREE.Group();
      ws.position.set(ax, WC, 0);
      // Steel Axle shaft
      add(zCyl(0.048, GAUGE + 0.26, 12), std(0x62656a, 0.75, 0.35), 0, 0, 0, ws);

      [-1, 1].forEach((sd) => {
        const z = sd * (GAUGE / 2);
        // Polished steel outer wheel rim
        add(zCyl(WHEEL_R, 0.08, 24), rimMat, 0, 0, z, ws);
        // Dark iron recessed inner wheel hub
        add(zCyl(WHEEL_R * 0.68, 0.085, 16), hubMat, 0, 0, z, ws);
        // Axle end cap bolt
        add(zCyl(0.08, 0.1, 12), std(0x94a3b8, 0.9, 0.2), 0, 0, z + sd * 0.015, ws);
        // Ventilated disc brake rotor
        add(zCyl(WHEEL_R * 0.75, 0.02, 16), brakeMat, 0, 0, z - sd * 0.05, ws);
      });
      b.add(ws);
      wheelsets.push(ws);

      // Axle journal bearing boxes & dual suspension coil springs
      [-1, 1].forEach((sd) => {
        // Journal bearing box
        add(box(0.18, 0.14, 0.12), std(0x2a2c2f, 0.4, 0.6), ax, WC, sd * SZ);
        // Dual vertical coil springs over each bearing box
        [-0.06, 0.06].forEach((sprOff) => {
          add(cyl(0.038, 0.18, 8), springMat, ax + sprOff, WC + 0.14, sd * SZ);
        });
      });
    });

    // Bogie Longitudinal Side Beams & Center Cross Bolster
    [-1, 1].forEach((sd) => {
      add(box(AXLE * 2 + 0.25, 0.09, 0.08), bogieFrameMat, 0, WC + 0.08, sd * SZ);
      // Hydraulic damper / shock absorber angled between axle and center
      [-1, 1].forEach((axSign) => {
        const damper = add(cyl(0.025, 0.28, 8), std(0xd97706, 0.8, 0.3), axSign * (AXLE * 0.5), WC + 0.06, sd * (SZ + 0.03));
        damper.rotation.z = axSign * 0.35;
      });
    });
    // Center bolster pivot plate & cross-tie
    add(box(0.3, 0.1, GAUGE + 0.3), bogieFrameMat, 0, WC + 0.12, 0);
    add(cyl(0.18, 0.08, 12), std(0x475569, 0.8, 0.3), 0, WC + 0.18, 0);

    // Front/Rear rail obstacle sweepers / deflector shoes
    [-1, 1].forEach((axSign) => {
      add(box(0.06, 0.07, GAUGE + 0.1), std(0x334155, 0.5, 0.5), axSign * (AXLE + 0.22), WC - 0.12, 0);
    });

    b.userData.wheelsets = wheelsets;
    return b;
  }

  let trainBodyMeshes = [];
  let trainBandMeshes = [];
  let trainAccentMeshes = [];
  let headlightSpotlights = [];
  let volumetricBeamMeshes = [];
  let headlightLensMeshes = [];
  let underglowMesh = null;
  let pantographInsulatorMeshes = [];

  function applyTrainSkin(skinKey) {
    const skin = SKINS[skinKey];
    if (!skin) return;

    trainBodyMeshes.forEach((m) => {
      m.material.color.setHex(skin.bodyColor);
      m.material.metalness = skin.bodyMetal;
      m.material.roughness = skin.bodyRough;
    });

    trainBandMeshes.forEach((m) => {
      m.material.color.setHex(skin.bandColor);
      m.material.emissive.setHex(skin.bandEmissive);
    });

    trainAccentMeshes.forEach((m) => {
      m.material.color.setHex(skin.accentColor);
      if (m.material.emissive) m.material.emissive.setHex(skin.bandEmissive);
    });

    headlightLensMeshes.forEach((m) => {
      m.material.emissive.setHex(skin.lightColor);
    });

    if (underglowMesh) {
      underglowMesh.material.color.setHex(skin.lightColor);
      underglowMesh.material.emissive.setHex(skin.lightColor);
    }

    pantographInsulatorMeshes.forEach((m) => {
      m.material.color.setHex(skin.accentColor);
      m.material.emissive.setHex(skin.bandEmissive);
    });

    headlightSpotlights.forEach((spot) => {
      spot.color.setHex(skin.lightColor);
      spot.intensity = skin.lightIntensity;
    });

    volumetricBeamMeshes.forEach((beam) => {
      beam.material.color.setHex(skin.lightColor);
    });

    hud.updateSkinDisplay(skinKey, skin);
  }

  function makeCar() {
    const car = new THREE.Group();
    const bodyPivot = new THREE.Group();
    bodyPivot.position.y = BODY_Y;
    const g = new THREE.Group();
    g.position.y = -BODY_Y;
    bodyPivot.add(g);
    car.add(bodyPivot);

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    trainBodyMeshes = [];
    trainBandMeshes = [];
    trainAccentMeshes = [];
    headlightSpotlights = [];
    volumetricBeamMeshes = [];
    headlightLensMeshes = [];
    pantographInsulatorMeshes = [];

    const initialSkin = SKINS[skinKeys[currentSkinIdx]];
    const bodyMat = std(initialSkin.bodyColor, initialSkin.bodyMetal, initialSkin.bodyRough);
    const bandMat = std(initialSkin.bandColor, 0.2, 0.3, { emissive: initialSkin.bandEmissive, emissiveIntensity: 0.6 });
    const glassMat = std(0xffd166, 0.2, 0.1, { emissive: 0xffd166, emissiveIntensity: 0.4 }); // Illuminated passenger cabin
    const darkTrimMat = std(0x181e26, 0.8, 0.3);
    const chromeMat = std(0xf1f5f9, 0.95, 0.1);
    const aeroSkirtMat = std(initialSkin.bodyColor, initialSkin.bodyMetal, initialSkin.bodyRough);
    const pantographMat = std(0x334155, 0.7, 0.3);
    const pantographShoeMat = std(0x0f172a, 0.4, 0.6);
    const insulatorMat = std(initialSkin.accentColor, 0.3, 0.3, { emissive: initialSkin.bandEmissive, emissiveIntensity: 0.7 });
    const underglowMat = std(initialSkin.lightColor, 0.1, 0.8, { emissive: initialSkin.lightColor, emissiveIntensity: 1.6, transparent: true, opacity: 0.75 });

    // 1. Main Coach Body Shell
    const mainBody = add(makeBodyGeo(), bodyMat, 0, BODY_Y, 0);
    trainBodyMeshes.push(mainBody);

    // 2. Aerodynamic Nose Cone (+X Front Cockpit)
    const noseBaseX = CAR_LEN / 2;
    // Lower aerodynamic nose wedge
    const noseLower = add(box(1.2, 0.78, CAR_W - 0.04), bodyMat, noseBaseX + 0.52, BODY_Y + 0.4, 0);
    trainBodyMeshes.push(noseLower);
    // Upper aerodynamic nose slope
    const noseUpper = add(box(0.9, 0.5, CAR_W - 0.1), bodyMat, noseBaseX + 0.38, BODY_Y + 0.92, 0);
    trainBodyMeshes.push(noseUpper);
    // Front chin splitter / aerodynamic lip
    add(box(0.95, 0.14, CAR_W + 0.02), darkTrimMat, noseBaseX + 0.5, BODY_Y - 0.18, 0);
    const chinLip = add(box(1.0, 0.04, CAR_W + 0.04), bandMat, noseBaseX + 0.52, BODY_Y - 0.24, 0);
    trainBandMeshes.push(chinLip);

    // Raked cockpit windshield
    const windshield = add(box(0.72, 0.56, CAR_W * 0.82), std(0x090d16, 0.95, 0.05, { emissive: 0x00f2fe, emissiveIntensity: 0.08 }), noseBaseX + 0.28, BODY_Y + 1.25, 0);
    windshield.rotation.z = -0.42;
    // Cockpit A-pillars and top sun-visor brow
    const cockpitVisor = add(box(0.14, 0.58, CAR_W * 0.85), bodyMat, noseBaseX + 0.29, BODY_Y + 1.27, 0);
    cockpitVisor.rotation.z = -0.42;
    trainBodyMeshes.push(cockpitVisor);
    const wiper = add(box(0.32, 0.02, 0.02), darkTrimMat, noseBaseX + 0.42, BODY_Y + 1.14, 0);
    wiper.rotation.z = -0.42;

    // Twin High-Intensity Projector Headlight Pods
    [-0.46, 0.46].forEach((zOff) => {
      // Bezel & Chrome Reflector Cup
      add(xCyl(0.14, 0.12, 16), darkTrimMat, noseBaseX + 0.98, BODY_Y + 0.42, zOff);
      add(xCyl(0.11, 0.08, 16), chromeMat, noseBaseX + 1.02, BODY_Y + 0.42, zOff);
      // Glowing Optical Lens
      const lensMat = std(0xffffff, 0.1, 0.1, { emissive: initialSkin.lightColor, emissiveIntensity: 2.8 });
      const lens = add(xCyl(0.09, 0.03, 16), lensMat, noseBaseX + 1.05, BODY_Y + 0.42, zOff);
      headlightLensMeshes.push(lens);

      // Daytime Running Light (DRL) LED Bar
      const drl = add(box(0.14, 0.03, 0.22), bandMat, noseBaseX + 0.98, BODY_Y + 0.24, zOff);
      trainBandMeshes.push(drl);
    });

    // 3. Rear Coach End Vestibule & Gangway Bellows (-X)
    const rearBaseX = -CAR_LEN / 2;
    [-0.08, -0.16, -0.24, -0.32].forEach((ox) => {
      add(box(0.045, SIDE_H * 0.86, CAR_W * 0.74), std(0x18181b, 0.1, 0.85), rearBaseX + ox, BODY_Y + SIDE_H * 0.43, 0);
    });
    // Automatic knuckle coupler
    add(xCyl(0.05, 0.42, 8), std(0x374151, 0.8, 0.3), rearBaseX - 0.25, BODY_Y - 0.12, 0);
    add(box(0.16, 0.16, 0.18), darkTrimMat, rearBaseX - 0.45, BODY_Y - 0.12, 0);

    // Twin High-Visibility Red LED Tail Lamps
    [-0.52, 0.52].forEach((zOff) => {
      add(box(0.06, 0.12, 0.24), darkTrimMat, rearBaseX - 0.02, BODY_Y + 0.6, zOff);
      add(box(0.04, 0.08, 0.18), std(0xff1744, 0.1, 0.2, { emissive: 0xff1744, emissiveIntensity: 2.5 }), rearBaseX - 0.04, BODY_Y + 0.6, zOff);
    });

    // 4. Undercarriage Aerodynamic Skirts & Equipment
    [-1, 1].forEach((sd) => {
      const skirt = add(box(BOGIE * 1.5, 0.34, 0.03), aeroSkirtMat, 0, BODY_Y - 0.15, sd * (W2 - 0.015));
      trainBodyMeshes.push(skirt);
      const skirtStripe = add(box(BOGIE * 1.5, 0.04, 0.035), bandMat, 0, BODY_Y - 0.30, sd * (W2 - 0.012));
      trainBandMeshes.push(skirtStripe);
    });
    // Underside traction inverter pack
    add(box(2.2, 0.28, CAR_W * 0.7), std(0x1e242d, 0.6, 0.4), 0, BODY_Y - 0.15, 0);
    // Compressed air reservoirs
    [-0.32, 0.32].forEach((tz) => {
      add(xCyl(0.14, 1.8, 12), std(0x475569, 0.8, 0.3), -1.8, BODY_Y - 0.16, tz);
    });

    // 5. Articulated High-Speed Roof Pantograph
    const pantoX = -BOGIE + 0.4;
    // Aerodynamic wind deflector ramp
    add(box(0.48, 0.14, 0.8), darkTrimMat, pantoX + 0.55, ROOF_Y + 0.07, 0);
    // Base frame
    add(box(0.82, 0.05, 0.7), pantographMat, pantoX, ROOF_Y + 0.04, 0);
    // 4 Ceramic insulators
    [-0.3, 0.3].forEach((px) => {
      [-0.26, 0.26].forEach((pz) => {
        const ins = add(cyl(0.042, 0.12, 8), insulatorMat, pantoX + px, ROOF_Y + 0.09, pz);
        pantographInsulatorMeshes.push(ins);
      });
    });
    // Articulated diamond arms
    const pantoArm1 = add(cyl(0.022, 0.62, 6), std(0x64748b, 0.85, 0.2), pantoX - 0.12, ROOF_Y + 0.32, 0);
    pantoArm1.rotation.z = 0.52;
    const pantoArm2 = add(cyl(0.018, 0.58, 6), std(0x94a3b8, 0.85, 0.2), pantoX + 0.02, ROOF_Y + 0.65, 0);
    pantoArm2.rotation.z = -0.55;
    // Top contact shoe
    add(box(0.05, 0.03, 1.15), pantographShoeMat, pantoX, ROOF_Y + 0.88, 0);
    [-0.56, 0.56].forEach((hz) => {
      add(box(0.05, 0.08, 0.03), std(0x94a3b8, 0.8, 0.2), pantoX, ROOF_Y + 0.84, hz);
    });

    // 6. Rooftop Climate Control Modules (HVAC) & High-Voltage Cable
    [-0.4, 1.9].forEach((hx) => {
      add(box(1.25, 0.22, 1.12), std(0x94a3b8, 0.5, 0.4), hx, ROOF_Y + 0.11, 0);
      add(box(0.04, 0.14, 0.9), darkTrimMat, hx - 0.61, ROOF_Y + 0.11, 0);
      add(box(0.04, 0.14, 0.9), darkTrimMat, hx + 0.61, ROOF_Y + 0.11, 0);
      [-0.32, 0.32].forEach((fx) => {
        add(cyl(0.22, 0.03, 16), std(0x334155, 0.7, 0.3), hx + fx, ROOF_Y + 0.22, 0);
        add(cyl(0.08, 0.035, 12), std(0x0f172a, 0.9, 0.1), hx + fx, ROOF_Y + 0.22, 0);
      });
    });
    // High-voltage copper conduit pipe
    add(xCyl(0.022, 4.8, 8), std(0xd97706, 0.9, 0.2), 0.7, ROOF_Y + 0.04, 0);

    // 7. Panoramic Windows & Sliding Passenger Doors
    [-1, 1].forEach((sd) => {
      // Main neon accent speed stripe
      const mainStripe = add(box(CAR_LEN - 0.2, 0.12, 0.038), bandMat, 0, BODY_Y + 0.78, sd * (W2 + 0.018));
      trainBandMeshes.push(mainStripe);
      // Secondary roof-line pin stripe
      const topStripe = add(box(CAR_LEN - 0.4, 0.035, 0.035), bandMat, 0, BODY_Y + 1.58, sd * (W2 + 0.016));
      trainBandMeshes.push(topStripe);

      // 6 Panoramic Passenger Windows per side
      [-2.8, -1.9, -1.0, 0.8, 1.7, 2.6].forEach((wx) => {
        // Metallic outer frame
        add(box(0.78, 0.56, 0.036), darkTrimMat, wx, BODY_Y + 1.22, sd * (W2 + 0.015));
        // Illuminated glass
        add(box(0.72, 0.50, 0.038), glassMat, wx, BODY_Y + 1.22, sd * (W2 + 0.016));
        // Vertical mullion
        add(box(0.025, 0.50, 0.04), std(0x334155, 0.8, 0.2), wx, BODY_Y + 1.22, sd * (W2 + 0.017));
      });

      // 2 Passenger Entrance Doors per side
      [-0.1, 3.6].forEach((dx) => {
        // Recessed frame
        const dFrame = add(box(0.68, 1.48, 0.035), bodyMat, dx, BODY_Y + 0.74, sd * (W2 + 0.014));
        trainBodyMeshes.push(dFrame);
        // Dark door panel
        add(box(0.62, 1.42, 0.036), std(0x18181b, 0.6, 0.4), dx, BODY_Y + 0.74, sd * (W2 + 0.015));
        // Door narrow window
        add(box(0.18, 0.60, 0.038), glassMat, dx, BODY_Y + 1.05, sd * (W2 + 0.016));
        // Stainless steel grab handle
        add(cyl(0.014, 0.65, 6), chromeMat, dx + 0.24, BODY_Y + 0.75, sd * (W2 + 0.024));
        // Green LED door indicator
        add(box(0.08, 0.03, 0.04), std(0x10b981, 0.2, 0.2, { emissive: 0x10b981, emissiveIntensity: 2.0 }), dx, BODY_Y + 1.52, sd * (W2 + 0.018));
      });
    });

    // 8. Ground Neon Underglow
    underglowMesh = add(box(CAR_LEN - 1.0, 0.04, CAR_W - 0.35), underglowMat, 0, BODY_Y - 0.28, 0);

    // 9. Bogies
    const bogies = [makeBogie(), makeBogie()];
    bogies[0].position.x = BOGIE;
    bogies[1].position.x = -BOGIE;
    bogies.forEach((b) => car.add(b));

    // 10. Volumetric Headlights & Spotlights
    const beamGeo = new THREE.ConeGeometry(1.6, 22, 16);
    beamGeo.rotateZ(-Math.PI / 2);
    beamGeo.translate(11, 0, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: initialSkin.lightColor,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    [-0.46, 0.46].forEach((zOff) => {
      const spot = new THREE.SpotLight(initialSkin.lightColor, initialSkin.lightIntensity, 40, Math.PI / 6.5, 0.35, 1.2);
      spot.position.set(noseBaseX + 1.05, BODY_Y + 0.42, zOff);
      const target = new THREE.Object3D();
      target.position.set(noseBaseX + 22, BODY_Y + 0.2, zOff);
      g.add(target);
      spot.target = target;
      g.add(spot);
      headlightSpotlights.push(spot);

      const vMesh = new THREE.Mesh(beamGeo, beamMat.clone());
      vMesh.position.set(noseBaseX + 1.05, BODY_Y + 0.42, zOff);
      g.add(vMesh);
      volumetricBeamMeshes.push(vMesh);
    });

    car.userData.body = bodyPivot;
    car.userData.bogies = bogies;
    car.userData.wheelsets = bogies.flatMap((b) => b.userData.wheelsets);

    car.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    scene.add(car);
    return car;
  }

  const car = makeCar();

  // ---------- AERIAL STUNTS & TYPESAFE JEV AI JUDGE ----------
  async function evaluateStuntWithJev(stuntType, airDuration, peakHeight) {
    try {
      const telemetry = {
        stunt_type: stuntType,
        air_duration_seconds: airDuration.toFixed(2),
        peak_altitude_meters: peakHeight.toFixed(1),
        speed_kmh: Math.round(speed * 3.6),
        drift_combo: driftCombo.toFixed(1)
      };

      const res = await fetch('/api/stunt-judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetry)
      });

      if (res.ok) {
        const data = await res.json();
        score += data.bonus || 50;
        hud.showStunt(`${data.title}! +${data.bonus}`, `${data.title} (${Math.round((data.confidence || 0.9) * 100)}% Match)`);
        sound.stunt();
      }
    } catch {
      // Non-blocking fallback
    }
  }

  function launch(end, r, y0, p0 = 0) {
    const other = end === 'front' ? 'rear' : 'front';
    const isDiagonal = Math.abs(ends[other] - r.tz) >= RAMP_HIT;
    const peak = isDiagonal ? LINE_AIR1 : LINE_AIR2;
    const vy = Math.sqrt(2 * JUMP_G * Math.max(0, peak - y0));

    Object.assign(jump, { on: true, t: 0, y0, vy, spin: isDiagonal, p0 });
    sound.launch(isDiagonal);
    jump.T = (vy + Math.sqrt(vy * vy + 2 * JUMP_G * y0)) / JUMP_G;

    const stuntName = isDiagonal ? 'BARREL ROLL 360°' : 'BACKFLIP VERTICAL';
    score += Math.round(50 * driftCombo);
    hud.showStunt(`${stuntName}! +${Math.round(50 * driftCombo)}`);
    sound.stunt();

    // Trigger TypeSafe Jev AI Stunt Evaluation
    evaluateStuntWithJev(stuntName, jump.T, peak);
  }

  function landJump() {
    riding.front = riding.rear = null;
    ['front', 'rear'].forEach((e) => {
      sag[e].v -= SAG_HIT * JUMP_LAND;
      lands.push(e);
    });
    shake = SHAKE_HIT * 1.8;
    if (mode === 'playing') sound.bigLand();
  }

  // ---------- CRASH PHYSICS & GAME OVER ----------
  function triggerCrash(reason) {
    if (mode !== 'playing') return;
    sound.crash();
    mode = 'crash';
    shake = SHAKE_HIT * 3;

    car.updateMatrixWorld(true);
    car.localToWorld(rb.p.set(0, COM_Y, 0));
    rb.q.copy(car.quaternion);
    const fx = Math.cos(pose.yaw), fz = Math.sin(pose.yaw);
    rb.v.set(fx * speed, jump.on ? jump.vy - JUMP_G * jump.t : 0, fz * speed);
    jump.on = false;

    rb.w.set(rnd(-2, 2), rnd(2, 5), rnd(-2, 2));

    setTimeout(() => {
      if (score > best) {
        best = score;
        try { localStorage.setItem('acrobatic_train_best', String(best)); } catch {}
      }
      mode = 'over';
      hud.showGameOver(score, best, reason);
    }, 1800);
  }

  function stepCrash(dt) {
    rb.v.y -= CRASH_G * dt;
    rb.p.addScaledVector(rb.v, dt);
    if (rb.p.y < CRASH_FLOOR + 1) {
      rb.p.y = CRASH_FLOOR + 1;
      rb.v.y *= -CRASH_BOUNCE;
      rb.v.x *= CRASH_FRICTION;
      rb.v.z *= CRASH_FRICTION;
    }
    const qW = new THREE.Quaternion(rb.w.x * dt * 0.5, rb.w.y * dt * 0.5, rb.w.z * dt * 0.5, 0).multiply(rb.q);
    rb.q.set(rb.q.x + qW.x, rb.q.y + qW.y, rb.q.z + qW.z, rb.q.w + qW.w).normalize();
  }

  // Hit testing & Switches
  function checkHits(half, slant, lf, lr, jy) {
    const sOf = { front: dist + half, rear: dist - half };
    const lift = { front: lf, rear: lr };

    // Broken Track Gaps
    for (const end of ['front', 'rear']) {
      if (lift[end] + jy < SAFE_LIFT && gapUnder(ends[end], sOf[end])) {
        triggerCrash(`O vagão ${end === 'front' ? 'dianteiro' : 'traseiro'} caiu no trilho rompido!`);
        return;
      }
    }

    // Danger Poles
    const latC = (ends.front + ends.rear) / 2;
    const ca = Math.cos(slant), sa = Math.sin(slant);
    const bottom = jy + Math.min(lf, lr);

    for (const p of poles) {
      if (Math.abs(p.s - dist) < CAR_LEN && bottom < POLE_H) {
        const ds = p.s - dist, dl = p.lat - latC;
        if (Math.abs(ds * ca + dl * sa) < CAR_LEN / 2 + POLE_R && Math.abs(-ds * sa + dl * ca) < CAR_W / 2 + POLE_R) {
          triggerCrash('Colisão lateral violenta com o poste entre os trilhos!');
          return;
        }
      }
    }


    // Collectible Rings & Gems with Drift Multiplier
    items.forEach((o) => {
      if (o.taken || Math.abs(o.s - dist) > CAR_LEN) return;
      const ds = o.s - dist, dl = o.lat - latC;
      if (Math.abs(ds * ca + dl * sa) < CAR_LEN / 2 + ITEM_R && Math.abs(-ds * sa + dl * ca) < CAR_W / 2 + ITEM_R) {
        if (o.diag && Math.abs(ends.front - ends.rear) < DIAG_MIN) return;
        o.taken = true;
        o.mesh.visible = false;
        const awardedPoints = Math.round(o.pts * driftCombo);
        score += awardedPoints;
        sound.point(o.level);
        if (o.diag) hud.showStunt(`DRIFT DIAGONAL! +${awardedPoints}`);
      }
    });
  }

  // Camera positioning
  function placeCamera() {
    const camTarget = V(...CAM_TARGET);
    const camOffset = V(...CAM_OFFSET);
    const camLook = V(0, 0, 0);

    camLook.set(
      pose.x + Math.cos(camH) * camTarget.x - Math.sin(camH) * camTarget.z,
      camTarget.y + camLift,
      pose.z + Math.sin(camH) * camTarget.x + Math.cos(camH) * camTarget.z
    );

    camera.position.set(
      pose.x + Math.cos(camH) * (camTarget.x + camOffset.x) - Math.sin(camH) * (camTarget.z + camOffset.z),
      camTarget.y + camOffset.y + camLift,
      pose.z + Math.sin(camH) * (camTarget.x + camOffset.x) + Math.cos(camH) * (camTarget.z + camOffset.z)
    );

    if (shake > 0.001) {
      camera.position.x += (Math.random() * 2 - 1) * shake * 0.4;
      camera.position.y += (Math.random() * 2 - 1) * shake * 0.6;
      camera.position.z += (Math.random() * 2 - 1) * shake * 0.4;
    }

    camera.lookAt(camLook);
  }

  function cycleSkin() {
    currentSkinIdx = (currentSkinIdx + 1) % skinKeys.length;
    applyTrainSkin(skinKeys[currentSkinIdx]);
    hud.showStunt(`PINTURA: ${SKINS[skinKeys[currentSkinIdx]].name.toUpperCase()}`);
  }

  // ---------- KEYBOARD & CONTROLS SETUP ----------
  const keyboard = new KeyboardController({
    onMoveFront: (dir) => {
      if (mode !== 'playing') return;
      const currIdx = TRACKS.indexOf(moves.front.to);
      const nextIdx = Math.max(0, Math.min(TRACKS.length - 1, currIdx + dir));
      setTarget('front', TRACKS[nextIdx]);
    },
    onMoveRear: (dir) => {
      if (mode !== 'playing') return;
      const currIdx = TRACKS.indexOf(moves.rear.to);
      const nextIdx = Math.max(0, Math.min(TRACKS.length - 1, currIdx + dir));
      setTarget('rear', TRACKS[nextIdx]);
    },
    onStraighten: () => {
      if (mode !== 'playing') return;
      setTarget('rear', moves.front.to);
    },
    onCenter: () => {
      if (mode !== 'playing') return;
      setTarget('front', 0);
      setTarget('rear', 0);
    },
    onHorn: blowHorn,
    onCycleSkin: cycleSkin,
    onAction: () => {
      if (mode === 'ready') startGame();
      else if (mode === 'over') resetGame();
      else if (mode === 'paused') togglePause();
      else if (mode === 'playing') blowHorn();
    },
    onPause: togglePause,
    onMute: () => {
      const active = sound.toggleSound();
      hud.setSoundActive(active);
    }
  });

  function blowHorn() {
    if (mode === 'playing') {
      sound.horn();
      hud.showStunt('📢 APITO DA LOCOMOTIVA!');
      emitSparks(car.position.clone().add(V(0, ROOF_Y + 0.3, 0)), 12, -speed * 0.1);
    }
  }

  function togglePause() {
    if (mode === 'playing') {
      mode = 'paused';
      hud.showPause(true);
    } else if (mode === 'paused') {
      mode = 'playing';
      hud.showPause(false);
      lastTime = performance.now();
    }
  }

  function startGame() {
    hud.hideTutorial();
    mode = 'playing';
  }

  function resetGame() {
    segs.forEach(disposeSeg);
    segs.length = 0;
    dist = 0;
    speed = SPEED_START;
    score = 0;
    driftTime = 0;
    driftCombo = 1.0;
    ['front', 'rear'].forEach((e) => {
      ends[e] = 0;
      Object.assign(moves[e], { from: 0, to: 0, t: 1, h0: 0, airT: 0 });
      sag[e].x = sag[e].v = 0;
      riding[e] = null;
    });
    roll.x = roll.v = 0;
    shake = 0;
    jump.on = false;
    camH = 0;
    lands.length = 0;
    initTrack();
    hud.hideGameOver();
    mode = 'playing';
  }

  document.getElementById('start-game-btn')?.addEventListener('click', startGame);
  document.getElementById('retry-btn')?.addEventListener('click', resetGame);
  document.getElementById('resume-btn')?.addEventListener('click', () => {
    if (mode === 'paused') togglePause();
  });
  document.getElementById('horn-btn')?.addEventListener('click', blowHorn);
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('skin-toggle-btn')?.addEventListener('click', cycleSkin);
  document.getElementById('sound-btn')?.addEventListener('click', () => {
    const active = sound.toggleSound();
    hud.setSoundActive(active);
  });

  // ---------- MAIN ENGINE LOOP (60 FPS) ----------
  initTrack();
  applyTrainSkin(skinKeys[currentSkinIdx]);

  let lastTime = performance.now();
  function gameLoop(now) {
    let dt = Math.max(0, Math.min((now - lastTime) / 1000, 1 / 30));
    lastTime = now;

    if (mode === 'paused') {
      renderer.render(scene, camera);
      requestAnimationFrame(gameLoop);
      return;
    }

    // Bullet-time slow motion during aerial stunts for cinematic feel
    if (jump.on && jump.t / jump.T > 0.3 && jump.t / jump.T < 0.7) {
      dt *= 0.65;
    }

    if (mode === 'playing') {
      speed = Math.min(SPEED_MAX, speed + SPEED_ACCEL * dt);
      dist += speed * dt;
      blurSpan = speed * dt;
      stepMoves(dt);

      // Track Continuous Drift Combo
      const isDiagonal = Math.abs(ends.front - ends.rear) >= TRACK_SPACING * 0.7;
      if (isDiagonal && !jump.on) {
        driftTime += dt;
        driftCombo = Math.min(4.0, 1.0 + driftTime * 0.6);
        const comboStep = Math.floor(driftCombo);
        if (comboStep > lastComboStep) {
          lastComboStep = comboStep;
          sound.driftComboRise(comboStep);
        }
        hud.updateDriftCombo(driftCombo, (driftTime % 1.5) * 66.6);

        // Emit physical sparks from wheels during drift
        const bogieF = car.userData.bogies[0];
        emitSparks(bogieF.position.clone().add(car.position), 2, -speed * 0.3);
      } else {
        driftTime = Math.max(0, driftTime - dt * 2.5);
        if (driftTime === 0) {
          driftCombo = 1.0;
          lastComboStep = 1;
        }
        hud.updateDriftCombo(driftCombo, 0);
      }

      // Wheel rail clack rhythm
      if (Math.floor(dist / 25) !== Math.floor((dist - speed * dt) / 25)) {
        sound.clack();
      }
    } else if (mode === 'crash') {
      stepCrash(dt);
    }

    maintainTrack();
    stepSprings(dt);
    updateSparks(dt);

    if (mode === 'playing' || mode === 'ready') {
      const pc = pathAt(dist);
      const slant = Math.asin(Math.max(-1, Math.min(1, (ends.front - ends.rear) / (BOGIE * 2))));
      const half = BOGIE * Math.cos(slant);
      const pf = pathAt(dist + half), pr = pathAt(dist - half);
      const wf = offsetPt(pf, ends.front), wr = offsetPt(pr, ends.rear);
      const cx = (wf.x + wr.x) / 2, cz = (wf.z + wr.z) / 2;
      const yaw = Math.atan2(wf.z - wr.z, wf.x - wr.x);

      // Ramp detection
      const rh = { front: 0, rear: 0 };
      if (!jump.on) {
        const sOf = { front: dist + half, rear: dist - half };
        ['front', 'rear'].forEach((end) => {
          const r = rampAt(sOf[end], ends[end]);
          if (r) rh[end] = ((RAMP_H * (sOf[end] - r.s)) / RAMP_LEN) * Math.min(1, 2 * (1 - Math.abs(ends[end] - r.tz) / RAMP_HIT));
        });
        ['front', 'rear'].forEach((end) => {
          const prev = riding[end], r = rampAt(sOf[end], ends[end]);
          if (!jump.on && prev && !r && sOf[end] - prev.s > RAMP_LEN && Math.abs(ends[end] - prev.tz) < RAMP_HIT) {
            const other = end === 'front' ? 'rear' : 'front';
            const p0 = Math.atan2(end === 'front' ? RAMP_H - rh.rear : rh.front - RAMP_H, BOGIE * 2);
            launch(end, prev, (RAMP_H + rh[other]) / 2, p0);
          }
          riding[end] = r;
        });
      }

      let jy = 0, jPitch = 0;
      if (jump.on) {
        jump.t += dt;
        if (jump.t >= jump.T) {
          jump.on = false;
          landJump();
        } else {
          jy = jump.y0 + jump.vy * jump.t - (JUMP_G * jump.t * jump.t) / 2;
          const k = jump.t / jump.T;
          jPitch = jump.p0 * (1 - k) * (1 - k);
          if (!jump.spin) jPitch += Math.atan2(jump.vy - JUMP_G * jump.t, speed) * JUMP_PITCH * Math.sin(Math.PI * k);
        }
      }

      camLift = jy * CAM_JUMP_FOLLOW;
      pose.air = jy;

      const lf = Math.max(liftOf('front'), rh.front), lr = Math.max(liftOf('rear'), rh.rear);
      qYaw.setFromAxisAngle(UP, -yaw);
      qPitch.setFromAxisAngle(FLIP_AXIS, Math.atan2(lf - lr, BOGIE * 2) + jPitch);
      car.quaternion.copy(qYaw).multiply(qPitch);
      car.position.set(cx, (lf + lr) / 2 + jy, cz);

      // Stunt rotation (Axial Roll or Vertical Flip)
      if (jump.on) {
        const k = jump.t / jump.T, e = k * k * (3 - 2 * k);
        if (jump.spin) qSpin.setFromAxisAngle(SPIN_AXIS, jump.dir * Math.PI * 2 * e);
        else qSpin.setFromAxisAngle(FLIP_AXIS, FLIP_DIR * Math.PI * 2 * FLIP_TURNS * e);
        pivA.set(0, SPIN_PIVOT_Y, 0).applyQuaternion(car.quaternion);
        car.quaternion.multiply(qSpin);
        pivB.set(0, SPIN_PIVOT_Y, 0).applyQuaternion(car.quaternion);
        car.position.add(pivA).sub(pivB);
      }

      // Suspension reactions
      const body = car.userData.body, sf = sag.front.x, sr = sag.rear.x;
      body.position.y = BODY_Y + (sf + sr) / 2;
      body.rotation.z = Math.atan2(sf - sr, BOGIE * 2);
      body.rotation.x = roll.x;

      // Wheel spin
      const turn = -(dist / WHEEL_R) % (Math.PI * 2);
      car.userData.wheelsets.forEach((w) => { w.rotation.z = turn; });

      // Bogie steering
      const [bf, br] = car.userData.bogies;
      bf.rotation.y = yaw - pf.h - Math.atan(slopeOf('front'));
      br.rotation.y = yaw - pr.h - Math.atan(slopeOf('rear'));

      Object.assign(pose, { x: cx, z: cz, h: pc.h, yaw });
      checkHits(half, slant, lf, lr, jy);

      camH += Math.atan2(Math.sin(pc.h - camH), Math.cos(pc.h - camH)) * Math.min(1, dt * 5);
      placeCamera();
      placeTies();

      sun.target.position.set(cx, 0, cz);
      sun.position.set(cx, 0, cz).add(SUN_OFFSET);
      ground.position.set(cx, -0.01, cz);
    } else if (mode === 'crash') {
      car.quaternion.copy(rb.q);
      car.position.copy(rb.p);
      placeCamera();
    }

    bg.position.set(camera.position.x, 0, camera.position.z);
    renderer.render(scene, camera);

    const isDiagonal = Math.abs(ends.front - ends.rear) >= TRACK_SPACING * 0.7;
    hud.update(score, best, speed * 3.6, moves.front.to, moves.rear.to, isDiagonal);
    requestAnimationFrame(gameLoop);
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  onResize();

  requestAnimationFrame(gameLoop);
})();
