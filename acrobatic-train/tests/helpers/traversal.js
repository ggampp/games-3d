import { RunSession } from '../../src/levels/campaign.js';
import { FixedClock } from '../../src/core/fixed-clock.js';
import { getTrainGameplayProfile } from '../../src/core/shop-state.js';
import { createLevelContent } from '../../src/levels/level-config.js';
import { stepMove, targetMove } from '../../src/physics/train-motion.js';
import { stepAcrobatics, TRAIN_GEOMETRY } from '../../src/physics/acrobatics.js';
import { gapUnder, hitsBarrier, hitsPole, canCollect } from '../../src/physics/collisions.js';
import { HazardWorld } from '../../src/physics/hazards.js';

/** Assembles the same production helpers as the renderer; no fabricated ASR/AI/physics. */
export function traverse(level, commands, { trainId = 'cyber', fps = 60, collect = true, onPose, editContent, pauses = [] } = {}) {
  const run = new RunSession(), clock = new FixedClock(), events = [];
  const profile = getTrainGameplayProfile(trainId, level); run.start(profile, level);
  const content = createLevelContent(level); editContent?.(content);
  const hazards = new HazardWorld(content, TRAIN_GEOMETRY);
  const ramps = content.ramps.map(r => ({ ...r, tz: r.lane * 3.4 }));
  const gaps = content.gaps.map(g => ({ ...g, tz: g.lane * 3.4 }));
  const blocks = content.barriers.map(b => ({ ...b, lat: b.lane * 3.4 }));
  const poles = content.poles.map(p => ({ ...p, h: p.height, r: p.radius }));
  const items = content.items.map(i => ({ ...i, lat: i.lane * 3.4, taken: false }));
  const moves = Object.fromEntries(['front', 'rear'].map(end => [end, { value: 0, from: 0, to: 0, t: 1, h0: 0, airT: 0 }]));
  const ends = { front: 0, rear: 0 }, jump = { on: false }, riding = { front: null, rear: null };
  let command = 0, active = null, pausedFrames = 0;
  for (let frame = 0; frame <= fps * 70; frame++) {
    // Pause windows {atM, frames, onPaused}: wall-clock frames elapse while the simulation stays frozen.
    const due = active ? null : pauses.find(p => !p.done && run.travel.dist >= p.atM);
    if (due && run.state.mode === 'playing') { run.pause('manual'); due.done = true; active = due; pausedFrames = due.frames; due.onPaused?.(run, 'start'); }
    if (active && --pausedFrames <= 0) { active.onPaused?.(run, 'end'); run.resume('manual'); active = null; }
    clock.frame(frame * 1000 / fps, dt => run.step(dt, () => {
    if (run.state.mode !== 'playing') return;
    while (commands[command] && commands[command].atM <= run.travel.dist) {
      const input = commands[command++];
      for (const end of ['front', 'rear']) if (input[end] !== undefined) targetMove(moves[end], input[end] * 3.4);
    }
    for (const end of ['front', 'rear']) { stepMove(moves[end], dt, profile.crossTimeS); ends[end] = moves[end].value; }
    const motion = stepAcrobatics({ dist: run.travel.dist, speed: run.travel.speed, dt, ends, moves, jump, riding, ramps });
    for (const event of motion.events) { events.push({ tick: run.tick, ...event }); if (event.type === 'land') run.metrics.stuntsLanded++; }
    const pose = { dist: run.travel.dist, front: ends.front, rear: ends.rear, slant: motion.slant, bottom: motion.jy + Math.min(motion.lf, motion.lr) };
    if (gapUnder(gaps, ends.front, pose.dist + motion.half) && motion.jy + motion.lf < 0.15) run.crash('front gap');
    if (gapUnder(gaps, ends.rear, pose.dist - motion.half) && motion.jy + motion.lr < 0.15) run.crash('rear gap');
    if (blocks.some(b => hitsBarrier(b, pose, TRAIN_GEOMETRY))) run.crash('barrier');
    if (poles.some(p => hitsPole(p, pose, TRAIN_GEOMETRY))) run.crash('pole');
    const hit = run.state.mode === 'playing' ? hazards.check({ ...pose, top: motion.jy + Math.max(motion.lf, motion.lr) + TRAIN_GEOMETRY.bodyHeight, timeS: run.timeS }) : null;
    if (hit) { run.crash(hit.family); run.hit = hit; }
    if (collect && run.state.mode === 'playing') for (const item of items) if (canCollect(item, pose, TRAIN_GEOMETRY)) {
      item.taken = true; run.metrics.items++; if (item.level > 0) run.metrics.aerialItems++;
      run.addScore(Math.round(item.points * profile.bonusMultiplier));
    }
    onPose?.({ ...pose, ...motion, speed: run.travel.speed, tick: run.tick, timeS: run.timeS });
  }));
  }
  return { ...run.snapshot(), hit: run.hit ?? null, events, content, collectedIds: items.filter(i => i.taken).map(i => i.id) };
}
