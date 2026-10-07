import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEVELS, validateLevel, createLevelContent, warningStart, encounterStart } from '../src/levels/level-config.js';
import { TRAIN_CATALOG } from '../src/entities/train-factory.js';
import { TRAIN_GEOMETRY } from '../src/physics/acrobatics.js';
import { traverse } from './helpers/traversal.js';
import { ROUTES, AIR_ROUTE, ZERO_SCORE_ROUTE } from './helpers/routes.js';
test('C-01/02/07: safe starts/finishes, consistent content and at least 2.5s warning', () => {
  for (const level of LEVELS) {
    assert.deepEqual(validateLevel(level), []); assert.deepEqual(createLevelContent(level), createLevelContent(level));
    for (const encounter of level.encounters) assert.ok((encounterStart(encounter) - TRAIN_GEOMETRY.carLength / 2 - warningStart(level, encounter)) / level.maxSpeedMps >= 2.5);
    const content = createLevelContent(level); assert.ok(content.items.every(i => Number.isFinite(i.y) && i.s > 80 && i.s < level.lengthM - 80));
  }
  assert.ok(validateLevel({ ...LEVELS[0], maxSpeedMps: -1 }).length);
  assert.ok(validateLevel({ ...LEVELS[0], encounters: [{ ...LEVELS[0].encounters[0], s: 40 }] }).length);
  assert.ok(validateLevel({ ...LEVELS[0], encounters: [{ ...LEVELS[0].encounters[0], lanes: [-1, 0, 1] }] }).length);
});
test('C-03/M2-T03: all three ground routes finish with every normalized train at 30/60/120 FPS and score zero', () => {
  for (const level of LEVELS) for (const trainId of Object.keys(TRAIN_CATALOG)) for (const fps of [30, 60, 120]) {
    const result = traverse(level, ROUTES[level.id], { trainId, fps, collect: false });
    assert.equal(result.mode, 'levelComplete', `${level.id}/${trainId}/${fps}: ${result.reason}`);
    assert.equal(result.dist, level.lengthM); assert.equal(result.score, 0);
  }
});
test('F03/M2-T04: shared ramp physics performs backflip and roll, lands and collects airborne items', () => {
  for (const trainId of Object.keys(TRAIN_CATALOG)) {
    const result = traverse(LEVELS[2], AIR_ROUTE, { trainId });
    assert.equal(result.mode, 'levelComplete', result.reason);
    assert.ok(result.events.some(e => e.type === 'launch' && !e.spin)); assert.ok(result.events.some(e => e.type === 'launch' && e.spin));
    assert.ok(result.metrics.stuntsLanded >= 3); assert.ok(result.metrics.aerialItems >= 1);
  }
  const ground = traverse(LEVELS[2], ROUTES['level-03']); assert.equal(ground.metrics.aerialItems, 0); assert.equal(ground.metrics.stuntsLanded, 0);
});
test('F01/F02: no-input barrier/gap causes real defeat, right alternative stays reachable', () => {
  assert.equal(traverse(LEVELS[0], []).reason, 'barrier'); assert.equal(traverse(LEVELS[1], []).reason, 'front gap');
  const right = [{ atM: 55, front: 1, rear: 1 }, { atM: 230, front: 0, rear: 0 }, { atM: 425, front: -1, rear: -1 }];
  assert.equal(traverse(LEVELS[0], right).mode, 'levelComplete');
});
test('F01-T04: natural route avoids all pickups, finishes with zero score and active collection', () => {
  const result = traverse(LEVELS[0], ZERO_SCORE_ROUTE);
  assert.equal(result.mode, 'levelComplete'); assert.equal(result.score, 0); assert.equal(result.metrics.items, 0);
});
test('persisted level fixtures and replay commands match shipped content', () => {
  for (const level of LEVELS) {
    const fixture = JSON.parse(fs.readFileSync(new URL(`./fixtures/levels/${level.id}.json`, import.meta.url)));
    assert.deepEqual(fixture, { ...level, content: createLevelContent(level) });
    const replay = JSON.parse(fs.readFileSync(new URL(`./fixtures/replays/${level.id}.json`, import.meta.url)));
    assert.deepEqual(replay.commands, ROUTES[level.id]); assert.equal(traverse(level, replay.commands, { collect: false }).mode, 'levelComplete');
  }
});
