import * as THREE from 'three';
import { headingDeltaDeg, type FlightState } from '../flight/FlightModel';
import { haversineM, headingToQuaternion, initialBearingDeg, latLonAltToVector } from '../geo/ecef';
import type { MissionEvent, MissionResult, MissionSpec, RingStatus } from './types';

type RingWorld = {
  center: THREE.Vector3;
  forward: THREE.Vector3;
  radiusM: number;
};

const STORM_PENALTY_PER_SEC = 12;
const RING_BASE_POINTS = 100;

const scratchPos = new THREE.Vector3();
const scratchRel = new THREE.Vector3();
const scratchQuat = new THREE.Quaternion();

export function ringForward(lat: number, lon: number, headingDeg: number, target = new THREE.Vector3()): THREE.Vector3 {
  headingToQuaternion(lat, lon, headingDeg, 0, 0, scratchQuat);
  return target.set(0, 0, 1).applyQuaternion(scratchQuat).normalize();
}

export function starsFor(passed: number, total: number, timeSec: number, parTimeSec: number, success: boolean): 0 | 1 | 2 | 3 {
  if (!success) return 0;
  if (passed === total && timeSec <= parTimeSec) return 3;
  if (passed / total >= 0.8) return 2;
  return 1;
}

/**
 * Lógica de missão (anéis, tempestades, trechos, pontuação). Sem DOM nem cena —
 * recebe o estado de voo e devolve eventos para o jogo reagir.
 */
export class MissionRunner {
  readonly spec: MissionSpec;
  readonly status: RingStatus[];
  private readonly world: RingWorld[];
  nextIndex = 0;
  passed = 0;
  missed = 0;
  timeSec = 0;
  score = 0;
  leg = 0;
  inStorm = false;
  done = false;
  result: MissionResult | null = null;
  private prevAlong: number | null = null;
  private stormPenaltyAcc = 0;

  constructor(spec: MissionSpec) {
    this.spec = spec;
    this.status = spec.rings.map((_ring, i) => (i === 0 ? 'next' : 'upcoming'));
    this.world = spec.rings.map((ring) => ({
      center: latLonAltToVector(ring.lat, ring.lon, ring.altM),
      forward: ringForward(ring.lat, ring.lon, ring.headingDeg),
      radiusM: ring.radiusM,
    }));
  }

  get total(): number {
    return this.spec.rings.length;
  }

  get nextRing() {
    return this.spec.rings[this.nextIndex] ?? null;
  }

  distanceToNextM(state: FlightState): number {
    const ring = this.nextRing;
    if (!ring) return 0;
    return haversineM(state.lat, state.lon, ring.lat, ring.lon);
  }

  bearingToNextDeg(state: FlightState): number {
    const ring = this.nextRing;
    if (!ring) return state.headingDeg;
    return initialBearingDeg(state.lat, state.lon, ring.lat, ring.lon);
  }

  altitudeDeltaToNextM(state: FlightState): number {
    const ring = this.nextRing;
    if (!ring) return 0;
    return ring.altM - state.altM;
  }

  update(state: FlightState, dt: number): MissionEvent[] {
    const events: MissionEvent[] = [];
    if (this.done) return events;
    this.timeSec += dt;

    this.updateStorm(state, dt, events);

    const ring = this.spec.rings[this.nextIndex];
    const world = this.world[this.nextIndex];
    if (ring && world) {
      latLonAltToVector(state.lat, state.lon, state.altM, scratchPos);
      scratchRel.copy(scratchPos).sub(world.center);
      const along = scratchRel.dot(world.forward);
      const lateral = scratchRel.addScaledVector(world.forward, -along).length();

      if (this.prevAlong === null) {
        this.prevAlong = along;
        if (along > world.radiusM * 3) this.resolveRing(events, false, 0, 'offset');
      } else {
        const crossed = this.prevAlong < 0 && along >= 0;
        this.prevAlong = along;
        if (crossed) {
          if (lateral > world.radiusM) {
            this.resolveRing(events, false, 0, 'offset');
          } else if (
            ring.headingToleranceDeg !== undefined &&
            Math.abs(headingDeltaDeg(state.headingDeg, ring.headingDeg)) > ring.headingToleranceDeg
          ) {
            this.resolveRing(events, false, 0, 'heading');
          } else if (ring.maxSpeedMps !== undefined && state.speedMps > ring.maxSpeedMps) {
            this.resolveRing(events, false, 0, 'speed');
          } else {
            this.resolveRing(events, true, 1 - lateral / world.radiusM, 'offset');
          }
        } else if (along > world.radiusM * 4 && lateral > world.radiusM) {
          this.resolveRing(events, false, 0, 'offset');
        }
      }
    }

    return events;
  }

  private updateStorm(state: FlightState, dt: number, events: MissionEvent[]): void {
    let inside = false;
    for (const storm of this.spec.storms) {
      const horizontal = haversineM(state.lat, state.lon, storm.lat, storm.lon);
      const vertical = Math.abs(state.altM - storm.altM);
      if (horizontal < storm.radiusM && vertical < storm.radiusM * 0.8) {
        inside = true;
        break;
      }
    }
    if (inside && !this.inStorm) events.push({ type: 'storm-enter' });
    this.inStorm = inside;
    if (inside) {
      this.stormPenaltyAcc += STORM_PENALTY_PER_SEC * dt;
      const whole = Math.floor(this.stormPenaltyAcc);
      if (whole > 0) {
        this.score = Math.max(0, this.score - whole);
        this.stormPenaltyAcc -= whole;
      }
    }
  }

  private resolveRing(
    events: MissionEvent[],
    passed: boolean,
    precision01: number,
    reason: 'offset' | 'heading' | 'speed',
  ): void {
    const index = this.nextIndex;
    if (passed) {
      const points = RING_BASE_POINTS + Math.round(precision01 * 100);
      this.score += points;
      this.passed += 1;
      this.status[index] = 'passed';
      events.push({ type: 'ring-pass', index, precision01, points });
    } else {
      this.missed += 1;
      this.status[index] = 'missed';
      events.push({ type: 'ring-miss', index, reason });
    }

    this.nextIndex += 1;
    this.prevAlong = null;
    const next = this.spec.rings[this.nextIndex];
    if (next) {
      this.status[this.nextIndex] = 'next';
      const nextLeg = next.leg ?? 0;
      if (nextLeg !== this.leg) {
        this.leg = nextLeg;
        events.push({ type: 'leg-change', leg: nextLeg });
      }
      return;
    }
    this.finish(events);
  }

  private finish(events: MissionEvent[]): void {
    this.done = true;
    const success = this.passed / this.total >= this.spec.minRingFraction;
    if (success) {
      this.score += Math.max(0, Math.round((this.spec.parTimeSec - this.timeSec) * 4));
    }
    const result: MissionResult = {
      missionId: this.spec.id,
      success,
      passed: this.passed,
      total: this.total,
      timeSec: this.timeSec,
      score: this.score,
      stars: starsFor(this.passed, this.total, this.timeSec, this.spec.parTimeSec, success),
    };
    this.result = result;
    events.push({ type: 'complete', result });
  }
}
