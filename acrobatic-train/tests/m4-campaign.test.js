import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEVELS, LEVEL_SEVEN, LEVEL_EIGHT, LEVEL_NINE, validateLevel, createLevelContent, effectiveWarningS, requiredWarningS, encounterStart, budgetFor, MAX_FAMILIES_PER_ENCOUNTER } from '../src/levels/level-config.js';
import { ProgressStore, PROGRESS_KEY, TROPHY_ID } from '../src/core/progress-store.js';
import { RunSession } from '../src/levels/campaign.js';
import { getTrainGameplayProfile } from '../src/core/shop-state.js';
import { hitsBox, wagonBox, WAGON } from '../src/physics/hazards.js';
import { TRAIN_GEOMETRY } from '../src/physics/acrobatics.js';
import { TRAIN_CATALOG } from '../src/entities/train-factory.js';
import { traverse } from './helpers/traversal.js';
import { ROUTES, AIR_ROUTES } from './helpers/routes.js';
import { lateReactionRoute } from './helpers/late-route.js';

const M4 = [LEVEL_SEVEN, LEVEL_EIGHT, LEVEL_NINE];
const storage = raw => { const map = new Map(Object.entries(raw || {})); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map }; };
/** Encounters sharing a group form one envelope; a lone encounter is its own group. */
const envelopes = level => level.encounters.reduce((groups, e, i) => {
  const previous = level.encounters[i - 1];
  if (i > 0 && e.group && e.group === previous.group) groups.at(-1).push(e); else groups.push([e]);
  return groups;
}, []);

test('M4-T01/F07-A05: phases 7–9 validate, keep the hard budgets and every warning lasts long enough', () => {
  assert.equal(LEVELS.length, 9);
  for (const level of M4) {
    assert.deepEqual(validateLevel(level), [], level.id);
    assert.deepEqual(createLevelContent(level), createLevelContent(level));
    const budget = budgetFor(level);
    assert.deepEqual(budget, level.number === 9 ? { reactionS: 0.45, warningS: 1.2, restS: 1.2 } : { reactionS: 0.7, warningS: 1.6, restS: 1.6 });
    level.encounters.forEach((e, i) => {
      if (i > 0 && e.group && e.group === level.encounters[i - 1].group) return;
      assert.ok(effectiveWarningS(level, i) >= requiredWarningS(level, i), `${level.id}/${e.id}`);
    });
  }
  const successive = LEVEL_EIGHT.encounters.findIndex(e => e.id === 'gantry-3');
  assert.equal(LEVEL_EIGHT.encounters[successive - 1].type, 'gantry', 'F08: openings R then C are successive encounters');
  assert.ok(effectiveWarningS(LEVEL_EIGHT, successive) >= 0.7 + 0.28 + 0.15);
  const twoChanges = LEVEL_NINE.encounters.findIndex(e => e.id === 'gantry-2');
  assert.equal(Math.abs(LEVEL_NINE.encounters[twoChanges].safeLane - LEVEL_NINE.encounters[twoChanges - 1].safeLane), 2);
  assert.ok(effectiveWarningS(LEVEL_NINE, twoChanges) >= 0.45 + 2 * 0.28 + 0.15, 'F09: R→L before the side gantry');
});

test('F07-T01/F07-A01: at most two known hazard families per encounter; a third is rejected', () => {
  for (const level of LEVELS) for (const group of envelopes(level)) assert.ok(new Set(group.map(e => e.type)).size <= MAX_FAMILIES_PER_ENCOUNTER, `${level.id}/${group[0].id}`);
  const families = new Set(M4.flatMap(level => level.encounters.map(e => e.type)));
  assert.deepEqual([...families].sort(), ['barrier', 'gantry', 'gap', 'gate', 'poles', 'ramp', 'wagon'], 'no unseen family in the hard phases');
  const index = LEVEL_SEVEN.encounters.findIndex(e => e.id === 'gap-1');
  const extra = { id: 'poles-x', type: 'poles', s: 150, length: 3.5, lanes: [], safeLane: -1, group: LEVEL_SEVEN.encounters[index].group, message: 'x' };
  const tooMany = { ...LEVEL_SEVEN, encounters: [...LEVEL_SEVEN.encounters.slice(0, index + 1), extra, ...LEVEL_SEVEN.encounters.slice(index + 1)] };
  assert.ok(validateLevel(tooMany).includes('Too many hazard families in one encounter'));
});

test('M4-A02/F07-T02: ground routes finish with every train at 30/60/120 FPS; late reaction too; no input crashes', () => {
  for (const level of M4) {
    for (const trainId of Object.keys(TRAIN_CATALOG)) {
      const late = traverse(level, lateReactionRoute(level), { trainId, collect: false });
      assert.equal(late.mode, 'levelComplete', `${level.id}/${trainId} late: ${late.reason}`);
    }
    const runs = [30, 60, 120].map(fps => traverse(level, ROUTES[level.id], { fps, collect: false }));
    for (const r of runs) assert.deepEqual([r.mode, r.tick, r.score], ['levelComplete', runs[0].tick, 0]);
    const idle = traverse(level, [], { collect: false });
    assert.equal(idle.mode, 'over', `${level.id} must punish no input`); // Phase 7 survives its first ramp+gap by jumping.
    assert.ok(idle.dist < level.lengthM / 2);
  }
});

test('F07-T03/F08/F09: acrobatic variants land and still have a full warning before the next lane change', () => {
  for (const level of M4) {
    const poses = new Map();
    const result = traverse(level, AIR_ROUTES[level.id], { collect: false, onPose: pose => poses.set(pose.tick, pose) });
    assert.equal(result.mode, 'levelComplete', `${level.id}: ${result.reason}`);
    const lands = result.events.filter(e => e.type === 'land');
    assert.ok(lands.length >= 1 && lands.length === result.events.filter(e => e.type === 'launch').length);
    for (const land of lands) {
      const pose = poses.get(land.tick), lane = Math.round(pose.front / 3.4);
      const index = level.encounters.findIndex(e => encounterStart(e) > pose.dist && !(e.group && level.encounters[level.encounters.indexOf(e) - 1]?.group === e.group));
      if (index < 0) continue;
      const next = level.encounters[index], k = Math.abs(next.safeLane - lane), budget = budgetFor(level);
      const available = (encounterStart(next) - TRAIN_GEOMETRY.carLength / 2 - pose.dist) / level.maxSpeedMps;
      assert.ok(available >= Math.max(budget.warningS, budget.reactionS + k * 0.28 + 0.15), `${level.id}: landing at ${pose.dist.toFixed(1)} leaves ${available.toFixed(2)}s before ${next.id}`);
    }
  }
});

test('F07-T04/F09: moving wagons in combined encounters never reach the escape lane, which has no gap', () => {
  for (const level of M4) {
    const content = createLevelContent(level);
    for (const wagon of content.wagons) {
      const group = envelopes(level).find(g => g.some(e => e.id === wagon.encounterId)), safe = group[0].safeLane;
      for (let t = wagon.startTimeS; t <= wagon.startTimeS + WAGON.inS + WAGON.holdS + WAGON.outS; t += 1 / 60) {
        assert.equal(hitsBox(wagonBox(wagon, t), { dist: wagon.s, front: safe * 3.4, rear: safe * 3.4, slant: 0, bottom: 0 }, TRAIN_GEOMETRY), false, `${level.id}/${wagon.id}`);
      }
      for (const e of group) if (e.type === 'gap') assert.ok(!e.lanes.includes(safe));
    }
  }
});

test('M4-T03/M4-A03: the trophy needs nine official completions, is granted once and survives reload', () => {
  const store = storage({ acrobatic_train_bank_points: '777' }), progress = new ProgressStore(store);
  for (let n = 1; n <= 8; n++) assert.equal(progress.complete({ levelId: `level-0${n}`, score: 0, timeS: 40, eventId: `e${n}` }), true);
  assert.deepEqual(progress.snapshot().achievements, []); assert.equal(progress.hasTrophy(), false);
  assert.equal(progress.complete({ levelId: 'level-09', score: 0, timeS: 40, eventId: 'final', source: 'mod' }), false);
  assert.equal(progress.hasTrophy(), false);
  assert.equal(progress.complete({ levelId: 'level-09', score: 0, timeS: 40, eventId: 'final' }), true);
  assert.deepEqual(progress.snapshot().achievements, [TROPHY_ID]);
  assert.equal(progress.complete({ levelId: 'level-09', score: 0, timeS: 40, eventId: 'final' }), false, 'duplicate event');
  assert.equal(progress.complete({ levelId: 'level-09', score: 900, timeS: 35, eventId: 'retry' }), true);
  assert.deepEqual(progress.snapshot().achievements, [TROPHY_ID], 'retrying the final keeps one trophy');
  assert.equal(progress.continueLevelId(), 'level-09');
  const reloaded = new ProgressStore(store);
  assert.equal(reloaded.hasTrophy(), true); assert.equal(reloaded.snapshot().results['level-09'].bestScore, 900);
  assert.equal(store.map.get('acrobatic_train_bank_points'), '777');
  const saved = JSON.parse(store.map.get(PROGRESS_KEY));
  delete saved.results['level-05'];
  assert.equal(new ProgressStore(storage({ [PROGRESS_KEY]: JSON.stringify(saved) })).hasTrophy(), false, 'forged trophy without nine results');
  const missingFlag = JSON.parse(store.map.get(PROGRESS_KEY)); missingFlag.achievements = [];
  assert.equal(new ProgressStore(storage({ [PROGRESS_KEY]: JSON.stringify(missingFlag) })).hasTrophy(), true, 'nine valid results imply the trophy');
});

test('M4-T05/M4-A05: infinite runs past 1500 m and unofficial sources never touch official progress', () => {
  const progress = new ProgressStore(storage()), before = JSON.stringify(progress.snapshot());
  const run = new RunSession({ canStartLevel: level => progress.canPlay(level.id) }); let completions = 0;
  run.events.on('levelCompleted', () => completions++);
  run.start(getTrainGameplayProfile('class395'));
  for (let i = 0; i < 60 * 80 && run.travel.dist < 1600; i++) run.step(1 / 60);
  assert.ok(run.travel.dist >= 1500); assert.equal(run.state.mode, 'playing'); assert.equal(completions, 0);
  for (const source of ['mod', 'online', 'infinite']) assert.equal(progress.complete({ levelId: 'level-01', score: 0, timeS: 40, eventId: source, source }), false);
  assert.equal(JSON.stringify(progress.snapshot()), before);
});

test('M4-T02: the whole campaign 1→9 is won with the free train, zero score and no API', () => {
  const progress = new ProgressStore(storage());
  for (const level of LEVELS) {
    assert.equal(progress.canPlay(level.id), true, level.id);
    const result = traverse(level, ROUTES[level.id], { trainId: 'cyber', collect: false });
    assert.equal(result.mode, 'levelComplete', `${level.id}: ${result.reason}`); assert.equal(result.score, 0);
    assert.equal(progress.complete({ levelId: level.id, score: result.score, timeS: result.timeS, eventId: `${level.id}:run` }), true);
  }
  assert.equal(progress.hasTrophy(), true); assert.equal(Object.keys(progress.snapshot().results).length, 9);
});

test('M4 fixtures: persisted levels 7–9, ground and air replays match production', () => {
  for (const level of M4) {
    for (const [file, commands] of [[level.id, ROUTES[level.id]], [`${level.id}-air`, AIR_ROUTES[level.id]]]) {
      const replay = JSON.parse(fs.readFileSync(new URL(`./fixtures/replays/${file}.json`, import.meta.url)));
      assert.deepEqual(replay.commands, commands);
      assert.equal(traverse(level, replay.commands, { trainId: replay.profile, collect: false }).mode, replay.expected.mode);
    }
  }
});
