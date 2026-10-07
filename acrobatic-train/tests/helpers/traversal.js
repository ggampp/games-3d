import { RunSession } from '../../src/levels/campaign.js';
import { FixedClock } from '../../src/core/fixed-clock.js';
import { getTrainGameplayProfile } from '../../src/core/shop-state.js';
import { createLevelContent } from '../../src/levels/level-config.js';
import { TrainWorld } from '../../src/physics/train-sim.js';

/** Drives the shared TrainWorld (same code as the multiplayer server) through RunSession and the fixed clock. */
export function traverse(level, commands, { trainId = 'cyber', fps = 60, collect = true, onPose, editContent, pauses = [] } = {}) {
  const run = new RunSession(), clock = new FixedClock();
  const profile = getTrainGameplayProfile(trainId, level); run.start(profile, level);
  const content = createLevelContent(level); editContent?.(content);
  const world = new TrainWorld(level, profile, { content, collect });
  run.metrics = world.metrics;
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
        for (const end of ['front', 'rear']) if (input[end] !== undefined) world.setLane(end, input[end]);
      }
      const outcome = world.step(run.travel, dt, run.tick, run.timeS);
      if (outcome.reason) { run.crash(outcome.reason); run.hit = outcome.hit; }
      else if (outcome.points) run.addScore(outcome.points);
      onPose?.(world.pose);
    }));
  }
  return { ...run.snapshot(), hit: run.hit ?? null, events: world.events, content, collectedIds: world.items.filter(i => i.taken).map(i => i.id) };
}
