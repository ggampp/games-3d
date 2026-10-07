/**
 * Acrobatic Train 3D - High-Octane Engine & Gameplay Coordinator
 * Features:
 * - Three.js WebGL with PBR & Volumetric Lighting
 * - Dynamic Physical Spark Particles on Rails & Drift
 * - Overhead Electrical Catenaries & Realistic Ballast
 * - Interactive Railroad Switch Tracks (Chaves de Desvio)
 * - Train Shop, finite phase-one slice and independent infinite mode
 * - Continuous Drift Combo Multiplier (x1 to x4)
 * - Fixed-step motion, visual interpolation and run-scoped asynchronous scoring
 * - TypeSafe Jev AI Stunt Judge & Telemetry Analyzer
 */

import { sound } from './audio.js';
import { KeyboardController } from './keyboard.js';
import { HudManager } from '../ui/hud.js';
import { TRAIN_CATALOG, buildTrainBody, buildCarriage, SteamSmokeEmitter } from '../entities/train-factory.js';
import { ShopState, getTrainGameplayProfile } from './shop-state.js';
import { FixedClock } from './fixed-clock.js';
import { createRng } from './rng.js';
import { RunSession } from '../levels/campaign.js';
import { LEVEL_ONE, LEVELS, getLevel, createLevelContent, getWarning } from '../levels/level-config.js';
import { ProgressStore } from './progress-store.js';
import { CampaignUi } from '../ui/campaign-ui.js';
import { createWorkBarrier, OBSTACLE_MESHES } from '../entities/obstacles.js';
import { HazardWorld } from '../physics/hazards.js';
import { stepAcrobatics, TRAIN_GEOMETRY, JUMP_SETTINGS } from '../physics/acrobatics.js';
import { segAt, trackRetention } from '../entities/track.js';
import { ease, easeD, moveLift, targetMove, stepMove } from '../physics/train-motion.js';
import { gapUnder as containsGap, hitsBarrier, hitsPole, canCollect } from '../physics/collisions.js';
import { disposeObject } from '../scene/resources.js';
import { TransformInterpolation } from '../scene/interpolation.js';

(() => {
  'use strict';

  // ---------- CONSTANTS & GEOMETRY SPECS ----------
  let TRACK_BEHIND = 60;
  const TRACK_AHEAD = 700;
  const TIE_BACK = 30;
  const TIE_FRONT = 150;
  const STRAIGHT_TIME = [4, 6.5];
  const CURVE_R_MIN = 45, CURVE_R_MAX = 110;
  const CURVE_DEG_MIN = 20, CURVE_DEG_MAX = 60;
  const GAUGE = 1.0;
  const TRACK_SPACING = TRAIN_GEOMETRY.trackSpacing;
  const TRACKS = [-TRACK_SPACING, 0, TRACK_SPACING];
  const SLEEPER_STEP = 0.5;
  const BALLAST_H = 0.18;
  const BALLAST_U = 1.5;
  const RAIL_BASE = 0.23;
  const RAIL_H = 0.14;
  const RAIL_TOP = RAIL_BASE + RAIL_H;

  const BLUR_N = 5;
  const BLUR_A = 1 - Math.pow(0.05, 1 / BLUR_N);

  // Train Carriage Geometry
  const BOGIE = TRAIN_GEOMETRY.bogie;
  const CAR_LEN = TRAIN_GEOMETRY.carLength;
  const CAR_W = TRAIN_GEOMETRY.carWidth;
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
  const HOP = 0.9;
  const AIR_MAX = 0.5;
  const AIR_FADE = 0.15;

  // Jump Ramps & Stunt Lines
  const RAMP_LEN = JUMP_SETTINGS.rampLength;
  const RAMP_H = JUMP_SETTINGS.rampHeight;
  const RAMP_W = GAUGE + 0.7;
  const RAMP_HIT = JUMP_SETTINGS.rampHit;
  const RAMP_END_MARGIN = 15;
  const LINE_AIR1 = 4;
  const LINE_AIR2 = LINE_AIR1 * 2;
  const JUMP_G = JUMP_SETTINGS.gravity;
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
  let trackRandom = createRng('infinite-initial');
  const trackRnd = (a, b) => a + trackRandom() * (b - a);
  const trackPick = arr => arr[Math.floor(trackRandom() * arr.length)];

  // ---------- GAME STATE & HUD ----------
  const hud = new HudManager();
  const clock = new FixedClock();
  const interpolation = new TransformInterpolation();
  let storage = null;
  try { storage = window.localStorage; } catch { /* Play in memory if storage is unavailable. */ }
  const shop = new ShopState(storage);
  const progress = new ProgressStore(storage);
  const run = new RunSession({ canStartLevel: level => progress.canPlay(level.id) && getLevel(level.id) === level });
  const campaignUi = new CampaignUi(hud, progress, LEVELS);
  let selectedLevelId = progress.continueLevelId();
  let selectedMode = 'campaign';
  let activeLevel = LEVEL_ONE;
  let activeProfile = getTrainGameplayProfile(shop.selected, activeLevel);
  const pendingJudges = new Set();
  let levelContent = null;
  let hazardWorld = new HazardWorld({}, TRAIN_GEOMETRY);
  let uiCommands = [];
  let renderedFrames = 0;
  let animationFrame = 0;
  let destroyed = false;
  const present = callback => uiCommands.push({ runId: run.state.runId, callback });
  let speed = activeProfile.startSpeedMps;
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

  let bankPoints = shop.bank;
  let unlockedTrains = shop.owned;
  let currentTrainId = shop.selected;
  best = shop.best;

  function syncShop() {
    bankPoints = shop.bank; unlockedTrains = shop.owned; best = shop.best;
  }

  function addPoints(pts, source = 'pickup', eventId = run.eventId(source), deterministic = true) {
    if (run.state.mode !== 'playing') return 0;
    const mult = activeProfile.bonusMultiplier;
    const earned = Math.round(pts * mult);
    if (!shop.awardPoints({ eventId, runId: run.state.runId, amount: earned, source })) return 0;
    run.addScore(earned, { deterministic }); score = run.score;
    syncShop();
    return earned;
  }

  // Bogie End States
  const ends = { front: 0, rear: 0 };
  const moves = {
    front: { value: 0, from: 0, to: 0, t: 1, h0: 0, airT: 0 },
    rear: { value: 0, from: 0, to: 0, t: 1, h0: 0, airT: 0 }
  };
  const riding = { front: null, rear: null };
  const jump = { on: false, t: 0, T: 1, y0: 0, vy: 0, spin: false, dir: 1, p0: 0 };
  const sag = { front: { x: 0, v: 0 }, rear: { x: 0, v: 0 } };
  const roll = { x: 0, v: 0 };
  const rb = { p: V(0, 0, 0), v: V(0, 0, 0), q: new THREE.Quaternion(), w: V(0, 0, 0) };

  // Pose representation
  const pose = { x: 0, z: 0, h: 0, yaw: 0, mx: 0, mz: 0, ma: 0, air: 0 };
  const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), qSpin = new THREE.Quaternion();
  const pivA = V(0, 0, 0), pivB = V(0, 0, 0);

  // Slope and lift helpers
  const slopeOf = (end) => {
    const m = moves[end];
    return m.t >= 1 ? 0 : ((m.to - m.from) * easeD(m.t)) / (speed * activeProfile.crossTimeS);
  };
  const liftOf = (end) => {
    return moveLift(moves[end], { hop: HOP, airMax: AIR_MAX, airFade: AIR_FADE });
  };

  function setTarget(end, track) {
    if (!targetMove(moves[end], track, HOP)) return;
    sound.hop();
  }

  function stepMoves(dt) {
    ['front', 'rear'].forEach((end) => {
      const m = moves[end];
      const landed = stepMove(m, dt, activeProfile.crossTimeS);
      ends[end] = m.value;
      if (landed && !jump.on) onLand(end, Math.sign(m.to - m.from));
    });
  }

  function onLand(end, dir) {
    sag[end].v -= SAG_HIT;
    roll.v += dir * ROLL_HIT;
    shake = Math.min(shake + SHAKE_HIT, SHAKE_HIT * 1.6);
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
  renderer.shadowMap.enabled = !window.__TRAIN_TEST_CONFIG__?.disableShadows;
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

  const ramps = [], poles = [], items = [], gaps = [], barriers = [], hazardMeshes = [];

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
      o.dispose?.();
      const i = arr.indexOf(o);
      if (i >= 0) arr.splice(i, 1);
    });
    drop(seg.ramps, ramps);
    drop(seg.poles, poles);
    drop(seg.items, items);
    drop(seg.gaps, gaps);
    drop(seg.barriers, barriers);
    drop(seg.hazards, hazardMeshes);
  }

  const newSeg = (s0, len, x0, z0, h0, k) => ({
    s0, len, x0, z0, h0, k,
    ramps: [], poles: [], items: [], gaps: [], barriers: [], hazards: [], meshes: []
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
  const gapUnder = (lat, s) => containsGap(gaps, lat, s, RAMP_HIT);

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
    return o;
  }

  function addGap(seg, tz, a, b) {
    const g = { tz, a, b };
    seg.gaps.push(g);
    gaps.push(g);
  }

  const PATTERNS = {
    ramp(seg, s, end) {
      const lip = s + RAMP_LEN;
      const level = trackRandom() < 0.5 ? 2 : 1;
      const len = RAMP_LEN + 25;
      if (s + len > end) return 0;
      const tz = trackPick(TRACKS);
      addRamp(seg, s, tz);
      if (trackRandom() < RAMP_GAP_RATE) addGap(seg, tz, lip + 1, lip + 1 + trackRnd(RAMP_GAP_MIN, RAMP_GAP_MAX));
      for (let i = 0; i < 5; i++) addItem(seg, lip + 10 + i * 4, tz, level);
      return len;
    },
    gap(seg, s, end) {
      const len = trackRnd(GAP_MIN, GAP_MAX);
      if (s + len > end) return 0;
      const order = TRACKS.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(trackRandom() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const n = trackRandom() < 0.5 ? 2 : 1;
      order.slice(0, n).forEach((tz) => addGap(seg, tz, s, s + len));
      for (let x = s + 1; x < s + len; x += ITEM_STEP) addItem(seg, x, order[n], 0);
      return len;
    },
    poles(seg, s, end) {
      const n = Math.floor(trackRnd(POLE_MIN_N, 7)), len = (n - 1) * POLE_STEP;
      if (s + len > end) return 0;
      const half = TRACK_SPACING / 2;
      const lats = trackRandom() < 0.5 ? [-half, half] : [trackPick([-half, half])];
      lats.forEach((lat) => {
        for (let i = 0; i < n; i++) addPole(seg, s + i * POLE_STEP, lat);
      });
      const tz = trackPick(TRACKS);
      for (let x = s; x <= s + len; x += ITEM_STEP) addItem(seg, x, tz, 0);
      return len;
    },
    items(seg, s, end) {
      const len = (ITEM_ROW - 1) * ITEM_STEP;
      if (s + len > end) return 0;
      const tz = trackPick(TRACKS);
      for (let i = 0; i < ITEM_ROW; i++) addItem(seg, s + i * ITEM_STEP, tz, 0);
      return len;
    },
    diag(seg, s, end) {
      const len = (ITEM_ROW - 1) * ITEM_STEP;
      if (s + len > end) return 0;
      const lat = trackPick([-1, 1]) * (TRACK_SPACING / 2);
      for (let i = 0; i < ITEM_ROW; i++) addItem(seg, s + i * ITEM_STEP, lat, 0, true, DIAG_POINTS);
      return len;
    }
  };

  function placeHazards(seg, from) {
    const end = seg.s0 + seg.len - RAMP_END_MARGIN;
    for (let s = Math.max(from, SAFE_START); s < end; ) {
      const names = ['ramp', 'gap', 'poles', 'items', 'diag'];
      const name = trackPick(names);
      const used = PATTERNS[name](seg, s, end);
      const next = used ? trackRnd(15, 30) : 10;
      s += (used || 5) + next;
    }
  }

  function addSeg() {
    const last = segs[segs.length - 1];
    const e = segAt(last, last.len);
    let len, k = 0;
    if (last.k === 0) {
      const r = trackRnd(CURVE_R_MIN, CURVE_R_MAX), ang = THREE.MathUtils.degToRad(trackRnd(CURVE_DEG_MIN, CURVE_DEG_MAX));
      k = (trackRandom() < 0.5 ? -1 : 1) / r;
      len = ang * r;
    } else {
      len = trackRnd(STRAIGHT_TIME[0], STRAIGHT_TIME[1]) * 35;
    }
    const seg = newSeg(last.s0 + last.len, len, e.x, e.z, e.h, k);
    placeHazards(seg, seg.s0 + trackRnd(10, 25));
    buildSeg(seg);
    segs.push(seg);
  }

  function maintainTrack() {
    if (activeLevel) return;
    let last = segs[segs.length - 1];
    while (last.s0 + last.len < dist + TRACK_AHEAD) {
      addSeg();
      last = segs[segs.length - 1];
    }
    while (segs.length > 1 && segs[0].s0 + segs[0].len < dist - TRACK_BEHIND) {
      disposeSeg(segs.shift());
    }
  }

  /** M3 families: the mesh samples the same simulation-time state the HazardWorld collides with. */
  function addHazard(seg, family, data) {
    const asset = OBSTACLE_MESHES[family](THREE, data), point = segAt(seg, data.s - seg.s0);
    asset.group.position.set(point.x, 0, point.z); asset.group.rotation.y = -point.h; scene.add(asset.group);
    const object = { family, data, s: data.s, mesh: asset.group, movers: asset.movers, update: asset.update, dispose: asset.dispose, phase: asset.update(run.timeS) };
    hazardMeshes.push(object); seg.hazards.push(object);
  }

  function updateHazards() {
    for (const hazard of hazardMeshes) {
      const phase = hazard.update(run.timeS), near = hazard.s > dist && hazard.s - dist < 160;
      if (mode === 'playing' && near && phase !== hazard.phase) {
        if (hazard.family === 'gate' && phase === 'warning') sound.gateBell();
        if (hazard.family === 'wagon' && phase === 'entering') sound.wagonAlert();
      }
      hazard.phase = phase;
    }
  }

  function initTrack() {
    levelContent = null; hazardWorld = new HazardWorld({}, TRAIN_GEOMETRY);
    if (activeLevel) {
      const seg = newSeg(-TRACK_BEHIND - 10, TRACK_BEHIND + 10 + activeLevel.lengthM + 100, -TRACK_BEHIND - 10, 0, 0, 0);
      const content = createLevelContent(activeLevel);
      levelContent = content; hazardWorld = new HazardWorld(content, TRAIN_GEOMETRY);
      for (const gate of content.gates) addHazard(seg, 'gate', gate);
      for (const gantry of content.gantries) addHazard(seg, 'gantry', gantry);
      for (const wagon of content.wagons) addHazard(seg, 'wagon', wagon);
      for (const gap of content.gaps) addGap(seg, gap.lane * TRACK_SPACING, gap.a, gap.b);
      for (const ramp of content.ramps) addRamp(seg, ramp.s, ramp.lane * TRACK_SPACING);
      for (const pole of content.poles) addPole(seg, pole.s, pole.lat);
      for (const block of content.barriers) {
        const asset = createWorkBarrier(THREE, block);
        const point = offsetPt(segAt(seg, block.s - seg.s0), block.lane * TRACK_SPACING);
        asset.group.position.set(point.x, 0, point.z); scene.add(asset.group);
        const object = { ...block, lat: block.lane * TRACK_SPACING, mesh: asset.group, dispose: asset.dispose };
        barriers.push(object); seg.barriers.push(object);
      }
      for (const item of content.items) {
        const object = addItem(seg, item.s, item.lane * TRACK_SPACING, item.level, false, item.points);
        object.id = item.id;
        object.y = item.y; object.mesh.position.y = item.y;
      }
      buildSeg(seg); segs.push(seg); return;
    }
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

  let currentTrainBodyGroup = null;
  let currentTrainDisposables = null;
  let smokeEmitter = null;
  let carriages = [];
  let bodyPivot = null;

  function applyTrainModel(trainId) {
    if (!TRAIN_CATALOG[trainId]) trainId = 'cyber';
    TRACK_BEHIND = trackRetention(TRAIN_CATALOG[trainId].maxCars, CAR_LEN);
    const constants = {
      CAR_LEN, CAR_W, SIDE_H, BODY_Y, ROOF_Y, BOGIE, GAUGE, RAIL_TOP, WHEEL_R, WC
    };

    // 1. Clean disposal of previous train body assets (Rule 4 compliant)
    if (currentTrainBodyGroup && bodyPivot) {
      bodyPivot.remove(currentTrainBodyGroup);
      if (currentTrainDisposables) {
        new Set(currentTrainDisposables.geometries).forEach(g => g.dispose());
        new Set(currentTrainDisposables.materials).forEach(m => m.dispose());
      }
      currentTrainBodyGroup = null;
      currentTrainDisposables = null;
    }

    if (smokeEmitter) {
      smokeEmitter.dispose();
      smokeEmitter = null;
    }

    // 2. Clean disposal of existing carriages
    carriages.forEach((c) => {
      scene.remove(c.mesh);
      disposeObject(c.mesh);
    });
    carriages = [];

    // 3. Assemble new 3D train body using TrainFactory
    const { group, meta, disposables } = buildTrainBody(trainId, constants);
    group.position.y = -BODY_Y;
    if (bodyPivot) bodyPivot.add(group);
    currentTrainBodyGroup = group;
    currentTrainDisposables = disposables;

    // 4. Smoke emitter for steam locomotive (Maria-fumaça)
    if (meta.chimneyPos && (trainId === 'steam' || TRAIN_CATALOG[trainId]?.hasSmoke)) {
      smokeEmitter = new SteamSmokeEmitter(scene, meta.chimneyPos);
    }

    // 5. Instantiate trailing carriages (e.g. 12 cars for Southeastern Class 395!)
    const totalCars = TRAIN_CATALOG[trainId]?.maxCars || 1;
    for (let i = 1; i < totalCars; i++) {
      const cMesh = buildCarriage(trainId, i, totalCars, constants);
      cMesh.visible = false;
      scene.add(cMesh);
      carriages.push({
        index: i,
        mesh: cMesh,
        offsetDist: i * (CAR_LEN + 0.5)
      });
    }

    hud.updateSkinDisplay(trainId, {
      name: TRAIN_CATALOG[trainId].name,
      accentColor: TRAIN_CATALOG[trainId].accentColor
    });
  }

  function makeCar() {
    const car = new THREE.Group();
    bodyPivot = new THREE.Group();
    bodyPivot.position.y = BODY_Y;
    car.add(bodyPivot);

    const bogies = [makeBogie(), makeBogie()];
    bogies[0].position.x = BOGIE;
    bogies[1].position.x = -BOGIE;
    bogies.forEach((b) => car.add(b));

    car.userData.body = bodyPivot;
    car.userData.bogies = bogies;
    car.userData.wheelsets = bogies.flatMap((b) => b.userData.wheelsets);

    applyTrainModel(currentTrainId);

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
    const runId = run.state.runId;
    const eventId = run.eventId('judge');
    const controller = new AbortController();
    pendingJudges.add(controller);
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
        body: JSON.stringify(telemetry),
        signal: controller.signal
      });

      if (res.ok) {
        const data = await res.json();
        if (!Number.isFinite(data.bonus)) return;
        run.deliver(runId, eventId, () => {
          const bonus = addPoints(Math.max(0, Math.min(100, Math.round(data.bonus))), 'judge', eventId, false);
          present(() => hud.showStunt(`${String(data.title || 'MANOBRA')}! +${bonus}`));
          sound.stunt();
        });
      }
    } catch {
      // Non-blocking fallback
    } finally {
      pendingJudges.delete(controller);
    }
  }

  function launch(event) {
    const isDiagonal = event.spin;
    sound.launch(isDiagonal);

    const stuntName = isDiagonal ? 'BARREL ROLL 360°' : 'BACKFLIP VERTICAL';
    const pts = addPoints(Math.round(50 * driftCombo));
    present(() => hud.showStunt(`${stuntName}! +${pts}`));
    sound.stunt();

    // Trigger TypeSafe Jev AI Stunt Evaluation
    evaluateStuntWithJev(stuntName, event.duration, event.peak);
  }

  function landJump() {
    if (run.state.mode === 'playing') run.metrics.stuntsLanded += 1;
    riding.front = riding.rear = null;
    ['front', 'rear'].forEach((e) => {
      sag[e].v -= SAG_HIT * JUMP_LAND;
    });
    shake = SHAKE_HIT * 1.8;
    if (mode === 'playing') sound.bigLand();
  }

  // ---------- CRASH PHYSICS & GAME OVER ----------
  function triggerCrash(reason) {
    if (!run.crash(reason)) return;
    sound.crash();
    mode = run.state.mode;
    for (const controller of pendingJudges) controller.abort();
    shake = SHAKE_HIT * 3;

    car.updateMatrixWorld(true);
    car.localToWorld(rb.p.set(0, COM_Y, 0));
    rb.q.copy(car.quaternion);
    const fx = Math.cos(pose.yaw), fz = Math.sin(pose.yaw);
    rb.v.set(fx * speed, jump.on ? jump.vy - JUMP_G * jump.t : 0, fz * speed);
    jump.on = false;

    rb.w.set(rnd(-2, 2), rnd(2, 5), rnd(-2, 2));

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

  const HAZARD_CRASH = {
    gate: { default: 'A cancela fechada atingiu o trem! Leia o sinal e use a via sem cancela.', post: 'O trem raspou no poste da cancela! Troque de via antes dela.' },
    gantry: { default: 'O trem bateu na lateral do pórtico! Alinhe frente e traseira na abertura.', roof: 'O trem bateu no teto do pórtico! Não salte dentro da abertura.' },
    wagon: { default: 'Colisão com o vagão de manutenção! Desvie para o lado oposto ao que ele vem.' },
  };

  // Hit testing & Switches
  function checkHits(half, slant, lf, lr, jy) {
    if (run.state.mode !== 'playing') return;
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
    const bottom = jy + Math.min(lf, lr);

    const collisionPose = { dist, front: ends.front, rear: ends.rear, slant, bottom };
    for (const block of barriers) {
      if (hitsBarrier(block, collisionPose, TRAIN_GEOMETRY)) {
        triggerCrash('Colisão com a barreira de obras! Desvie e alinhe os dois truques.'); return;
      }
    }

    for (const p of poles) {
      if (Math.abs(p.s - dist) < CAR_LEN && bottom < POLE_H) {
        if (hitsPole(p, collisionPose, TRAIN_GEOMETRY)) {
          triggerCrash('Colisão lateral violenta com o poste entre os trilhos!');
          return;
        }
      }
    }

    const hazardHit = hazardWorld.check({ ...collisionPose, top: jy + Math.max(lf, lr) + TRAIN_GEOMETRY.bodyHeight, timeS: run.timeS });
    if (hazardHit) { triggerCrash(HAZARD_CRASH[hazardHit.family][hazardHit.part] || HAZARD_CRASH[hazardHit.family].default); return; }


    // Collectible Rings & Gems with Drift Multiplier
    items.forEach((o) => {
      if (o.taken || Math.abs(o.s - dist) > CAR_LEN) return;
      const ds = o.s - dist, dl = o.lat - latC;
      if (canCollect(o, { dist, front: ends.front, rear: ends.rear, slant, bottom }, { carLength: CAR_LEN, carWidth: CAR_W, itemRadius: ITEM_R, bodyHeight: ROOF_Y, diagonalMin: DIAG_MIN })) {
        if (o.diag && Math.abs(ends.front - ends.rear) < DIAG_MIN) return;
        o.taken = true;
        run.metrics.items += 1;
        if (o.level > 0) run.metrics.aerialItems += 1;
        o.mesh.visible = false;
        const awardedPoints = addPoints(Math.round(o.pts * driftCombo), 'pickup', `${run.state.runId}:item:${o.id || o.s + ':' + o.lat + ':' + o.y}`);
        sound.point(o.level);
        if (o.diag) present(() => hud.showStunt(`DRIFT DIAGONAL! +${awardedPoints}`));
      }
    });
  }

  // Camera positioning - Perfectly centered chase camera on mobile/portrait
  function placeCamera() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const aspect = window.innerWidth / window.innerHeight;

    let targetX = 4.0;
    let targetY = 0.8;
    let distBack = -13.5;
    let heightUp = 4.3;
    let lateralOffset = 0;

    if (isPortrait) {
      // In portrait: zero lateral offset keeps the central track at exact 50% screen width
      targetX = 5.5;
      targetY = 0.5;
      distBack = -18.0;
      heightUp = 6.0;
      lateralOffset = 0;

      if (camera.fov !== 62) {
        camera.fov = 62;
        camera.updateProjectionMatrix();
      }
    } else {
      // In landscape: centered or subtle balanced perspective
      targetX = 4.0;
      targetY = 0.8;
      distBack = -13.5;
      heightUp = 4.3;
      lateralOffset = aspect > 1.6 ? 1.4 : 0;

      if (camera.fov !== 55) {
        camera.fov = 55;
        camera.updateProjectionMatrix();
      }
    }

    const camTarget = V(targetX, targetY, 0);
    const camOffset = V(distBack, heightUp, lateralOffset);
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
    onStoreToggle: () => toggleStore(),
    onAction: () => {
      if (mode === 'over' || mode === 'levelComplete') resetGame();
      else if (mode === 'paused') togglePause();
      else if (mode === 'playing') blowHorn();
    },
    onPause: togglePause,
    onMute: () => {
      const active = sound.toggleSound();
      hud.setSoundActive(active);
    }
  });

  function cycleSkin() {
    const catalogKeys = Object.keys(TRAIN_CATALOG);
    const unlocked = catalogKeys.filter((k) => unlockedTrains.includes(k) || TRAIN_CATALOG[k].price === 0);
    const currIdx = unlocked.indexOf(shop.selected);
    const nextIdx = (currIdx + 1) % unlocked.length;
    equipTrain(unlocked[nextIdx]);
  }

  function blowHorn() {
    if (mode === 'playing') {
      const train = TRAIN_CATALOG[currentTrainId];
      sound.playWhistle(train?.whistleType || currentTrainId);
      hud.showStunt(`📢 APITO: ${train?.name?.toUpperCase() || 'LOCOMOTIVA'}!`);
      emitSparks(car.position.clone().add(V(0, ROOF_Y + 0.3, 0)), 12, -speed * 0.1);
    }
  }

  function renderStore() {
    syncShop();
    hud.renderStore(TRAIN_CATALOG, unlockedTrains, shop.selected, bankPoints, equipTrain, buyTrain);
  }

  function toggleStore(forceState) {
    if (mode === 'crash') return;
    const opening = forceState ?? (hud.storeModal?.hidden ?? true);
    if (opening) {
      run.pause('store'); mode = run.state.mode;
      renderStore(); hud.showStore(true); hud.showPause(false);
    } else {
      hud.showStore(false); run.resume('store'); mode = run.state.mode;
      hud.showPause(run.state.pauseReasons.has('manual')); clock.reset();
    }
  }

  function buyTrain(trainId) {
    if (!shop.buy(trainId)) return;
    sound.storePurchase(); equipTrain(trainId); renderStore();
  }

  function equipTrain(trainId) {
    if (!shop.equip(trainId)) return;
    if (mode === 'ready' || mode === 'over' || mode === 'levelComplete') {
      currentTrainId = shop.selected;
      activeProfile = getTrainGameplayProfile(currentTrainId, activeLevel);
      applyTrainModel(currentTrainId);
    }
    sound.playWhistle(TRAIN_CATALOG[trainId].whistleType || trainId);
    renderStore();
    hud.showStunt(mode === 'playing' || mode === 'paused' ? 'Trem selecionado para a próxima tentativa' : `EQUIPADO: ${TRAIN_CATALOG[trainId].name}`);
  }

  function togglePause() {
    if (!hud.storeModal.hidden) { toggleStore(false); return; }
    if (run.state.pauseReasons.has('manual')) run.resume('manual');
    else run.pause('manual');
    mode = run.state.mode;
    hud.showPause(run.state.pauseReasons.has('manual')); clock.reset();
  }

  function clearAttempt() {
    for (const controller of pendingJudges) controller.abort();
    pendingJudges.clear(); uiCommands = [];
    segs.forEach(disposeSeg); segs.length = 0;
    dist = 0; speed = activeProfile.startSpeedMps; score = 0;
    driftTime = 0; driftCombo = 1; lastComboStep = 1;
    for (const end of ['front', 'rear']) {
      ends[end] = 0;
      Object.assign(moves[end], { value: 0, from: 0, to: 0, t: 1, h0: 0, airT: 0 });
      sag[end].x = sag[end].v = 0; riding[end] = null;
    }
    roll.x = roll.v = 0; shake = 0; jump.on = false; camH = 0; camLift = 0;
    sparks.length = 0; interpolation.clear();
    Object.assign(pose, { x: 0, z: 0, h: 0, yaw: 0, air: 0 });
    currentTrainId = shop.selected; applyTrainModel(currentTrainId);
    trackRandom = createRng(activeLevel?.seed ?? `infinite:${run.state.runId}`);
    initTrack(); hud.hideGameOver(); hud.showLevelResult(false);
    hud.showPause(false); hud.showStore(false); clock.reset();
  }

  function startGame(type = selectedMode, levelId = selectedLevelId) {
    if (!['ready', 'over', 'levelComplete'].includes(run.state.mode) || !hud.storeModal.hidden) return;
    if (type === 'campaign' && !progress.canPlay(levelId)) return false;
    selectedMode = type; selectedLevelId = levelId;
    activeLevel = type === 'campaign' ? getLevel(levelId) : null;
    activeProfile = getTrainGameplayProfile(shop.selected, activeLevel);
    if (!run.start(activeProfile, activeLevel)) return;
    clearAttempt(); mode = run.state.mode; campaignUi.hide(); hud.hideTutorial(); hud.showRun(activeLevel);
    return true;
  }

  function resetGame() { startGame(selectedMode); }

  function returnToMenu() {
    run.stop(); mode = run.state.mode;
    activeLevel = selectedMode === 'campaign' ? getLevel(selectedLevelId) : null;
    activeProfile = getTrainGameplayProfile(shop.selected, activeLevel);
    clearAttempt(); campaignUi.hide(); hud.showTutorial(); hud.showRun(null); campaignUi.refreshMenu();
  }

  function openMap() {
    returnToMenu(); hud.hideTutorial(); run.state.showScreen('map'); campaignUi.showMap();
  }

  function chooseLevel(id) {
    if (!progress.canPlay(id) || !['ready', 'over', 'levelComplete'].includes(run.state.mode)) return false;
    selectedLevelId = id; campaignUi.showBriefing(getLevel(id)); hud.hideTutorial(); run.state.showScreen('briefing'); return true;
  }

  campaignUi.bind({ chooseLevel, openMap, menu: returnToMenu, start: () => startGame('campaign', selectedLevelId), next: () => chooseLevel(`level-0${Number(selectedLevelId.slice(-2)) + 1}`), infinite: () => startGame('infinite') });

  run.events.on('gameOver', snapshot => present(() => {
    shop.saveBest(snapshot.score); syncShop(); hud.showGameOver(snapshot.score, best, snapshot.reason);
  }));
  run.events.on('levelCompleted', snapshot => present(() => {
    const hadTrophy = progress.hasTrophy();
    progress.complete({ levelId: snapshot.levelId, score: snapshot.score, timeS: snapshot.timeS, eventId: `${snapshot.runId}:${snapshot.levelId}:complete` });
    const newTrophy = !hadTrophy && progress.hasTrophy();
    shop.saveBest(snapshot.score); syncShop(); campaignUi.showResult(snapshot, { newTrophy });
    if (newTrophy) sound.trophy(); else sound.stunt();
    for (const controller of pendingJudges) controller.abort();
  }));

  document.getElementById('start-game-btn')?.addEventListener('click', openMap);
  document.getElementById('start-infinite-btn')?.addEventListener('click', () => startGame('infinite'));
  document.getElementById('retry-btn')?.addEventListener('click', resetGame);
  document.getElementById('level-retry-btn')?.addEventListener('click', resetGame);
  document.getElementById('level-menu-btn')?.addEventListener('click', openMap);
  document.getElementById('over-menu-btn')?.addEventListener('click', returnToMenu);
  document.getElementById('pause-menu-btn')?.addEventListener('click', returnToMenu);
  document.getElementById('resume-btn')?.addEventListener('click', togglePause);
  document.getElementById('horn-btn')?.addEventListener('click', blowHorn);
  document.getElementById('pause-btn')?.addEventListener('click', togglePause);
  document.getElementById('skin-toggle-btn')?.addEventListener('click', cycleSkin);
  document.getElementById('sound-btn')?.addEventListener('click', () => hud.setSoundActive(sound.toggleSound()));
  hud.storeBtn?.addEventListener('click', () => toggleStore());
  document.getElementById('menu-store-btn')?.addEventListener('click', () => toggleStore(true));
  document.getElementById('pause-store-btn')?.addEventListener('click', () => toggleStore(true));
  hud.storeCloseBtn?.addEventListener('click', () => toggleStore(false));
  hud.storeBackBtn?.addEventListener('click', () => toggleStore(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { run.pause('manual'); mode = run.state.mode; hud.showPause(mode === 'paused'); }
    clock.reset();
  });

  // ---------- MAIN ENGINE LOOP (60 FPS) ----------
  initTrack();
  applyTrainModel(currentTrainId);
  hud.updateCoins(bankPoints);

  function stepWorld(dt) {
    mode = run.state.mode; speed = run.travel.speed; dist = run.travel.dist;

    if (mode === 'playing') {
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


        // Emit physical sparks from wheels during drift
        const bogieF = car.userData.bogies[0];
        emitSparks(bogieF.position.clone().add(car.position), 2, -speed * 0.3);
      } else {
        driftTime = Math.max(0, driftTime - dt * 2.5);
        if (driftTime === 0) {
          driftCombo = 1.0;
          lastComboStep = 1;
        }

      }

      // Wheel rail clack rhythm
      if (Math.floor(dist / 25) !== Math.floor((dist - speed * dt) / 25)) {
        sound.clack();
      }

      // Steam locomotive chuff rhythm
      if (currentTrainId === 'steam' && Math.floor(dist / 5) !== Math.floor((dist - speed * dt) / 5)) {
        sound.steamChuff(speed * 3.6);
      }
    } else if (mode === 'crash') {
      stepCrash(dt);
    }

    maintainTrack();
    updateHazards();
    stepSprings(dt);
    updateSparks(dt);

    if (smokeEmitter && (mode === 'playing' || mode === 'ready')) {
      smokeEmitter.update(dt, car.position, car.quaternion, speed);
    }

    if (mode === 'playing' || mode === 'ready') {
      const pc = pathAt(dist);
      const motion = stepAcrobatics({ dist, speed, dt, ends, moves, jump, riding, ramps });
      const { slant, half, jy, jPitch, lf, lr } = motion;
      for (const event of motion.events) {
        if (event.type === 'launch') launch(event);
        else landJump();
      }
      const pf = pathAt(dist + half), pr = pathAt(dist - half);
      const wf = offsetPt(pf, ends.front), wr = offsetPt(pr, ends.rear);
      const cx = (wf.x + wr.x) / 2, cz = (wf.z + wr.z) / 2;
      const yaw = Math.atan2(wf.z - wr.z, wf.x - wr.x);

      camLift = jy * CAM_JUMP_FOLLOW;
      pose.air = jy;

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

      // Update trailing carriages (e.g. 12 cars for Southeastern Class 395!)
      if (carriages.length > 0) {
        carriages.forEach((c) => {
          const cDist = dist - c.offsetDist;
          if (cDist >= segs[0].s0) {
            const cp = pathAt(cDist);
            const cpt = offsetPt(cp, ends.rear);
            const carriageY = (lf + lr) / 2 + Math.max(0, jy - c.index * 0.12);
            c.mesh.position.set(cpt.x, carriageY, cpt.z);
            c.mesh.quaternion.setFromAxisAngle(UP, -cp.h);
            c.mesh.visible = true;
          } else {
            c.mesh.visible = false;
          }
        });
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

  }

  const interpolated = () => [car, camera, ...carriages.map(c => c.mesh), ...hazardMeshes.flatMap(h => h.movers)];

  function simulationStep(dt) {
    interpolation.capture(interpolated());
    run.step(dt, stepWorld);
    mode = run.state.mode; speed = run.travel.speed; dist = run.travel.dist; score = run.score;
  }

  function renderFrame(now) {
    if (destroyed) return;
    if (!window.__TRAIN_TEST_CONFIG__?.manualClock) clock.frame(now, simulationStep, () => {
      run.pause('manual'); mode = run.state.mode; hud.showPause(mode === 'paused');
    });
    if (mode === 'ready') stepWorld(0);
    const commands = uiCommands; uiCommands = [];
    for (const command of commands) if (command.runId === run.state.runId) command.callback();
    bg.position.set(camera.position.x, 0, camera.position.z);
    interpolation.render(interpolated(), window.__TRAIN_TEST_CONFIG__?.manualClock ? 1 : clock.accumulator / clock.stepS, () => renderer.render(scene, camera));
    renderedFrames += 1;
    hud.renderSnapshot({ score, best, bankPoints, speedKmh: speed * 3.6, front: moves.front.to, rear: moves.rear.to,
      diagonal: Math.abs(ends.front - ends.rear) >= TRACK_SPACING * 0.7,
      driftCombo, driftFill: driftTime ? (driftTime % 1.5) * 66.6 : 0, dist, lengthM: activeLevel?.lengthM, warning: getWarning(activeLevel, dist, { timeS: run.timeS, content: levelContent }), metrics: run.metrics });
    animationFrame = requestAnimationFrame(renderFrame);
  }

  if (window.__TRAIN_TEST_CONFIG__) window.__TRAIN_TEST_HOOKS__ = {
    snapshot: () => ({ ...run.snapshot(), air: pose.air, progress: progress.snapshot(), jump: { ...jump }, barriers: barriers.map(b => ({ s: b.s, lat: b.lat, length: b.length, width: b.width, height: b.height })), ramps: ramps.map(r => ({ s: r.s, tz: r.tz })), renderedFrames, clock: { lastMs: clock.lastMs, accumulator: clock.accumulator }, testConfig: { ...window.__TRAIN_TEST_CONFIG__ }, shop: shop.snapshot(), currentTrainId, ends: { ...ends }, targets: { front: moves.front.to, rear: moves.rear.to }, gaps: gaps.map(g => ({ tz: g.tz, a: g.a, b: g.b })), hazards: hazardMeshes.map(h => ({ family: h.family, id: h.data.id, s: h.s, phase: h.phase, movers: h.movers.map(m => ({ z: m.position.z, rx: m.rotation.x })) })), warning: getWarning(activeLevel, dist, { timeS: run.timeS, content: levelContent }), track: segs.map(s => ({ s0: s.s0, len: s.len, k: s.k })), layout: items.map(i => ({ s: i.s, lat: i.lat, id: i.id })), memory: { ...renderer.info.memory }, pendingJudges: pendingJudges.size, soundOn: sound.soundOn, carriages: carriages.length }),
    step: ticks => { for (let i = 0; i < Math.min(10000, ticks); i++) simulationStep(1 / 60); },
    openMap, chooseLevel, startLevel: id => startGame('campaign', id), menu: returnToMenu,
    judge: () => evaluateStuntWithJev('TEST STUNT', 1, 4),
    crash: () => triggerCrash('Colisão de teste'),
  };

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  onResize();

  hud.showTutorial();
  if (shop.storageError) hud.showStunt('Armazenamento indisponível; esta sessão usa memória');
  animationFrame = requestAnimationFrame(renderFrame);

  function destroy(event) {
    if (event?.persisted || destroyed) return;
    destroyed = true; cancelAnimationFrame(animationFrame);
    run.stop(); run.events.clear(); interpolation.clear();
    for (const controller of pendingJudges) controller.abort();
    keyboard.dispose(); hud.dispose(); sound.dispose();
    window.removeEventListener('resize', onResize);
    scene.traverse(object => { object.shadow?.map?.dispose(); object.shadow?.mapPass?.dispose(); });
    smokeEmitter?.dispose();
    const disposed = disposeObject(scene);
    for (const geometry of [...geoCache.values(), rampGeo, poleGeo, ringGeo, itemGeo]) if (!disposed.geometries.has(geometry)) geometry.dispose();
    for (const material of [rampMat, poleMat, railMat, railTopMat, ballastMat, gapMat, ...itemMats]) if (!disposed.materials.has(material)) material.dispose();
    renderer.dispose();
  }
  window.addEventListener('pagehide', destroy);
})();
