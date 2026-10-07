import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../scripts/server/rooms.js';
import { PROTOCOL_VERSION, LIMITS, parseClientMessage, contentHash } from '../src/network/protocol.js';
import { getLevel, LEVELS } from '../src/levels/level-config.js';
import { arrivalTimeS } from '../src/levels/hazard-registry.js';
import { createRng } from '../src/core/rng.js';
import { ProgressStore } from '../src/core/progress-store.js';
import { traverse } from './helpers/traversal.js';
import { ROUTES } from './helpers/routes.js';

const TICK_MS = 1000 / 60;
/** Fake clock + loop + sockets: the manager never touches real time in these tests. */
function harness() {
  const clock = { t: 1_000_000 }, loops = new Set(), rng = createRng('rooms-test'); let ids = 0;
  const manager = new RoomManager({ now: () => clock.t, schedule: fn => { const h = { fn }; loops.add(h); return h; }, cancel: h => loops.delete(h), uuid: () => `p${++ids}`, random: max => Math.floor(rng() * max) });
  const client = () => {
    const conn = { inbox: [], closed: false, send(text) { this.inbox.push(JSON.parse(text)); }, close() { this.closed = true; } };
    manager.connect(conn);
    const api = {
      conn, send: msg => manager.message(conn, JSON.stringify({ v: PROTOCOL_VERSION, ...msg })), raw: text => manager.message(conn, text),
      last: type => conn.inbox.filter(m => m.type === type).at(-1), all: type => conn.inbox.filter(m => m.type === type),
      errors: () => conn.inbox.filter(m => m.type === 'error').map(m => m.code),
    };
    return api;
  };
  const advance = ms => { const end = clock.t + ms; while (clock.t < end) { clock.t = Math.min(end, clock.t + TICK_MS); manager.update(clock.t); } };
  return { manager, clock, loops, client, advance };
}
function pair(levelId = 'level-01') {
  const h = harness(), a = h.client(), b = h.client();
  a.send({ type: 'join', name: 'Ana', create: { levelId } });
  const room = a.last('joined').roomId;
  b.send({ type: 'join', name: 'Bia', room });
  return { ...h, a, b, room, hash: contentHash(levelId) };
}
function startRace(p) {
  p.a.send({ type: 'ready', ready: true, contentHash: p.hash }); p.b.send({ type: 'ready', ready: true, contentHash: p.hash });
  return p.a.last('start');
}
/** Route commands as inputs on the first tick whose distance reaches atM (same integrator as the server). */
const routeInputs = (level, commands) => commands.map(c => ({ tick: Math.round(arrivalTimeS(level, c.atM) * 60), lanes: { front: c.front, rear: c.rear } }));

test('protocol: schema whitelist, version, size and JSON are enforced', () => {
  assert.equal(parseClientMessage('{').code, 'bad-json');
  assert.equal(parseClientMessage('x'.repeat(LIMITS.maxMessageBytes + 1)).code, 'too-large');
  assert.equal(parseClientMessage(JSON.stringify({ v: 99, type: 'ping', t: 1 })).code, 'version');
  assert.equal(parseClientMessage(JSON.stringify({ v: PROTOCOL_VERSION, type: 'result', winner: 'me' })).code, 'bad-message');
  assert.equal(parseClientMessage(JSON.stringify({ v: PROTOCOL_VERSION, type: 'join', create: { levelId: 'level-99' } })).code, 'bad-level');
  const forged = parseClientMessage(JSON.stringify({ v: PROTOCOL_VERSION, type: 'input', runId: 1, seq: 1, tick: 5, lanes: { front: 1 }, dist: 9999, score: 1e6, participantId: 'other', state: 'finished' }));
  assert.deepEqual(forged.msg, { type: 'input', runId: 1, seq: 1, tick: 5, lanes: { front: 1 } });
  assert.equal(parseClientMessage(JSON.stringify({ v: PROTOCOL_VERSION, type: 'input', runId: 1, seq: 1, tick: 5, lanes: { front: 2 } })).code, 'bad-message');
  assert.match(contentHash('level-09'), /^m4-v1:[0-9a-f]{8}$/); assert.notEqual(contentHash('level-01'), contentHash('level-02'));
});

test('M5-T01 (server side): two join and start once; a third, a wrong version and a wrong content are refused', () => {
  const p = pair('level-04'), c = p.client();
  c.send({ type: 'join', name: 'Caio', room: p.room }); assert.deepEqual(c.errors(), ['room-full']);
  const old = p.client(); old.raw(JSON.stringify({ v: PROTOCOL_VERSION + 1, type: 'join', name: 'x', room: p.room })); assert.deepEqual(old.errors(), ['version']);
  p.a.send({ type: 'ready', ready: true, contentHash: 'm1-v0:deadbeef' }); assert.deepEqual(p.a.errors(), ['content-mismatch']);
  const start = startRace(p);
  assert.equal(p.a.all('start').length, 1); assert.deepEqual(p.b.last('start'), start);
  assert.equal(start.levelId, 'level-04'); assert.equal(start.seed, getLevel('level-04').seed); assert.equal(start.contentHash, p.hash); assert.equal(start.startTick, 0);
  const late = p.client(); late.send({ type: 'join', name: 'Duda', room: p.room }); assert.deepEqual(late.errors(), ['room-started']);
});

test('M5-T02: the server owns identity, layout and outcome; forged fields change nothing', () => {
  const p = pair(); startRace(p); p.advance(LIMITS.countdownMs + 500);
  p.a.raw(JSON.stringify({ v: PROTOCOL_VERSION, type: 'input', runId: 1, seq: 1, tick: 40, lanes: { front: -1 }, dist: 600, score: 99999, state: 'finished', participantId: 'p2' }));
  p.advance(200);
  const snap = p.a.last('snapshot'), mine = snap.players.find(x => x.id === 'p1'), other = snap.players.find(x => x.id === 'p2');
  assert.ok(mine.dist < 100); assert.equal(mine.score, 0); assert.equal(mine.state, 'running'); assert.equal(mine.targets.front, -1);
  assert.equal(other.targets.front, 0, 'input never applies to the other participant');
  assert.equal(p.a.all('result').length, 0);
});

test('M5-T03: duplicates, stale/future sequences, window, malformed frames and rate limits do not corrupt the room', () => {
  const p = pair(); startRace(p); p.advance(LIMITS.countdownMs + 1000);
  const tick = p.a.last('snapshot').tick; assert.ok(tick > LIMITS.inputLateTicks + 5);
  p.a.send({ type: 'input', runId: 1, seq: 5, tick: tick + 2, lanes: { front: -1, rear: -1 } });
  p.a.send({ type: 'input', runId: 1, seq: 5, tick: tick + 2, lanes: { front: 1, rear: 1 } });
  p.a.send({ type: 'input', runId: 1, seq: 3, tick: tick + 3, lanes: { front: 1 } });
  p.a.send({ type: 'input', runId: 1, seq: 6, tick: tick + LIMITS.inputAheadTicks + 5, lanes: { front: 1 } });
  p.a.send({ type: 'input', runId: 1, seq: 7, tick: tick - LIMITS.inputLateTicks - 5, lanes: { front: 1 } });
  p.a.send({ type: 'input', runId: 2, seq: 8, tick, lanes: { front: 1 } });
  p.a.raw('{"v":1,"type":"input"'); p.a.raw('x'.repeat(5000));
  assert.deepEqual(p.a.errors(), ['input-stale', 'input-stale', 'input-window', 'input-window', 'input-run', 'bad-json', 'too-large']);
  p.advance(500);
  const mine = p.a.last('snapshot').players.find(x => x.id === 'p1');
  assert.deepEqual(mine.targets, { front: -1, rear: -1 }); assert.equal(mine.lastSeq, 5, 'applied exactly once');
  for (let i = 0; i < LIMITS.maxInputsPerSecond + 10; i++) p.b.send({ type: 'input', runId: 1, seq: 100 + i, tick: p.a.last('snapshot').tick + 1, lanes: { front: i % 2 ? 1 : 0 } });
  assert.equal(p.b.errors().filter(c => c === 'rate-limited').length, 10);
  p.advance(300); assert.equal(p.a.last('snapshot').players.find(x => x.id === 'p1').state, 'running', 'opponent flood does not affect A');
});

test('M5-T05: first arrival wins and the result is emitted once and agrees for both', () => {
  const level = getLevel('level-01'), p = pair('level-01'); startRace(p);
  // A follows the reference route; B does nothing and hits the first barrier.
  let seq = 0; const inputs = routeInputs(level, ROUTES['level-01']);
  for (let elapsed = 0; elapsed < 60_000 && !p.a.last('result'); elapsed += 50) {
    const tick = p.a.last('snapshot')?.tick ?? 0;
    for (const input of inputs.filter(x => !x.sent && x.tick <= tick + 10)) { input.sent = true; p.a.send({ type: 'input', runId: 1, seq: ++seq, tick: input.tick, lanes: input.lanes }); }
    p.advance(50);
  }
  const ra = p.a.last('result'), rb = p.b.last('result');
  assert.deepEqual(ra, rb); assert.equal(p.a.all('result').length, 1);
  assert.equal(ra.reason, 'finish'); assert.equal(ra.winner, 'p1'); assert.equal(ra.draw, false);
  const expected = traverse(level, ROUTES['level-01'], { collect: true });
  assert.equal(ra.players[0].endTick, expected.tick, 'server and route harness agree on the finish tick');
  assert.equal(ra.players[1].state, 'crashed');
  p.a.send({ type: 'input', runId: 1, seq: ++seq, tick: ra.tick + 1, lanes: { front: 1 } });
  p.advance(1000); assert.equal(p.a.all('result').length, 1, 'late messages do not change the terminal result');
});

test('M5-T05: both crash → longer distance wins; identical runs → draw', () => {
  const p = pair('level-01'); startRace(p);
  p.advance(LIMITS.countdownMs + 100);
  p.a.send({ type: 'input', runId: 1, seq: 1, tick: p.a.last('snapshot').tick + 1, lanes: { front: 1, rear: 1 } });
  p.advance(30_000);
  const r = p.a.last('result');
  assert.equal(r.reason, 'crash'); assert.equal(r.winner, 'p1'); assert.ok(r.players[0].dist > r.players[1].dist);
  const q = pair('level-01'); startRace(q); q.advance(LIMITS.countdownMs + 30_000);
  const draw = q.a.last('result');
  assert.equal(draw.reason, 'crash'); assert.equal(draw.winner, null); assert.equal(draw.draw, true);
  assert.equal(draw.players[0].dist, draw.players[1].dist);
});

test('M5-T05: abandonment, disconnect grace, both leaving, lobby and result expiry', () => {
  const p = pair(); startRace(p); p.advance(LIMITS.countdownMs + 100);
  p.b.send({ type: 'leave' });
  assert.equal(p.a.last('result').reason, 'abandon'); assert.equal(p.a.last('result').winner, 'p1');
  const q = pair(); startRace(q); q.advance(LIMITS.countdownMs + 100);
  q.manager.disconnect(q.b.conn); q.advance(LIMITS.disconnectGraceMs - 100);
  assert.equal(q.a.all('result').length, 0, 'still inside the grace period');
  q.advance(200); assert.equal(q.a.last('result').reason, 'abandon'); assert.equal(q.a.last('result').winner, 'p1');
  const r = pair(); startRace(r); r.advance(LIMITS.countdownMs + 100);
  r.manager.disconnect(r.a.conn); r.manager.disconnect(r.b.conn); r.advance(LIMITS.disconnectGraceMs + 100);
  assert.equal(r.manager.rooms.get(r.room).result.reason, 'abandon-both'); assert.equal(r.manager.rooms.get(r.room).result.winner, null);
  r.advance(LIMITS.resultTtlMs + 100); assert.equal(r.manager.rooms.size, 0, 'result room expires');
  const idle = harness(), solo = idle.client(); solo.send({ type: 'join', name: 'x', create: { levelId: 'level-02' } });
  idle.advance(LIMITS.lobbyIdleMs + 100); assert.deepEqual(solo.errors(), ['room-expired']); assert.equal(idle.manager.rooms.size, 0);
  assert.equal(idle.loops.size, 0, 'loop stops with no rooms');
});

test('M5-T06/M5-A06: online results never write official progress, balance or trophy', () => {
  const progress = new ProgressStore(), before = JSON.stringify(progress.snapshot());
  const p = pair('level-09'); startRace(p); p.advance(LIMITS.countdownMs + 20_000);
  assert.ok(p.a.last('result'));
  assert.equal(progress.complete({ levelId: 'level-09', score: 0, timeS: 30, eventId: 'online', source: 'online' }), false);
  assert.equal(JSON.stringify(progress.snapshot()), before);
});

test('M5-T07: 100 rooms created and closed return rooms, connections and the loop to baseline', () => {
  const h = harness(), baseline = h.manager.stats();
  for (let i = 0; i < 100; i++) {
    const a = h.client(), b = h.client();
    a.send({ type: 'join', name: 'a', create: { levelId: LEVELS[i % 9].id } }); b.send({ type: 'join', name: 'b', room: a.last('joined').roomId });
    if (i % 2) { const hash = contentHash(LEVELS[i % 9].id); a.send({ type: 'ready', ready: true, contentHash: hash }); b.send({ type: 'ready', ready: true, contentHash: hash }); }
  }
  assert.equal(h.manager.rooms.size, 100); assert.equal(h.loops.size, 1, 'one shared loop for all rooms');
  h.advance(LIMITS.countdownMs + 100);
  for (const conn of [...h.manager.connections.keys()]) h.manager.disconnect(conn);
  h.advance(LIMITS.disconnectGraceMs + LIMITS.resultTtlMs + 200);
  assert.deepEqual(h.manager.stats(), baseline); assert.equal(h.loops.size, 0);
});
