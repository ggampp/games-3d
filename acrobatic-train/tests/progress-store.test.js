import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore, PROGRESS_KEY } from '../src/core/progress-store.js';
import { RunSession } from '../src/levels/campaign.js';
import { LEVEL_ONE, LEVEL_TWO } from '../src/levels/level-config.js';
import { getTrainGameplayProfile } from '../src/core/shop-state.js';
const storage = raw => { const map = new Map(Object.entries(raw || {})); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; };
const result = (id, eventId = id, score = 0, timeS = 40) => ({ levelId: id, eventId, score, timeS });

test('M2-T01/T06, M3: sequential completion, zero score, reload, repeat and future phases', () => {
  const store = storage({ acrobatic_train_bank_points: '2000' }), progress = new ProgressStore(store);
  assert.equal(progress.canPlay('level-01'), true); assert.equal(progress.canPlay('level-03'), false);
  assert.equal(progress.complete(result('level-02')), false);
  assert.equal(progress.complete(result('level-01')), true); assert.equal(progress.continueLevelId(), 'level-02');
  assert.equal(progress.complete(result('level-01')), false);
  progress.complete(result('level-02')); progress.complete(result('level-03'));
  assert.equal(progress.snapshot().highestUnlockedLevel, 4); assert.equal(progress.canPlay('level-04'), true);
  assert.equal(progress.canPlay('level-05'), false); assert.equal(progress.continueLevelId(), 'level-04');
  for (const id of ['level-04', 'level-05', 'level-06']) assert.equal(progress.complete(result(id)), true);
  assert.equal(progress.snapshot().highestUnlockedLevel, 7); assert.equal(progress.canPlay('level-07'), false);
  assert.equal(progress.complete(result('level-07')), false);
  assert.deepEqual(progress.snapshot().achievements, []); assert.equal(progress.continueLevelId(), 'level-06');
  progress.complete(result('level-01', 'retry', 500, 50)); progress.complete(result('level-01', 'retry2', 1, 30));
  const reloaded = new ProgressStore(store);
  assert.equal(reloaded.snapshot().results['level-01'].bestScore, 500); assert.equal(reloaded.snapshot().results['level-01'].bestTimeS, 30);
  assert.equal(reloaded.snapshot().highestUnlockedLevel, 7); assert.equal(reloaded.canPlay('level-06'), true); assert.equal(store.map.get('acrobatic_train_bank_points'), '2000');
});
test('M2-T02: corrupt saves, invalid fields, unsupported version and storage failure', () => {
  for (const raw of ['{', 'null', '[]', '{"schemaVersion":1,"highestUnlockedLevel":9,"results":{"level-03":{"completed":true,"bestScore":0,"bestTimeS":40}}}', '{"schemaVersion":1,"results":{"level-01":{"completed":true,"bestScore":-1,"bestTimeS":40}}}']) {
    const p = new ProgressStore(storage({ [PROGRESS_KEY]: raw })); assert.equal(p.canPlay('level-02'), false); assert.equal(p.snapshot().highestUnlockedLevel, 1);
  }
  const legacy = new ProgressStore(storage({ [PROGRESS_KEY]: JSON.stringify({ schemaVersion: 0, completedLevels: ['level-01'], bestScores: { 'level-01': 50 } }) }));
  assert.equal(legacy.canPlay('level-02'), true); assert.equal(legacy.snapshot().results['level-01'].bestScore, 50);
  assert.equal(legacy.snapshot().results['level-01'].bestTimeS, null);
  const futureRaw = '{"schemaVersion":99,"results":{}}', futureStore = storage({ [PROGRESS_KEY]: futureRaw });
  const future = new ProgressStore(futureStore); future.complete(result('level-01')); assert.equal(futureStore.map.get(PROGRESS_KEY), futureRaw); assert.ok(future.warning);
  const failed = new ProgressStore({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  assert.equal(failed.complete(result('level-01')), true); assert.equal(failed.canPlay('level-02'), true); assert.equal(failed.storageError, true); assert.ok(failed.warning);
  assert.equal(failed.complete({ ...result('level-02'), score: Infinity }), false);
  assert.equal(failed.complete({ ...result('level-02'), timeS: -1 }), false);
  assert.equal(failed.complete({ ...result('level-02'), source: 'mod' }), false);
});
test('domain start rejects locked levels independently of the DOM', () => {
  const p = new ProgressStore(), run = new RunSession({ canStartLevel: level => p.canPlay(level.id) });
  assert.equal(run.start(getTrainGameplayProfile('cyber', LEVEL_TWO), LEVEL_TWO), false);
  assert.equal(run.state.runId, 0);
  assert.equal(run.start(getTrainGameplayProfile('cyber', LEVEL_ONE), LEVEL_ONE), true);
});
