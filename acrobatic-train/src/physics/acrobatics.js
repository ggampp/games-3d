import { moveLift } from './train-motion.js';
export const TRAIN_GEOMETRY = Object.freeze({ trackSpacing: 3.4, bogie: Math.hypot(3.4, 6.8) / 2, carLength: Math.hypot(3.4, 6.8) + 1.8, carWidth: 1.7, bodyHeight: 3.15 });
export const JUMP_SETTINGS = Object.freeze({ gravity: 56, rampLength: 7, rampHeight: 1, rampHit: 0.7, pitch: 0.25 });
export function createJump(y0, spin, p0 = 0) {
  const peak = spin ? 4 : 8, vy = Math.sqrt(2 * 56 * Math.max(0, peak - y0));
  return { on: true, t: 0, y0, vy, spin, dir: 1, p0, T: (vy + Math.sqrt(vy * vy + 2 * 56 * y0)) / 56 };
}
export function rampRewardPosition(s, speed, spin) {
  const jump = createJump(0.5, spin);
  const half = spin ? Math.sqrt(TRAIN_GEOMETRY.bogie ** 2 - 1.7 ** 2) : TRAIN_GEOMETRY.bogie;
  return { s: s + 7 - half + speed * jump.vy / 56, y: (spin ? 4 : 8) + 1.6 };
}
export function findRamp(ramps, s, lat) { return ramps.find(r => s >= r.s && s <= r.s + 7 && Math.abs(lat - r.tz) < 0.7) || null; }
/** Shared production ramp detection and ballistic state, without renderer/UI. */
export function stepAcrobatics({ dist, speed, dt, ends, moves, jump, riding, ramps }) {
  const slant = Math.asin(Math.max(-1, Math.min(1, (ends.front - ends.rear) / (TRAIN_GEOMETRY.bogie * 2))));
  const half = TRAIN_GEOMETRY.bogie * Math.cos(slant), rh = { front: 0, rear: 0 }, events = [];
  if (!jump.on) {
    const position = { front: dist + half, rear: dist - half };
    for (const end of ['front', 'rear']) {
      const r = findRamp(ramps, position[end], ends[end]);
      if (r) rh[end] = (position[end] - r.s) / 7 * Math.min(1, 2 * (1 - Math.abs(ends[end] - r.tz) / 0.7));
    }
    for (const end of ['front', 'rear']) {
      const previous = riding[end], ramp = findRamp(ramps, position[end], ends[end]);
      if (!jump.on && previous && !ramp && position[end] - previous.s > 7 && Math.abs(ends[end] - previous.tz) < 0.7) {
        const other = end === 'front' ? 'rear' : 'front';
        const p0 = Math.atan2(end === 'front' ? 1 - rh.rear : rh.front - 1, TRAIN_GEOMETRY.bogie * 2);
        Object.assign(jump, createJump((1 + rh[other]) / 2, Math.abs(ends[other] - previous.tz) >= 0.7, p0));
        events.push({ type: 'launch', spin: jump.spin, duration: jump.T, peak: jump.spin ? 4 : 8 });
      }
      riding[end] = ramp;
    }
  }
  let jy = 0, jPitch = 0;
  if (jump.on) {
    jump.t += dt;
    if (jump.t >= jump.T) { jump.on = false; riding.front = riding.rear = null; events.push({ type: 'land' }); }
    else {
      jy = jump.y0 + jump.vy * jump.t - 56 * jump.t ** 2 / 2;
      const k = jump.t / jump.T; jPitch = jump.p0 * (1 - k) ** 2;
      if (!jump.spin) jPitch += Math.atan2(jump.vy - 56 * jump.t, speed) * 0.25 * Math.sin(Math.PI * k);
    }
  }
  return { slant, half, jy, jPitch, lf: Math.max(moveLift(moves.front), rh.front), lr: Math.max(moveLift(moves.rear), rh.rear), events };
}
