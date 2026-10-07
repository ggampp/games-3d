import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FixedClock } from '../src/core/fixed-clock.js';
import { RunSession } from '../src/levels/campaign.js';
import { createRng } from '../src/core/rng.js';
import { LEVEL_ONE, createBasicLayout } from '../src/levels/level-config.js';
import { getTrainGameplayProfile } from '../src/core/shop-state.js';
import { targetMove, stepMove, moveLift } from '../src/physics/train-motion.js';
import { canCollect, gapUnder, overlapsFootprint } from '../src/physics/collisions.js';
import { traverse } from './helpers/traversal.js';

function replay(fps, visualEffects = false) {
  const run = new RunSession(), clock = new FixedClock(), events = [];
  run.start(getTrainGameplayProfile('cyber', LEVEL_ONE), LEVEL_ONE);
  run.events.on('levelCompleted', snapshot => events.push({ tick: snapshot.tick, score: snapshot.score }));
  const visual = createRng('visual');
  for (let frame = 0; frame <= fps * 45; frame++) {
    if (visualEffects) for (let i = 0; i < 100; i++) visual();
    clock.frame(frame * 1000 / fps, dt => run.step(dt));
  }
  return { dist: run.travel.dist, tick: run.tick, timeS: run.timeS, mode: run.state.mode, events, layout: createBasicLayout() };
}

test('M1-T02: same production replay/layout/tick at 30/60/120 FPS with effects independent', () => {
  const expected = replay(60);
  assert.equal(expected.mode, 'levelComplete'); assert.equal(expected.dist, 600); assert.equal(expected.events.length, 1);
  for (const fps of [30, 60, 120]) assert.deepEqual(replay(fps, true), expected);
});

test('M1-T03: collision in arrival tick wins over completion; terminals are idempotent', () => {
  const run = new RunSession(); run.start(getTrainGameplayProfile('cyber', LEVEL_ONE), LEVEL_ONE);
  let completion = 0; run.events.on('levelCompleted', () => completion++);
  run.travel.dist = 599.99;
  run.step(1 / 60, () => run.crash('collision'));
  assert.equal(run.state.mode, 'crash'); assert.equal(completion, 0);
  run.step(2); run.start(getTrainGameplayProfile('cyber', LEVEL_ONE), LEVEL_ONE);
  run.travel.dist = 599.99; run.step(1 / 60); run.step(1 / 60);
  assert.equal(run.state.mode, 'levelComplete'); assert.equal(completion, 1); assert.equal(run.score, 0);
});

test('M1-T07: infinite production adapter does not conclude after 600m', () => {
  const run = new RunSession(); run.start(getTrainGameplayProfile('cyber'));
  for (let i = 0; i < 3600; i++) run.step(1 / 60);
  assert.ok(run.travel.dist > 600); assert.equal(run.state.mode, 'playing'); assert.equal(run.level, null);
});

test('clock suspension skips hazards instead of fast-forwarding; catch-up is bounded', () => {
  const clock = new FixedClock(); let steps = 0, suspensions = 0;
  clock.frame(0, () => steps++); clock.frame(5000, () => steps++, () => suspensions++);
  assert.equal(steps, 0); assert.equal(suspensions, 1);
  assert.equal(clock.frame(5200, () => steps++), 8); assert.equal(steps, 8);
});

test('motion and collection/gap volumes are pure and distinguish height/diagonal', () => {
  const m = { value: 0, from: 0, to: 0, t: 1, h0: 0, airT: 0 };
  assert.equal(targetMove(m, 3.4), true);
  for (let i = 0; i < 17; i++) stepMove(m, 1 / 60);
  assert.equal(m.value, 3.4); assert.equal(moveLift(m), 0);
  assert.equal(gapUnder([{ tz: 0, a: 10, b: 20 }], 0, 15), true);
  assert.equal(gapUnder([{ tz: 0, a: 10, b: 20 }], 3.4, 15), false);
  assert.equal(overlapsFootprint(0, 0, 0, 5, 1), true);
  const item = { s: 100, lat: 0, y: 8, taken: false };
  const pose = { dist: 100, front: 0, rear: 0, slant: 0, bottom: 0 };
  const geometry = { carLength: 9.4, carWidth: 1.7 };
  assert.equal(canCollect(item, pose, geometry), false);
  assert.equal(canCollect(item, { ...pose, bottom: 5 }, geometry), true);
});

test('basic content has only 25 deterministic pickups outside safe start/finish', () => {
  const layout = createBasicLayout(); assert.equal(layout.length, 25);
  assert.equal(new Set(layout.map(i => i.id)).size, layout.length);
  assert.ok(layout.every(i => i.s >= 80 && i.s <= 520));
  assert.deepEqual(createBasicLayout(), layout);
});

test('persisted level/replay fixtures match production and demonstrate a zero-score route', () => {
  const level = JSON.parse(fs.readFileSync(new URL('./fixtures/levels/level-01.json', import.meta.url)));
  const replay = JSON.parse(fs.readFileSync(new URL('./fixtures/replays/level-01.json', import.meta.url)));
  for (const key of ['id', 'version', 'seed', 'rngVersion', 'lengthM', 'startSpeedMps', 'maxSpeedMps', 'accelerationMps2']) assert.equal(level[key], LEVEL_ONE[key]);
  const result = traverse(LEVEL_ONE, replay.commands, { trainId: replay.profile, collect: false });
  assert.equal(result.mode, replay.expected.mode); assert.equal(result.dist, replay.expected.dist);
  assert.equal(result.score, replay.expected.scoreRequired);
});
