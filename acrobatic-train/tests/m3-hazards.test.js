import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { LEVEL_FOUR, LEVEL_FIVE, LEVEL_SIX, LEVELS, validateLevel, createLevelContent, effectiveWarningS, requiredWarningS, warningStart, encounterStart, encounterEnd, budgetFor, getWarning } from '../src/levels/level-config.js';
import { arrivalTimeS } from '../src/levels/hazard-registry.js';
import { GATE, GANTRY, WAGON, gateCycle, gateBoom, hitsGate, gantryBoxes, hitsGantry, hitsBox, wagonLat, wagonBox, sweptHitsWagon, HazardWorld } from '../src/physics/hazards.js';
import { TRAIN_GEOMETRY } from '../src/physics/acrobatics.js';
import { createRailGate, createGantry, createMaintenanceWagon } from '../src/entities/obstacles.js';
import { TRAIN_CATALOG } from '../src/entities/train-factory.js';
import { ProgressStore } from '../src/core/progress-store.js';
import { traverse } from './helpers/traversal.js';
import { ROUTES, OPEN_GATE_ROUTE, L6_AIR_ROUTE } from './helpers/routes.js';
import { lateReactionRoute } from './helpers/late-route.js';

const M3 = [LEVEL_FOUR, LEVEL_FIVE, LEVEL_SIX];
const aligned = (s, lane) => ({ dist: s, front: lane * 3.4, rear: lane * 3.4, slant: 0, bottom: 0 });
const gateAt = (lane, phaseOffsetS = 0, s = 100) => ({ id: `g${lane}`, s, lane, pivotLat: lane === 0 ? 1.7 : lane * 5.1, dir: lane === 0 ? -1 : -lane, phaseOffsetS });
const levelGate = (content, id) => content.gates.find(g => g.id === id);
const setArrivalCycle = (level, gate, cycleS) => { gate.phaseOffsetS = (((cycleS - arrivalTimeS(level, gate.s)) % 8) + 8) % 8; };

test('M3-T01/F04-T02: gate cycle has explicit half-open boundaries and the collider follows the boom', () => {
  const gate = gateAt(0);
  const expected = [[0, 'open'], [2.999, 'open'], [3, 'warning'], [4.399, 'warning'], [4.4, 'closing'], [4.999, 'closing'], [5, 'closed'], [6.999, 'closed'], [7, 'reopening'], [7.999, 'reopening'], [8, 'open']];
  for (const [t, phase] of expected) assert.equal(gateCycle(gate, t).phase, phase, `t=${t}`);
  assert.equal(gateCycle(gate, 4.4).angle, Math.PI / 2); assert.equal(gateCycle(gate, 5).angle, 0); assert.equal(gateCycle(gate, 7).angle, 0);
  const train = aligned(100, 0);
  for (const t of [0, 2.9, 3.5, 4.39]) assert.equal(hitsGate(gate, train, t, TRAIN_GEOMETRY), null, `boom up at ${t}`);
  for (const t of [4.75, 5, 6, 6.99, 7.3]) assert.equal(hitsGate(gate, train, t, TRAIN_GEOMETRY), 'boom', `boom down at ${t}`);
  // No invisible swap: the boom passes through every intermediate height while closing.
  let last = Infinity;
  for (let t = 4.4; t <= 5; t += 0.01) { const y = gateBoom(gate, t).y1; assert.ok(y <= last + 1e-9); last = y; }
  for (const lane of [-1, 1]) assert.equal(hitsGate(gate, aligned(100, lane), 6, TRAIN_GEOMETRY), null, `lane ${lane} free while centre closed`);
  assert.equal(hitsGate(gate, aligned(115, 0), 6, TRAIN_GEOMETRY), null, 'longitudinally clear');
  assert.equal(hitsGate(gate, { ...train, bottom: 1.4 }, 6, TRAIN_GEOMETRY), null, 'train above the lowered boom');
});

test('F04-T02/M3-T05: rendered boom matches the collider boom at every sampled time', () => {
  const gate = { ...gateAt(1, 1.3), s: 0 }, asset = createRailGate(THREE, gate);
  for (let t = 0; t < 16; t += 0.137) {
    asset.update(t); asset.group.updateMatrixWorld(true);
    const arm = asset.movers[0], tip = arm.localToWorld(new THREE.Vector3(0, 0, GATE.boomLength)), boom = gateBoom(gate, t);
    assert.ok(Math.abs(tip.z - boom.x1) < 1e-6 && Math.abs(tip.y - boom.y1) < 1e-6, `t=${t}`);
  }
  let calls = 0; const seen = new Set();
  asset.group.traverse(o => { for (const r of [o.geometry, o.material]) if (r && !seen.has(r)) { seen.add(r); r.addEventListener('dispose', () => calls++); } });
  asset.dispose(); assert.equal(calls, seen.size);
});

test('F04-T03: pausing 5 s during the warning freezes cycle, boom and progress', () => {
  const level = LEVEL_FOUR, observed = [];
  const pauses = [{ atM: 70, frames: 300, onPaused: (run, edge) => { const gate = levelGate(createLevelContent(level), 'gate-1:0'); observed.push({ edge, timeS: run.timeS, dist: run.travel.dist, cycle: gateCycle(gate, run.timeS) }); } }];
  const paused = traverse(level, ROUTES[level.id], { collect: false, pauses }), straight = traverse(level, ROUTES[level.id], { collect: false });
  assert.equal(observed.length, 2); assert.deepEqual(observed[0].cycle, observed[1].cycle);
  assert.equal(observed[0].timeS, observed[1].timeS); assert.equal(observed[0].dist, observed[1].dist);
  assert.equal(paused.mode, 'levelComplete'); assert.equal(paused.tick, straight.tick);
});

test('F04-T04/F04-A04: the gate-free route works for every cycle offset', () => {
  for (const offset of [0, 2, 4, 6]) for (const fps of [30, 120]) {
    const result = traverse(LEVEL_FOUR, ROUTES['level-04'], { collect: false, fps, editContent: content => content.gates.forEach(g => { g.phaseOffsetS = offset; }) });
    assert.equal(result.mode, 'levelComplete', `offset ${offset} @${fps}: ${result.reason}`);
  }
});

test('F04-T05/F04-A05: the same lane passes the open window and crashes on the closed one', () => {
  const open = traverse(LEVEL_FOUR, OPEN_GATE_ROUTE, { collect: false });
  assert.equal(open.mode, 'levelComplete', open.reason);
  for (const [id, cycle] of [['gate-2:-1', 6], ['gate-2:-1', 5.2], ['gate-3:1', 6.8]]) {
    const closed = traverse(LEVEL_FOUR, OPEN_GATE_ROUTE, { collect: false, editContent: content => setArrivalCycle(LEVEL_FOUR, levelGate(content, id), cycle) });
    assert.equal(closed.mode, 'over'); assert.equal(closed.reason, 'gate'); assert.equal(closed.hit.id, id);
  }
  const noInput = traverse(LEVEL_FOUR, [], { collect: false });
  assert.equal(noInput.hit.id, 'gate-1:0', 'first gate is closed when the train arrives');
});

test('F04-T01/F05-T04/C-07: every warning lasts the group budget and the k-lane-change formula', () => {
  for (const level of M3) {
    assert.deepEqual(validateLevel(level), []);
    const budget = budgetFor(level); assert.deepEqual(budget, { reactionS: 1, warningS: 2, restS: 2 });
    level.encounters.forEach((e, i) => {
      if (i > 0 && e.group && e.group === level.encounters[i - 1].group) return;
      assert.ok(effectiveWarningS(level, i) >= requiredWarningS(level, i), `${level.id}/${e.id}`);
    });
  }
  const r2l = LEVEL_FIVE.encounters.findIndex(e => e.id === 'gantry-3');
  assert.equal(Math.abs(LEVEL_FIVE.encounters[r2l].safeLane - LEVEL_FIVE.encounters[r2l - 1].safeLane), 2);
  assert.ok(effectiveWarningS(LEVEL_FIVE, r2l) >= 1 + 2 * 0.28 + 0.15);
});

test('C-03/M3-T04: late-reaction routes still finish with every normalized train', () => {
  for (const level of M3) for (const trainId of Object.keys(TRAIN_CATALOG)) {
    const result = traverse(level, lateReactionRoute(level), { trainId, collect: false });
    assert.equal(result.mode, 'levelComplete', `${level.id}/${trainId}: ${result.reason}`); assert.equal(result.score, 0);
  }
});

test('M3-T02/F05-T01..T03: gantry accepts aligned trains, rejects diagonal, lateral and roof contact', () => {
  const gantry = { id: 'p', s: 100, openLat: 0, openLane: 0 };
  assert.equal(hitsGantry(gantry, aligned(100, 0), TRAIN_GEOMETRY), null);
  assert.equal(hitsGantry(gantry, { ...aligned(100, 0), top: TRAIN_GEOMETRY.bodyHeight + 0.9 }, TRAIN_GEOMETRY), null, 'lane-change hop fits under the lintel');
  const clearance = GANTRY.openingWidth / 2 - TRAIN_GEOMETRY.carWidth / 2;
  assert.equal(hitsGantry(gantry, { ...aligned(100, 0), front: clearance - 0.05, rear: clearance - 0.05 }, TRAIN_GEOMETRY), null);
  assert.equal(hitsGantry(gantry, { ...aligned(100, 0), front: clearance + 0.05, rear: clearance + 0.05 }, TRAIN_GEOMETRY), 'side');
  const diagonal = { dist: 100, front: 0, rear: 3.4, slant: Math.asin(-3.4 / (TRAIN_GEOMETRY.bogie * 2)), bottom: 0 };
  assert.equal(hitsGantry(gantry, diagonal, TRAIN_GEOMETRY), 'side', 'front in the opening does not free the rest of the body');
  for (const lane of [-1, 1]) assert.equal(hitsGantry(gantry, aligned(100, lane), TRAIN_GEOMETRY), 'side');
  assert.equal(hitsGantry(gantry, { ...aligned(100, 0), bottom: 3 }, TRAIN_GEOMETRY), 'roof', 'jump inside the opening hits the lintel');
  assert.equal(hitsGantry(gantry, { ...aligned(100, 0), bottom: GANTRY.roofTop + 0.1 }, TRAIN_GEOMETRY), null, 'clears it entirely only above the roof');
  const world = new HazardWorld({ gantries: [gantry] }, TRAIN_GEOMETRY);
  assert.equal(world.check({ ...aligned(100, 0), bottom: 3, timeS: 1 }).part, 'roof');
  const asset = createGantry(THREE, gantry), boxes = gantryBoxes(gantry);
  const meshes = asset.group.children.filter(o => o.geometry?.type === 'BoxGeometry');
  assert.equal(meshes.length, boxes.length);
  meshes.forEach((mesh, i) => {
    const b = new THREE.Box3().setFromObject(mesh), box = boxes[i];
    assert.ok(Math.abs(b.min.y - box.yMin) < 1e-6 && Math.abs(b.max.y - box.yMax) < 1e-6);
    assert.ok(Math.abs(b.min.z - (box.lat - box.width / 2)) < 1e-6 && Math.abs(b.max.z - (box.lat + box.width / 2)) < 1e-6);
  });
  asset.dispose();
});

test('F05-T05/F06-A05: grouped final encounters keep one lane and the air variant lands before the crossing', () => {
  for (const level of [LEVEL_FIVE, LEVEL_SIX]) {
    const group = level.encounters.filter(e => e.group === 'final');
    assert.equal(group.length, 2); assert.equal(new Set(group.map(e => e.safeLane)).size, 1);
    assert.ok(encounterStart(group[1]) > encounterEnd(group[0]));
  }
  const air = traverse(LEVEL_SIX, L6_AIR_ROUTE, { collect: false });
  assert.equal(air.mode, 'levelComplete', air.reason);
  const land = air.events.find(e => e.type === 'land'), final = LEVEL_SIX.encounters.find(e => e.group === 'final');
  assert.ok(land && land.tick / 60 < arrivalTimeS(LEVEL_SIX, warningStart(LEVEL_SIX, final)), 'landing happens before the final warning');
});

test('M3-T03/F06-T02: swept test catches a crossing whose two endpoints are apart', () => {
  const wagon = { id: 'w', s: 100, side: -1, restLat: 0, reachLat: 0, startTimeS: 0 };
  const before = { ...aligned(100 - 8, 0), timeS: 1 }, after = { ...aligned(100 + 8, 0), timeS: 1 + 1 / 60 };
  assert.equal(hitsBox(wagonBox(wagon, before.timeS), before, TRAIN_GEOMETRY), false);
  assert.equal(hitsBox(wagonBox(wagon, after.timeS), after, TRAIN_GEOMETRY), false);
  assert.equal(sweptHitsWagon(wagon, before, after, TRAIN_GEOMETRY), true);
  const lateral = { id: 'l', s: 100, side: -1, restLat: -9, reachLat: 9, startTimeS: 0 };
  const still = t => ({ ...aligned(100, 0), timeS: t });
  const t0 = WAGON.inS * 0.2, t1 = WAGON.inS * 0.8;
  assert.equal(hitsBox(wagonBox(lateral, t0), still(t0), TRAIN_GEOMETRY), false); assert.equal(hitsBox(wagonBox(lateral, t1), still(t1), TRAIN_GEOMETRY), false);
  assert.equal(sweptHitsWagon(lateral, still(t0), still(t1), TRAIN_GEOMETRY), true);
  const ticks = [30, 60, 120].map(fps => traverse(LEVEL_SIX, [], { fps, collect: false }));
  for (const r of ticks) { assert.equal(r.reason, 'wagon'); assert.equal(r.hit.id, 'wagon-1'); assert.equal(r.tick, ticks[0].tick); }
});

test('F06-T01/F06-T03/M3-A03: wagons start off-track, never reach the escape lane and never spawn on the train', () => {
  for (const level of M3) for (const wagon of createLevelContent(level).wagons) {
    const encounter = level.encounters.find(e => e.id === wagon.encounterId);
    assert.ok(Math.abs(wagonLat(wagon, 0)) - WAGON.length / 2 >= 3.4 + TRAIN_GEOMETRY.carWidth / 2 + 1.5);
    assert.ok(wagon.startTimeS > arrivalTimeS(level, warningStart(level, encounter)) - 0.5, 'movement starts around the warning, not after contact');
    for (let t = wagon.startTimeS; t <= wagon.startTimeS + WAGON.inS + WAGON.holdS + WAGON.outS; t += 1 / 60) {
      assert.equal(hitsBox(wagonBox(wagon, t), aligned(wagon.s, encounter.safeLane), TRAIN_GEOMETRY), false, `${wagon.id} at ${t}`);
    }
    const arrival = arrivalTimeS(level, wagon.s);
    for (const lane of encounter.lanes) assert.equal(hitsBox(wagonBox(wagon, arrival), aligned(wagon.s, lane), TRAIN_GEOMETRY), true, `${wagon.id} blocks ${lane}`);
  }
  const asset = createMaintenanceWagon(THREE, createLevelContent(LEVEL_SIX).wagons[0]), wagon = createLevelContent(LEVEL_SIX).wagons[0];
  for (let t = 0; t < 12; t += 0.25) { asset.update(t); assert.equal(asset.movers[0].position.z, wagonLat(wagon, t)); }
  const bounds = new THREE.Box3().setFromObject(asset.movers[0]);
  assert.ok(Math.abs(bounds.max.z - bounds.min.z - WAGON.length) < 1e-6); assert.ok(Math.abs(bounds.max.x - bounds.min.x - WAGON.depth) < 1e-6);
  asset.dispose();
});

test('F06-T04: pause during the crossing freezes the wagon; retry reproduces the same trajectory', () => {
  const seen = [];
  const pauses = [{ atM: 120, frames: 300, onPaused: (run, edge) => seen.push({ edge, lat: wagonLat(createLevelContent(LEVEL_SIX).wagons[0], run.timeS) }) }];
  const paused = traverse(LEVEL_SIX, ROUTES['level-06'], { collect: false, pauses }), plain = traverse(LEVEL_SIX, ROUTES['level-06'], { collect: false });
  assert.equal(seen[0].lat, seen[1].lat); assert.notEqual(seen[0].lat, wagonLat(createLevelContent(LEVEL_SIX).wagons[0], 0));
  assert.equal(paused.tick, plain.tick); assert.equal(paused.mode, 'levelComplete');
  assert.deepEqual(createLevelContent(LEVEL_SIX).wagons, plain.content.wagons);
});

test('C-02/M3-A05: M3 replays end on the same tick at 30/60/120 FPS; HUD state follows simulation time', () => {
  for (const level of M3) {
    const runs = [30, 60, 120].map(fps => traverse(level, ROUTES[level.id], { fps, collect: false }));
    for (const r of runs) assert.deepEqual([r.mode, r.tick, r.dist], [runs[0].mode, runs[0].tick, runs[0].dist]);
  }
  const content = createLevelContent(LEVEL_FOUR), gate = LEVEL_FOUR.encounters[0], at = warningStart(LEVEL_FOUR, gate) + 1;
  const arrival = arrivalTimeS(LEVEL_FOUR, gate.s);
  assert.match(getWarning(LEVEL_FOUR, at, { content, timeS: arrival - 0.2 }), /FECHADA$/);
  assert.match(getWarning(LEVEL_FOUR, at, { content, timeS: arrival - 4 }), /ABERTA$/);
  assert.equal(getWarning(LEVEL_FOUR, at), gate.message, 'no state suffix without simulation time');
  assert.match(getWarning(LEVEL_FOUR, warningStart(LEVEL_FOUR, LEVEL_FOUR.encounters[2]) + 1, { content, timeS: 1 }), /^CANCELAS.* · ESQ .* · DIR /);
  assert.match(getWarning(LEVEL_SIX, warningStart(LEVEL_SIX, LEVEL_SIX.encounters[0]) + 1, { content: createLevelContent(LEVEL_SIX), timeS: 0 }), /VAGÃO PARADO$/);
});

test('TC-01/C-01: invalid M3 configurations are rejected with a reason', () => {
  const swap = (level, i, patch) => ({ ...level, encounters: level.encounters.map((e, j) => j === i ? { ...e, ...patch } : e) });
  assert.ok(validateLevel(swap(LEVEL_FOUR, 0, { arrivalCycleS: [9] })).includes('Invalid gate cycle'));
  assert.ok(validateLevel(swap(LEVEL_FOUR, 0, { safeLane: 0 })).includes('No terrestrial route'));
  assert.ok(validateLevel(swap(LEVEL_FIVE, 0, { lanes: [-1] })).some(e => e.startsWith('Gantry')));
  assert.ok(validateLevel(swap(LEVEL_SIX, 0, { lanes: [-1, 0], safeLane: 0 })).length);
  assert.ok(validateLevel(swap(LEVEL_SIX, 0, { lanes: [0, -1] })).some(e => e.startsWith('Wagon lanes')));
  assert.ok(validateLevel(swap(LEVEL_SIX, 0, { s: 70 })).includes('Unsafe start/finish'));
  assert.ok(validateLevel(swap(LEVEL_FIVE, 5, { safeLane: 1, lanes: [-1, 0] })).includes('Grouped encounters must share a lane and stay ordered'));
  assert.ok(validateLevel(swap(LEVEL_FOUR, 1, { s: 175 })).some(e => e === 'Insufficient recovery' || e.startsWith('Warning budget')));
});

test('F04-T06/F05-T06/F06-T06: zero-score arrival unlocks the next phase; repeated M3 assets dispose to baseline', () => {
  const progress = new ProgressStore(), events = ['level-01', 'level-02', 'level-03'];
  for (const id of events) progress.complete({ levelId: id, score: 0, timeS: 40, eventId: id });
  for (const level of M3) {
    const run = traverse(level, ROUTES[level.id], { collect: false });
    assert.equal(run.score, 0);
    assert.equal(progress.complete({ levelId: level.id, score: run.score, timeS: run.timeS, eventId: `${level.id}:complete` }), true);
  }
  assert.equal(progress.snapshot().highestUnlockedLevel, 7); assert.equal(progress.canPlay('level-07'), true);
  let created = 0, disposed = 0;
  for (let cycle = 0; cycle < 30; cycle++) for (const level of M3) {
    const content = createLevelContent(level);
    const assets = [...content.gates.map(g => createRailGate(THREE, g)), ...content.gantries.map(g => createGantry(THREE, g)), ...content.wagons.map(w => createMaintenanceWagon(THREE, w))];
    for (const asset of assets) {
      const owned = new Set();
      asset.group.traverse(o => { for (const r of [o.geometry, o.material]) if (r && !owned.has(r)) { owned.add(r); created++; r.addEventListener('dispose', () => disposed++); } });
      asset.dispose();
    }
  }
  assert.ok(created > 0); assert.equal(disposed, created);
});

test('M3-T06: persisted M3 replays (optional challenges included) still match production', () => {
  for (const [file, route] of [['level-04-open-gates', OPEN_GATE_ROUTE], ['level-06-air', L6_AIR_ROUTE]]) {
    const replay = JSON.parse(fs.readFileSync(new URL(`./fixtures/replays/${file}.json`, import.meta.url)));
    assert.deepEqual(replay.commands, route);
    const level = LEVELS.find(l => l.seed === replay.seed);
    assert.equal(traverse(level, replay.commands, { trainId: replay.profile, collect: false }).mode, replay.expected.mode);
  }
});
