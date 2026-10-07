import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/core/game-state.js';
import { RunSession } from '../src/levels/campaign.js';
import { LEVEL_ONE } from '../src/levels/level-config.js';
import { getTrainGameplayProfile } from '../src/core/shop-state.js';
import { EventBus } from '../src/core/events.js';

test('M1-T01: independent overlays retain manual pause and reject gameplay input', () => {
  const state = new GameState(); assert.equal(state.acceptsInput(), false);
  assert.equal(state.start(), true); assert.equal(state.start(), false);
  state.pause('manual'); state.pause('store'); state.resume('store');
  assert.equal(state.mode, 'paused'); assert.equal(state.acceptsInput(), false);
  assert.deepEqual([...state.pauseReasons], ['manual']);
  state.resume('manual'); assert.equal(state.acceptsInput(), true);
  state.complete(); assert.equal(state.acceptsInput(), false);
  state.stop(); assert.equal(state.screen, 'menu'); assert.equal(state.acceptsInput(), false);
});

test('M1-T04: old responses/timers cannot affect a new attempt or terminal result', () => {
  const run = new RunSession(); const profile = getTrainGameplayProfile('cyber', LEVEL_ONE);
  run.start(profile, LEVEL_ONE); const old = run.state.runId;
  run.pause('store'); run.deliver(old, 'judge-A', () => run.addScore(100));
  run.stop(); run.start(profile, LEVEL_ONE);
  assert.equal(run.deliver(old, 'judge-A', () => run.addScore(100)), false);
  assert.equal(run.score, 0); assert.equal(run.pending.length, 0);
  run.crash('test'); run.step(2);
  assert.equal(run.state.mode, 'over'); assert.equal(run.deliver(run.state.runId, 'late', () => run.addScore(10)), false);
  run.start(profile, LEVEL_ONE); run.step(1 / 60);
  assert.equal(run.state.mode, 'playing'); assert.equal(run.crashTime, 0);
});

test('M1: paused responses apply once upon actual resume, deterministic score excludes AI', () => {
  const run = new RunSession(); run.start(getTrainGameplayProfile('cyber', LEVEL_ONE), LEVEL_ONE);
  run.pause('manual'); run.pause('store');
  const apply = () => run.addScore(50, { deterministic: false });
  run.deliver(run.state.runId, 'judge-1', apply); run.deliver(run.state.runId, 'judge-1', apply);
  run.resume('store'); assert.equal(run.score, 0);
  run.resume('manual'); assert.equal(run.score, 50); assert.equal(run.deterministicScore, 0);
  assert.equal(run.deliver(run.state.runId, 'judge-1', apply), false);
});

test('events unsubscribe cleanly and have immutable envelopes', () => {
  const events = new EventBus(); let calls = 0;
  const off = events.on('test', data => { assert.ok(Object.isFrozen(data)); calls++; });
  events.emit('test', { value: 1 }); off(); events.emit('test', {}); assert.equal(calls, 1);
});
