import crypto from 'node:crypto';
import { getLevel } from '../../src/levels/level-config.js';
import { getTrainGameplayProfile } from '../../src/core/shop-state.js';
import { TrainSimulation } from '../../src/physics/train-sim.js';
import { LIMITS, ROOM_CODE_ALPHABET, parseClientMessage, contentHash, encode } from '../../src/network/protocol.js';

const TICK_MS = 1000 / LIMITS.tickHz;
const EPS = 1e-9;

/**
 * Authoritative two-player rooms. Transport-agnostic: a connection is any object with
 * send(text) and close(). Time comes from `now()` and the loop from `schedule/cancel`, so tests
 * drive everything deterministically with update(nowMs).
 */
export class RoomManager {
  constructor({ countdownMs = LIMITS.countdownMs, now = () => Date.now(), schedule = (fn, ms) => setInterval(fn, ms), cancel = handle => clearInterval(handle), random = max => crypto.randomInt(max), uuid = () => crypto.randomUUID() } = {}) {
    Object.assign(this, { countdownMs, now, schedule, cancel, random, uuid });
    this.rooms = new Map(); this.connections = new Map(); this.loop = null;
  }
  // ---------- transport entry points ----------
  connect(conn) { this.connections.set(conn, { conn, roomId: null, participantId: null, inputTimes: [] }); }
  message(conn, raw) {
    const client = this.connections.get(conn);
    if (!client) return;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.error(client, parsed.code);
    const { msg } = parsed, room = client.roomId ? this.rooms.get(client.roomId) : null;
    if (room) room.lastActivity = this.now();
    if (msg.type === 'ping') return this.send(client, { type: 'pong', t: msg.t, serverTime: this.now() });
    if (msg.type === 'join') return this.join(client, msg);
    if (!room) return this.error(client, 'not-in-room');
    const participant = room.participants.find(p => p.id === client.participantId);
    if (msg.type === 'ready') return this.ready(room, participant, msg);
    if (msg.type === 'input') return this.input(room, participant, client, msg);
    if (msg.type === 'leave') return this.leave(room, participant, { explicit: true });
  }
  disconnect(conn) {
    const client = this.connections.get(conn);
    this.connections.delete(conn);
    const room = client?.roomId ? this.rooms.get(client.roomId) : null;
    const participant = room?.participants.find(p => p.id === client.participantId);
    if (participant) this.leave(room, participant, { explicit: false });
  }
  // ---------- lobby ----------
  join(client, msg) {
    if (client.roomId) return this.error(client, 'already-in-room');
    let room;
    if (msg.create) room = this.createRoom(msg.create.levelId);
    else {
      room = this.rooms.get(msg.room);
      if (!room) return this.error(client, 'room-not-found');
      if (room.state !== 'lobby') return this.error(client, 'room-started');
      if (room.participants.length >= 2) return this.error(client, 'room-full');
    }
    const participant = { id: this.uuid(), slot: room.participants.length, name: msg.name, client, ready: false, connected: true, disconnectedAt: null, lastSeq: 0, appliedSeq: 0, pending: [], sim: null };
    room.participants.push(participant); client.roomId = room.id; client.participantId = participant.id; room.lastActivity = this.now();
    this.send(client, { type: 'joined', roomId: room.id, participantId: participant.id, slot: participant.slot, levelId: room.levelId, contentHash: room.contentHash });
    this.broadcastLobby(room);
  }
  createRoom(levelId) {
    let id;
    do id = Array.from({ length: 5 }, () => ROOM_CODE_ALPHABET[this.random(ROOM_CODE_ALPHABET.length)]).join(''); while (this.rooms.has(id));
    const room = { id, levelId, level: getLevel(levelId), contentHash: contentHash(levelId), state: 'lobby', participants: [], runId: 0, tick: 0, startAt: null, result: null, lastActivity: this.now(), closedAt: null };
    this.rooms.set(id, room); this.ensureLoop(); return room;
  }
  ready(room, participant, msg) {
    if (room.state !== 'lobby') return this.error(participant.client, 'room-started');
    if (msg.ready && msg.contentHash !== room.contentHash) { participant.ready = false; this.broadcastLobby(room); return this.error(participant.client, 'content-mismatch'); }
    participant.ready = msg.ready; this.broadcastLobby(room);
    if (room.participants.length === 2 && room.participants.every(p => p.ready)) this.start(room);
  }
  start(room) {
    room.state = 'countdown'; room.runId += 1; room.tick = 0; room.startAt = this.now() + this.countdownMs;
    const profile = getTrainGameplayProfile('cyber', room.level);
    for (const p of room.participants) Object.assign(p, { sim: new TrainSimulation(room.level, profile), lastSeq: 0, appliedSeq: 0, pending: [] });
    this.broadcast(room, { type: 'start', roomId: room.id, runId: room.runId, startTick: 0, startAt: room.startAt, serverTime: this.now(), levelId: room.levelId, seed: room.level.seed,
      contentHash: room.contentHash, profile: { trainId: 'cyber', visual: 'cyber' }, players: room.participants.map(p => ({ id: p.id, slot: p.slot, name: p.name })) });
  }
  // ---------- race ----------
  input(room, participant, client, msg) {
    const t = this.now();
    client.inputTimes = client.inputTimes.filter(time => t - time < 1000);
    if (client.inputTimes.length >= LIMITS.maxInputsPerSecond) return this.error(client, 'rate-limited');
    client.inputTimes.push(t);
    if (!['countdown', 'racing'].includes(room.state) || msg.runId !== room.runId) return this.error(client, 'input-run');
    if (!participant.sim.alive) return this.error(client, 'input-terminal');
    if (msg.seq <= participant.lastSeq) return this.error(client, 'input-stale');
    if (msg.tick > room.tick + LIMITS.inputAheadTicks || msg.tick < room.tick - LIMITS.inputLateTicks) return this.error(client, 'input-window');
    participant.lastSeq = msg.seq; // Received; snapshots report appliedSeq so clients never reconcile against an unapplied input.
    // Applied on the requested tick when still in the future, otherwise on the next eligible tick.
    participant.pending.push({ seq: msg.seq, tick: Math.max(msg.tick, room.tick + 1), lanes: msg.lanes });
  }
  stepRoom(room, now) {
    if (now < room.startAt) return;
    room.state = 'racing';
    const target = Math.min(Math.floor((now - room.startAt) / TICK_MS), room.tick + LIMITS.maxCatchUpTicks);
    while (room.tick < target && room.state === 'racing') {
      room.tick += 1;
      for (const p of room.participants) {
        const due = p.pending.filter(input => input.tick <= room.tick); p.pending = p.pending.filter(input => input.tick > room.tick);
        for (const input of due) { for (const [end, lane] of Object.entries(input.lanes)) p.sim.setLane(end, lane); p.appliedSeq = input.seq; }
        p.sim.step();
      }
      this.resolve(room);
      if (room.state === 'racing' && room.tick % LIMITS.snapshotEveryTicks === 0) this.broadcastSnapshot(room);
    }
  }
  /** First alive arrival wins; same tick → earlier crossing fraction; both crashed → distance, then score. */
  resolve(room) {
    const [a, b] = room.participants, sims = room.participants.map(p => p.sim);
    const finished = room.participants.filter(p => p.sim.state === 'finished');
    if (finished.length) {
      const first = finished.reduce((best, p) => (p.sim.endTick < best.sim.endTick || (p.sim.endTick === best.sim.endTick && p.sim.endFraction < best.sim.endFraction - EPS)) ? p : best);
      const tied = finished.filter(p => p.sim.endTick === first.sim.endTick && Math.abs(p.sim.endFraction - first.sim.endFraction) <= EPS);
      return this.finish(room, tied.length > 1 ? null : first, tied.length > 1 ? 'finish-tie' : 'finish');
    }
    if (sims.every(sim => sim.state === 'crashed')) {
      const order = (x, y) => (x.sim.travel.dist - y.sim.travel.dist) || (x.sim.score - y.sim.score);
      const cmp = order(a, b);
      return this.finish(room, Math.abs(cmp) <= EPS ? null : cmp > 0 ? a : b, 'crash');
    }
  }
  finish(room, winner, reason) {
    if (room.result) return;
    if (['countdown', 'racing'].includes(room.state)) this.broadcastSnapshot(room);
    room.state = 'result'; room.closedAt = this.now();
    room.result = { type: 'result', resultId: `${room.id}:${room.runId}`, reason, winner: winner?.id ?? null, draw: !winner && reason !== 'abandon-both',
      tick: room.tick, players: room.participants.map(p => ({ id: p.id, name: p.name, state: p.sim?.state ?? 'absent', endTick: p.sim?.endTick ?? null,
        endFraction: p.sim?.endFraction ?? null, dist: p.sim?.travel.dist ?? 0, score: p.sim?.score ?? 0, connected: p.connected })) };
    this.broadcast(room, room.result);
  }
  // ---------- leaving, expiry, loop ----------
  leave(room, participant, { explicit }) {
    if (!participant) return;
    if (room.state === 'lobby' || room.state === 'result') {
      room.participants = room.participants.filter(p => p !== participant);
      if (explicit) this.detach(participant.client);
      room.participants.forEach((p, slot) => { p.slot = slot; p.ready = false; });
      if (!room.participants.length) return this.closeRoom(room);
      return room.state === 'lobby' ? this.broadcastLobby(room) : undefined;
    }
    participant.connected = false; participant.disconnectedAt = this.now();
    if (explicit) { this.detach(participant.client); this.abandon(room); }
  }
  /** Abandonment after the start: the other active participant wins; nobody left → no winner. */
  abandon(room) {
    const present = room.participants.filter(p => p.connected);
    this.finish(room, present.length === 1 ? present[0] : null, present.length === 1 ? 'abandon' : 'abandon-both');
  }
  detach(client) { client.roomId = null; client.participantId = null; }
  update(now = this.now()) {
    for (const room of [...this.rooms.values()]) {
      if (['countdown', 'racing'].includes(room.state)) {
        const gone = room.participants.filter(p => !p.connected && now - p.disconnectedAt >= LIMITS.disconnectGraceMs);
        if (gone.length) { gone.forEach(p => { p.connected = false; }); this.abandon(room); continue; }
        this.stepRoom(room, now);
      } else if (room.state === 'lobby' && now - room.lastActivity >= LIMITS.lobbyIdleMs) {
        for (const p of room.participants) this.error(p.client, 'room-expired');
        this.closeRoom(room);
      } else if (room.state === 'result' && now - room.closedAt >= LIMITS.resultTtlMs) this.closeRoom(room);
    }
  }
  closeRoom(room) {
    for (const p of room.participants) if (p.client.roomId === room.id) this.detach(p.client);
    this.rooms.delete(room.id);
    if (!this.rooms.size && this.loop !== null) { this.cancel(this.loop); this.loop = null; }
  }
  ensureLoop() { if (this.loop === null) this.loop = this.schedule(() => this.update(), TICK_MS); }
  stats() { return { rooms: this.rooms.size, connections: this.connections.size, loop: this.loop !== null }; }
  // ---------- output ----------
  send(client, message) { try { client.conn.send(encode(message)); } catch { /* Socket already closing. */ } }
  error(client, code) { this.send(client, { type: 'error', code }); }
  broadcast(room, message) { for (const p of room.participants) if (p.connected && p.client.roomId === room.id) this.send(p.client, message); }
  broadcastLobby(room) {
    this.broadcast(room, { type: 'lobby', roomId: room.id, levelId: room.levelId, players: room.participants.map(p => ({ id: p.id, slot: p.slot, name: p.name, ready: p.ready })) });
  }
  broadcastSnapshot(room) {
    this.broadcast(room, { type: 'snapshot', runId: room.runId, tick: room.tick, serverTime: this.now(),
      players: room.participants.map(p => ({ id: p.id, slot: p.slot, lastSeq: p.appliedSeq, connected: p.connected, ...p.sim.snapshot() })) });
  }
}
