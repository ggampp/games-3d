import { GameState } from '../core/game-state.js';
import { EventBus } from '../core/events.js';
import { advanceTravel } from '../physics/train-motion.js';

/** Runs the actual production travel/terminal rules before presentation. */
export class RunSession {
  constructor({ canStartLevel = () => true } = {}) { this.canStartLevel = canStartLevel; this.state = new GameState(); this.events = new EventBus(); this.resetValues(); }
  resetValues() {
    this.travel = { speed: 0, dist: 0 }; this.timeS = 0; this.tick = 0; this.score = 0; this.deterministicScore = 0;
    this.crashTime = 0; this.reason = ''; this.pending = []; this.applied = new Set(); this.eventCounter = 0;
    this.metrics = { items: 0, aerialItems: 0, stuntsLanded: 0 };
  }
  start(profile, level = null) {
    if ((level && !this.canStartLevel(level)) || !this.state.start()) return false;
    this.resetValues(); this.profile = Object.freeze({ ...profile }); this.level = level;
    this.travel.speed = profile.startSpeedMps;
    this.events.emit('runStarted', this.snapshot());
    return true;
  }
  stop() { this.state.stop(); this.resetValues(); }
  pause(reason) { this.state.pause(reason); }
  resume(reason) {
    this.state.resume(reason);
    if (this.state.mode === 'playing') {
      const pending = this.pending; this.pending = [];
      for (const { runId, eventId, effect } of pending) this.deliver(runId, eventId, effect);
    }
  }
  eventId(source) { return `${this.state.runId}:${source}:${++this.eventCounter}`; }
  deliver(runId, eventId, effect) {
    if (!this.state.isCurrent(runId) || this.applied.has(eventId)) return false;
    if (this.state.mode === 'paused') {
      if (!this.pending.some(p => p.eventId === eventId)) this.pending.push({ runId, eventId, effect });
      return false;
    }
    this.applied.add(eventId); effect(); return true;
  }
  addScore(points, { deterministic = true } = {}) {
    if (this.state.mode !== 'playing' || !Number.isSafeInteger(points) || points < 0) return false;
    this.score += points; if (deterministic) this.deterministicScore += points;
    return true;
  }
  crash(reason) {
    if (!this.state.crash()) return false;
    this.pending = []; this.reason = reason;
    this.events.emit('playerCrashed', this.snapshot()); return true;
  }
  step(dt, worldStep = () => {}) {
    if (this.state.mode === 'crash') {
      this.crashTime += dt; worldStep(dt, this.snapshot());
      if (this.crashTime + 1e-10 >= 1.8 && this.state.gameOver()) this.events.emit('gameOver', this.snapshot());
      return;
    }
    if (!this.state.acceptsInput()) return;
    this.tick += 1; this.timeS = this.tick / 60;
    advanceTravel(this.travel, dt, this.profile);
    worldStep(dt, this.snapshot()); // Collision may transition state before arrival.
    if (this.level && this.travel.dist >= this.level.lengthM && this.state.complete()) {
      this.travel.dist = this.level.lengthM; this.pending = [];
      // Online races: crossing the line locally is only a prediction; the server emits the result.
      this.events.emit(this.remoteTerminal ? 'remoteArrival' : 'levelCompleted', this.snapshot());
    }
  }
  snapshot() {
    return Object.freeze({ ...this.state.snapshot(), ...this.travel, timeS: this.timeS, tick: this.tick, score: this.score, deterministicScore: this.deterministicScore,
      levelId: this.level?.id ?? null, levelNumber: this.level?.number ?? null, levelName: this.level?.name ?? '', lengthM: this.level?.lengthM ?? null, metrics: { ...this.metrics }, profile: this.profile, reason: this.reason });
  }
}
