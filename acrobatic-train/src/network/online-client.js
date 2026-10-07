import { encode, LIMITS } from './protocol.js';

export const TICK_MS = 1000 / LIMITS.tickHz;
export const EXTRAPOLATION_LIMIT_MS = 250;
export const INTERPOLATION_DELAY_MS = 100;

/**
 * Browser/Node WebSocket client for one room. Keeps a server-clock estimate from ping/pong
 * (lowest-RTT sample wins) and numbers inputs. `link` adds simulated latency/jitter for tests;
 * delivery stays FIFO like a real TCP stream.
 */
export class OnlineClient {
  constructor({ url, WebSocketImpl = globalThis.WebSocket, now = () => Date.now(), link = null, timers = globalThis } = {}) {
    Object.assign(this, { url, WebSocketImpl, now, link, timers });
    this.listeners = new Map(); this.seq = 0; this.offset = 0; this.rtt = null; this.samples = []; this.socket = null;
    this.queues = { in: [], out: [] }; this.flushTimers = { in: null, out: null }; this.pingTimer = null; this.closed = false;
  }
  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); return () => this.listeners.get(type).delete(fn); }
  emit(type, data) { for (const fn of [...(this.listeners.get(type) || [])]) fn(data); }
  connect() {
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.url); this.socket = socket;
      socket.onopen = () => { this.ping(); this.pingTimer = this.timers.setInterval(() => this.ping(), 1000); resolve(); };
      socket.onerror = () => reject(Error('Falha ao conectar ao servidor de salas.'));
      socket.onclose = () => { this.stopPing(); if (!this.closed) this.emit('close', {}); };
      socket.onmessage = event => this.delay('in', () => this.receive(event.data));
    });
  }
  /** Test link: per-direction queue drained in order by one timer, so delivery is FIFO even if timers fire late. */
  delay(direction, fn) {
    if (!this.link) return fn();
    const queue = this.queues[direction], base = this.link.rttMs / 2 + (this.link.random?.() ?? Math.random()) * (this.link.jitterMs || 0);
    queue.push({ at: Math.max(queue.at(-1)?.at ?? 0, this.now() + base), fn });
    this.schedule(direction);
  }
  schedule(direction) {
    const queue = this.queues[direction];
    if (this.flushTimers[direction] !== null || !queue.length) return;
    this.flushTimers[direction] = this.timers.setTimeout(() => {
      this.flushTimers[direction] = null;
      while (queue.length && queue[0].at <= this.now()) queue.shift().fn();
      this.schedule(direction);
    }, Math.max(0, queue[0].at - this.now()));
  }
  receive(text) {
    let message;
    try { message = JSON.parse(text); } catch { return; }
    if (message.type === 'pong') return this.sync(message);
    this.emit(message.type, message);
  }
  sync({ t, serverTime }) {
    const rtt = this.now() - t;
    this.samples = [...this.samples, { rtt, offset: serverTime + rtt / 2 - this.now() }].slice(-8);
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.rtt = best.rtt; this.offset = best.offset; this.maxRtt = Math.max(...this.samples.map(s => s.rtt));
    this.emit('clock', { rtt: this.rtt, offset: this.offset });
  }
  serverNow() { return this.now() + this.offset; }
  send(message) {
    const text = encode(message);
    this.delay('out', () => { if (this.socket?.readyState === 1) this.socket.send(text); });
  }
  ping() { this.send({ type: 'ping', t: this.now() }); }
  createRoom(levelId, name) { this.send({ type: 'join', name, create: { levelId } }); }
  joinRoom(room, name) { this.send({ type: 'join', name, room: room.trim().toUpperCase() }); }
  ready(ready, contentHash) { this.send({ type: 'ready', ready, contentHash }); }
  input(runId, tick, lanes) { this.seq += 1; this.send({ type: 'input', runId, seq: this.seq, tick, lanes }); return this.seq; }
  leave() { this.send({ type: 'leave' }); }
  stopPing() { if (this.pingTimer !== null) { this.timers.clearInterval(this.pingTimer); this.pingTimer = null; } }
  close() { this.closed = true; this.stopPing(); try { this.socket?.close(); } catch { /* Already closed. */ } }
  /** Ticks the local prediction runs ahead of the server so inputs reach it before their tick. */
  leadTicks() {
    const oneWay = (this.maxRtt ?? this.rtt ?? 100) / 2;
    return Math.min(LIMITS.inputAheadTicks - 6, Math.ceil((oneWay + 40) / TICK_MS) + 1);
  }
}

/**
 * Opponent snapshots by tick. Rendered INTERPOLATION_DELAY_MS behind the server clock; beyond the
 * newest snapshot the distance is extrapolated by speed for at most EXTRAPOLATION_LIMIT_MS.
 */
export class SnapshotBuffer {
  constructor() { this.items = []; }
  push(tick, state) {
    if (this.items.length && tick <= this.items.at(-1).tick) return;
    // The server tick wins over the participant's own sim tick, which freezes once it crashes or finishes.
    this.items.push({ ...state, tick }); if (this.items.length > 64) this.items.shift();
  }
  clear() { this.items = []; }
  sample(serverTimeMs, startAt) {
    if (!this.items.length) return null;
    const renderTick = (serverTimeMs - startAt - INTERPOLATION_DELAY_MS) / TICK_MS, last = this.items.at(-1);
    if (renderTick >= last.tick) {
      const aheadMs = (renderTick - last.tick) * TICK_MS, usedMs = Math.min(aheadMs, EXTRAPOLATION_LIMIT_MS);
      const moving = last.state === 'running';
      return { ...last, dist: last.dist + (moving ? last.speed * usedMs / 1000 : 0), extrapolatedMs: aheadMs, stale: aheadMs > EXTRAPOLATION_LIMIT_MS };
    }
    let i = this.items.findIndex(item => item.tick > renderTick);
    if (i <= 0) return { ...this.items[0], extrapolatedMs: 0, stale: false };
    const a = this.items[i - 1], b = this.items[i], k = (renderTick - a.tick) / (b.tick - a.tick), mix = key => a[key] + (b[key] - a[key]) * k;
    return { ...b, dist: mix('dist'), front: mix('front'), rear: mix('rear'), air: mix('air'), extrapolatedMs: 0, stale: false };
  }
}
