import * as THREE from 'three';
import type { FlightModel } from '../aircraft/flightModel';
import type { Hud, HudFrame } from '../hud/hud';
import type { Synth } from '../audio/synth';
import type { Haptics } from '../input/haptics';
import type { Input } from '../input/gamepad';
import type { Drone } from '../drones/drone';
import type { Sparks } from '../particles';

export interface MissionResult { title: string; score: number; grade?: string; wave?: number; lines: string[]; failed?: boolean }
export interface MissionCtx {
  scene: THREE.Scene; fm: FlightModel; hud: Hud; synth: Synth; haptics: Haptics; input: Input; sparks: Sparks;
  prevPos: THREE.Vector3; time: number; playerFwd: THREE.Vector3;
  composite: boolean;
}
export interface HudExtras { headerA: string; headerB: string; objective: string[]; markers: HudFrame['markers']; showWeapon: boolean; ticker: string; msg?: string; warn?: string }
export interface MissionDef { id: string; title: string; blurb: string; scoring: string; maxScore: number; sampleBest?: string; create(): Mission }

export abstract class Mission {
  abstract readonly def: MissionDef;
  score = 0; done = false; result?: MissionResult; elapsed = 0;
  /** true forces airborne spawn, false forces runway; null follows settings */
  airborneStart: boolean | null = null;
  abstract start(ctx: MissionCtx): void;
  abstract update(dt: number, ctx: MissionCtx): void;
  abstract dispose(ctx: MissionCtx): void;
  abstract extras(ctx: MissionCtx): HudExtras;
  frame(_f: HudFrame, _ctx: MissionCtx): void { /* optional */ }
  drones(): Drone[] { return []; }
  onDroneHit(_d: Drone, _killed: boolean, _ctx: MissionCtx): void { /* optional */ }
  cycleTarget(_dir: number, _ctx: MissionCtx): void { /* optional */ }
  clearTarget(): void { /* optional */ }
  shield = 3;
  onCrash(ctx: MissionCtx): void {
    this.score -= 500;
    this.finish({ title: 'CRASHED', score: this.score, lines: ['TERRAIN IMPACT  ·  −500', 'MISSION ABORTED'], failed: true }, ctx);
  }
  finish(r: MissionResult, _ctx: MissionCtx) { if (this.done) return; this.done = true; this.result = r; }
}

export function grade(score: number, max: number): string {
  const f = score / max;
  return f >= 0.9 ? 'A' : f >= 0.75 ? 'B' : f >= 0.55 ? 'C' : f >= 0.35 ? 'D' : 'E';
}
export const fmtPts = (n: number) => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('en-US').replace(/,/g, ' ');
export function fmtTime(t: number) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; }
