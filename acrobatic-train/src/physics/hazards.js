import { hitsPole } from './collisions.js';
import { ease } from './train-motion.js';

/**
 * M3 hazard families in track coordinates (s, lat, y). Pure functions of simulation
 * time: the renderer samples the same state it collides against, pausing freezes it.
 */
export const GATE = Object.freeze({
  cycleS: 8, openS: 3, warnS: 2, closedS: 2, reopenS: 1, lowerS: 0.6,
  pivotY: 1.05, boomLength: 3.3, boomRadius: 0.12, thickness: 0.3, postRadius: 0.16, postHeight: 1.45,
});
export const GANTRY = Object.freeze({ depth: 1.2, openingWidth: 2.6, clearance: 4.4, roofTop: 5.2, halfSpan: 5.4 });
export const WAGON = Object.freeze({ depth: 2.6, length: 4.0, height: 2.8, restEdge: 7.5, reachMargin: 1.0, inS: 2.0, holdS: 2.4, outS: 2.0, leadS: 0.9 });

const mod = (a, n) => ((a % n) + n) % n;

/**
 * Cycle boundaries are half-open [start, end). Order: open, warning (boom up, lights on),
 * closing (boom lowers during the last lowerS of the warning), closed, reopening.
 */
export function gateCycle(gate, timeS) {
  const t = mod(timeS + gate.phaseOffsetS, GATE.cycleS);
  const warnEnd = GATE.openS + GATE.warnS, closedEnd = warnEnd + GATE.closedS;
  if (t < GATE.openS) return { phase: 'open', t, angle: Math.PI / 2 };
  if (t < warnEnd - GATE.lowerS) return { phase: 'warning', t, angle: Math.PI / 2 };
  if (t < warnEnd) return { phase: 'closing', t, angle: Math.PI / 2 * (1 - ease((t - warnEnd + GATE.lowerS) / GATE.lowerS)) };
  if (t < closedEnd) return { phase: 'closed', t, angle: 0 };
  return { phase: 'reopening', t, angle: Math.PI / 2 * ease((t - closedEnd) / GATE.reopenS) };
}
/** Pivot sits on the lane edge; outer lanes pivot outside the ballast, the centre one at +1.7. */
export function gateGeometry(lane, spacing = 3.4) {
  const side = lane === 0 ? 1 : lane;
  return { pivotLat: lane * spacing + side * spacing / 2, dir: -side };
}

/** Lateral interval of the slanted footprint within [sMin, sMax], or null. */
export function footprintSlice(pose, geometry, sMin, sMax) {
  const c = Math.cos(pose.slant), s = Math.sin(pose.slant), hl = geometry.carLength / 2, hw = geometry.carWidth / 2;
  const lat = (pose.front + pose.rear) / 2;
  let poly = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([u, v]) => [pose.dist + u * c - v * s, lat + u * s + v * c]);
  for (const [bound, keep] of [[sMin, (p) => p[0] >= sMin], [sMax, (p) => p[0] <= sMax]]) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (keep(a)) out.push(a);
      if (keep(a) !== keep(b)) { const k = (bound - a[0]) / (b[0] - a[0]); out.push([bound, a[1] + (b[1] - a[1]) * k]); }
    }
    poly = out;
    if (!poly.length) return null;
  }
  return [Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[1]))];
}
const top = (pose, geometry) => pose.top ?? pose.bottom + geometry.bodyHeight;

/** Boom centreline endpoints in the (lat, y) cross-section at simulation time. */
export function gateBoom(gate, timeS) {
  const { angle } = gateCycle(gate, timeS);
  return { x0: gate.pivotLat, y0: GATE.pivotY, x1: gate.pivotLat + gate.dir * GATE.boomLength * Math.cos(angle), y1: GATE.pivotY + GATE.boomLength * Math.sin(angle) };
}
/** Boom as a thick segment in the (lat, y) cross-section against the footprint slice. */
export function hitsGate(gate, pose, timeS, geometry) {
  const r = GATE.boomRadius;
  if (hitsPole({ s: gate.s, lat: gate.pivotLat, h: GATE.postHeight, r: GATE.postRadius }, pose, geometry)) return 'post';
  const slice = footprintSlice(pose, geometry, gate.s - GATE.thickness / 2, gate.s + GATE.thickness / 2);
  if (!slice) return null;
  const { x0, y0, x1, y1 } = gateBoom(gate, timeS);
  const lo = slice[0] - r, hi = slice[1] + r, dx = x1 - x0;
  let k0 = 0, k1 = 1;
  if (Math.abs(dx) < 1e-9) { if (x0 < lo || x0 > hi) return null; }
  else {
    const a = (lo - x0) / dx, b = (hi - x0) / dx;
    k0 = Math.max(0, Math.min(a, b)); k1 = Math.min(1, Math.max(a, b));
    if (k0 > k1) return null;
  }
  const ya = y0 + (y1 - y0) * k0, yb = y0 + (y1 - y0) * k1;
  return Math.min(ya, yb) - r < top(pose, geometry) && Math.max(ya, yb) + r > pose.bottom ? 'boom' : null;
}

/** Axis-aligned box in track space against the slanted footprint (SAT) and height interval. */
export function hitsBox(box, pose, geometry) {
  if (pose.bottom >= box.yMax || top(pose, geometry) <= box.yMin) return false;
  const ds = box.s - pose.dist, dl = box.lat - (pose.front + pose.rear) / 2;
  const c = Math.cos(pose.slant), s = Math.sin(pose.slant), ac = Math.abs(c), as = Math.abs(s);
  const tl = geometry.carLength / 2, tw = geometry.carWidth / 2, bl = box.length / 2, bw = box.width / 2;
  return Math.abs(ds) < tl * ac + tw * as + bl && Math.abs(dl) < tl * as + tw * ac + bw
    && Math.abs(ds * c + dl * s) < tl + bl * ac + bw * as
    && Math.abs(-ds * s + dl * c) < tw + bl * as + bw * ac;
}
const span = (id, s, length, a, b, yMin, yMax) => ({ id, s, length, lat: (a + b) / 2, width: b - a, yMin, yMax });
/** Side panels up to the roof plus a lintel above the opening; no lane-name shortcut. */
export function gantryBoxes(gantry) {
  const half = GANTRY.openingWidth / 2, a = gantry.openLat - half, b = gantry.openLat + half;
  return [
    span(`${gantry.id}:left`, gantry.s, GANTRY.depth, -GANTRY.halfSpan, a, 0, GANTRY.roofTop),
    span(`${gantry.id}:right`, gantry.s, GANTRY.depth, b, GANTRY.halfSpan, 0, GANTRY.roofTop),
    span(`${gantry.id}:roof`, gantry.s, GANTRY.depth, a, b, GANTRY.clearance, GANTRY.roofTop),
  ];
}
export function hitsGantry(gantry, pose, geometry) {
  const box = gantryBoxes(gantry).find(b => hitsBox(b, pose, geometry));
  return box ? (box.id.endsWith(':roof') ? 'roof' : 'side') : null;
}

/** Lateral centre of a crossing wagon; rests off the ballast outside its active window. */
export function wagonLat(wagon, timeS) {
  const t = timeS - wagon.startTimeS, travel = wagon.reachLat - wagon.restLat;
  if (t <= 0 || t >= WAGON.inS + WAGON.holdS + WAGON.outS) return wagon.restLat;
  if (t < WAGON.inS) return wagon.restLat + travel * ease(t / WAGON.inS);
  if (t < WAGON.inS + WAGON.holdS) return wagon.reachLat;
  return wagon.reachLat - travel * ease((t - WAGON.inS - WAGON.holdS) / WAGON.outS);
}
export function wagonPhase(wagon, timeS) {
  const t = timeS - wagon.startTimeS;
  if (t <= 0) return 'waiting';
  if (t < WAGON.inS) return 'entering';
  if (t < WAGON.inS + WAGON.holdS) return 'blocking';
  return t < WAGON.inS + WAGON.holdS + WAGON.outS ? 'leaving' : 'parked';
}
export const wagonBox = (wagon, timeS) => ({ id: wagon.id, s: wagon.s, length: WAGON.depth, lat: wagonLat(wagon, timeS), width: WAGON.length, yMin: 0, yMax: WAGON.height });

/**
 * Continuous test between two ticks: both the train pose and the wagon are interpolated
 * with enough sub-samples that relative motion per sample stays under a quarter of the
 * thinnest dimension, so neither body can tunnel through the other.
 */
export function sweptHitsWagon(wagon, previous, pose, geometry) {
  const prevBox = wagonBox(wagon, previous.timeS), box = wagonBox(wagon, pose.timeS);
  const rel = Math.hypot(pose.dist - previous.dist, (box.lat - prevBox.lat) - ((pose.front + pose.rear) - (previous.front + previous.rear)) / 2);
  const n = Math.max(1, Math.ceil(rel / (Math.min(WAGON.depth, geometry.carWidth) / 4)));
  for (let i = 1; i <= n; i++) {
    const k = i / n, lerp = key => previous[key] + (pose[key] - previous[key]) * k;
    const sample = { dist: lerp('dist'), front: lerp('front'), rear: lerp('rear'), slant: lerp('slant'), bottom: lerp('bottom'), top: lerp('top') };
    if (hitsBox(wagonBox(wagon, lerp('timeS')), sample, geometry)) return true;
  }
  return false;
}

/** Stateful collision driver for one attempt. Same code runs in game.js and the route tests. */
export class HazardWorld {
  constructor(content, geometry) {
    this.geometry = geometry;
    this.gates = content.gates || []; this.gantries = content.gantries || []; this.wagons = content.wagons || [];
    this.previous = null;
  }
  reset() { this.previous = null; }
  /** pose: {dist, front, rear, slant, bottom, top, timeS}. Returns null or {family, id, part}. */
  check(pose) {
    const previous = this.previous || pose; this.previous = { ...pose };
    for (const gate of this.gates) {
      if (Math.abs(gate.s - pose.dist) > this.geometry.carLength) continue;
      const part = hitsGate(gate, pose, pose.timeS, this.geometry);
      if (part) return { family: 'gate', id: gate.id, part };
    }
    for (const gantry of this.gantries) {
      if (Math.abs(gantry.s - pose.dist) > this.geometry.carLength) continue;
      const part = hitsGantry(gantry, pose, this.geometry);
      if (part) return { family: 'gantry', id: gantry.id, part };
    }
    for (const wagon of this.wagons) {
      if (Math.abs(wagon.s - pose.dist) > this.geometry.carLength + Math.abs(pose.dist - previous.dist) + WAGON.depth) continue;
      if (sweptHitsWagon(wagon, previous, pose, this.geometry)) return { family: 'wagon', id: wagon.id, part: 'body' };
    }
    return null;
  }
}
