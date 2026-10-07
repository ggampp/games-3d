import { createLevelContent } from '../levels/level-config.js';
import { stepMove, targetMove, advanceTravel } from './train-motion.js';
import { stepAcrobatics, TRAIN_GEOMETRY } from './acrobatics.js';
import { gapUnder, hitsBarrier, hitsPole, canCollect } from './collisions.js';
import { HazardWorld } from './hazards.js';

const SPACING = TRAIN_GEOMETRY.trackSpacing;
const emptyMove = () => ({ value: 0, from: 0, to: 0, t: 1, h0: 0, airT: 0 });

/**
 * One train's world step without renderer or DOM: lane moves, ramps/jumps, gaps, barriers,
 * poles, M3 hazards and pickups, in the order the campaign uses. The route harness and the
 * multiplayer server run this same code, so a server verdict matches the validated routes.
 */
export class TrainWorld {
  constructor(level, profile, { content = createLevelContent(level), collect = true } = {}) {
    this.level = level; this.profile = profile; this.collect = collect; this.content = content;
    this.hazards = new HazardWorld(content, TRAIN_GEOMETRY);
    this.ramps = content.ramps.map(r => ({ ...r, tz: r.lane * SPACING }));
    this.gaps = content.gaps.map(g => ({ ...g, tz: g.lane * SPACING }));
    this.blocks = content.barriers.map(b => ({ ...b, lat: b.lane * SPACING }));
    this.poles = content.poles.map(p => ({ ...p, h: p.height, r: p.radius }));
    this.items = content.items.map(i => ({ ...i, lat: i.lane * SPACING, taken: false }));
    this.moves = { front: emptyMove(), rear: emptyMove() };
    this.ends = { front: 0, rear: 0 }; this.jump = { on: false }; this.riding = { front: null, rear: null };
    this.metrics = { items: 0, aerialItems: 0, stuntsLanded: 0 }; this.events = []; this.hit = null;
  }
  /** Lane in {-1, 0, 1}; returns false when the end already targets it. */
  setLane(end, lane) { return targetMove(this.moves[end], lane * SPACING); }
  /** Returns {reason, hit} on a crash, otherwise {points} collected this tick. */
  step(travel, dt, tick, timeS) {
    const { moves, ends } = this;
    for (const end of ['front', 'rear']) { stepMove(moves[end], dt, this.profile.crossTimeS); ends[end] = moves[end].value; }
    const motion = stepAcrobatics({ dist: travel.dist, speed: travel.speed, dt, ends, moves, jump: this.jump, riding: this.riding, ramps: this.ramps });
    for (const event of motion.events) { this.events.push({ tick, ...event }); if (event.type === 'land') this.metrics.stuntsLanded++; }
    const pose = { dist: travel.dist, front: ends.front, rear: ends.rear, slant: motion.slant, bottom: motion.jy + Math.min(motion.lf, motion.lr) };
    this.pose = { ...pose, ...motion, speed: travel.speed, tick, timeS };
    if (gapUnder(this.gaps, ends.front, pose.dist + motion.half) && motion.jy + motion.lf < 0.15) return { reason: 'front gap' };
    if (gapUnder(this.gaps, ends.rear, pose.dist - motion.half) && motion.jy + motion.lr < 0.15) return { reason: 'rear gap' };
    if (this.blocks.some(b => hitsBarrier(b, pose, TRAIN_GEOMETRY))) return { reason: 'barrier' };
    if (this.poles.some(p => hitsPole(p, pose, TRAIN_GEOMETRY))) return { reason: 'pole' };
    const hit = this.hazards.check({ ...pose, top: motion.jy + Math.max(motion.lf, motion.lr) + TRAIN_GEOMETRY.bodyHeight, timeS });
    if (hit) { this.hit = hit; return { reason: hit.family, hit }; }
    let points = 0;
    if (this.collect) for (const item of this.items) if (canCollect(item, pose, TRAIN_GEOMETRY)) {
      item.taken = true; this.metrics.items++; if (item.level > 0) this.metrics.aerialItems++;
      points += Math.round(item.points * this.profile.bonusMultiplier);
    }
    return { points };
  }
}

/** Standalone authoritative run for one participant: 60 Hz ticks, finish/crash recorded once. */
export class TrainSimulation {
  constructor(level, profile, options) {
    this.level = level; this.profile = profile; this.world = new TrainWorld(level, profile, options);
    this.travel = { speed: profile.startSpeedMps, dist: 0 }; this.tick = 0; this.score = 0;
    this.state = 'running'; this.reason = ''; this.endTick = null; this.endFraction = null;
  }
  get alive() { return this.state === 'running'; }
  setLane(end, lane) { return this.alive && [-1, 0, 1].includes(lane) && this.world.setLane(end, lane); }
  step(dt = 1 / 60) {
    if (!this.alive) return null;
    const before = this.travel.dist;
    this.tick += 1; advanceTravel(this.travel, dt, this.profile);
    const outcome = this.world.step(this.travel, dt, this.tick, this.tick / 60);
    if (outcome.reason) { this.state = 'crashed'; this.reason = outcome.reason; this.endTick = this.tick; return 'crashed'; }
    this.score += outcome.points;
    if (this.travel.dist >= this.level.lengthM) {
      // Fraction of this tick at which the locomotive crossed the line, for same-tick tie-breaks.
      this.state = 'finished'; this.endTick = this.tick; this.endFraction = (this.level.lengthM - before) / (this.travel.dist - before);
      this.travel.dist = this.level.lengthM; return 'finished';
    }
    return null;
  }
  snapshot() {
    const { moves, ends, jump, metrics } = this.world;
    return { tick: this.tick, dist: this.travel.dist, speed: this.travel.speed, front: ends.front, rear: ends.rear,
      targets: { front: moves.front.to / SPACING, rear: moves.rear.to / SPACING }, air: this.world.pose?.jy ?? 0, jumping: Boolean(jump.on),
      state: this.state, reason: this.reason, endTick: this.endTick, endFraction: this.endFraction, score: this.score, metrics: { ...metrics } };
  }
}
