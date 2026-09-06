import * as THREE from 'three';
import {
  AIRCRAFT_SPECS,
  createFlightState,
  headingDeltaDeg,
  idleInput,
  stepFlight,
  type AircraftKind,
  type FlightInput,
  type FlightState,
} from '../flight/FlightModel';
import type { FlightSample } from '../flight/types';
import { headingToQuaternion, latLonAltToVector } from '../geo/ecef';
import { MissionRunner } from '../missions/MissionRunner';
import {
  loadProgress,
  recordResult,
  saveProgress,
  type CampaignProgress,
} from '../missions/progress';
import type { MissionEvent, MissionSpec } from '../missions/types';
import { EngineAudio } from '../systems/EngineAudio';
import type { PilotHudFrame } from '../systems/PilotHud';
import { MissionRings } from '../world/rings';

const GEAR_AUTO_ALT_M = 700;

export type PilotFrameResult = {
  events: MissionEvent[];
  gust: number;
};

/**
 * Estado do modo piloto: entrada (teclado + arraste), modelo de voo, missão
 * ativa, anéis e áudio do motor. Não mexe na cena além do grupo de anéis.
 */
export class PilotMode {
  readonly rings = new MissionRings();
  readonly audio = new EngineAudio();
  state: FlightState = createFlightState();
  aircraft: AircraftKind;
  progress: CampaignProgress;
  runner: MissionRunner | null = null;
  mission: MissionSpec | null = null;
  missionIndex = -1;
  gearDown = false;
  gearManual: boolean | null = null;
  active = false;
  private readonly keys = new Set<string>();
  private readonly input: FlightInput = idleInput();
  private dragId: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private dragPitch = 0;
  private dragRoll = 0;
  private stormShake = 0;
  private readonly ringPos = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly missions: readonly MissionSpec[],
  ) {
    this.progress = loadProgress(safeStorage());
    this.aircraft = this.progress.aircraft;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  get spec() {
    return AIRCRAFT_SPECS[this.aircraft];
  }

  setAircraft(kind: AircraftKind): void {
    this.aircraft = kind;
    this.progress = { ...this.progress, aircraft: kind };
    saveProgress(safeStorage(), this.progress);
  }

  enter(): void {
    this.active = true;
    this.audio.start();
  }

  exit(): void {
    this.active = false;
    this.audio.stop();
    this.rings.set(null);
    this.runner = null;
    this.mission = null;
    this.missionIndex = -1;
    this.keys.clear();
  }

  startMission(index: number): void {
    const mission = this.missions[index];
    if (!mission) return;
    this.mission = mission;
    this.missionIndex = index;
    this.runner = new MissionRunner(mission);
    this.rings.set(mission);
    this.applyStart(mission, 0);
    this.gearManual = null;
    this.audio.start();
  }

  startFreeFlight(start: { lat: number; lon: number; altM: number; headingDeg: number }): void {
    this.mission = null;
    this.missionIndex = -1;
    this.runner = null;
    this.rings.set(null);
    this.state = createFlightState({
      ...start,
      speedMps: this.spec.minSpeedMps + (this.spec.maxSpeedMps - this.spec.minSpeedMps) * 0.7,
      throttle: 0.7,
    });
    this.gearManual = null;
    this.audio.start();
  }

  private applyStart(mission: MissionSpec, leg: number): void {
    const start = mission.legs[Math.min(leg, mission.legs.length - 1)]?.start;
    if (!start) return;
    this.state = createFlightState({
      lat: start.lat,
      lon: start.lon,
      altM: start.altM,
      headingDeg: start.headingDeg,
      speedMps: start.speedMps,
      throttle: start.throttle,
    });
  }

  get hasNextMission(): boolean {
    return this.missionIndex >= 0 && this.missionIndex + 1 < this.missions.length;
  }

  /** Avança física e missão. Devolve eventos para o jogo reagir (som, toasts, debrief). */
  update(dt: number, paused: boolean): PilotFrameResult {
    const events: MissionEvent[] = [];
    if (!this.active || paused) {
      this.audio.update(dt);
      return { events, gust: 0 };
    }
    this.readInput();
    const inStorm = this.runner?.inStorm ?? false;
    this.stormShake += ((inStorm ? 1 : 0) - this.stormShake) * Math.min(1, dt * 2.5);
    const gust = this.stormShake > 0.02
      ? { pitch: (Math.random() - 0.5) * 26 * this.stormShake, roll: (Math.random() - 0.5) * 60 * this.stormShake }
      : { pitch: 0, roll: 0 };
    this.state = stepFlight(this.state, this.input, dt, this.spec, gust);
    this.audio.setThrottle(this.state.throttle);
    this.audio.update(dt);

    const auto = this.state.altM < GEAR_AUTO_ALT_M;
    this.gearDown = this.gearManual ?? auto;

    if (this.runner && !this.runner.done) {
      const missionEvents = this.runner.update(this.state, dt);
      for (const event of missionEvents) {
        if (event.type === 'leg-change' && this.mission) this.applyStart(this.mission, event.leg);
        if (event.type === 'complete') {
          this.progress = recordResult(this.progress, this.missionIndex, event.result, this.missions.length);
          saveProgress(safeStorage(), this.progress);
        }
      }
      events.push(...missionEvents);
    }
    return { events, gust: this.stormShake };
  }

  /** Pose ECEF do avião a partir do estado de voo. */
  pose(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    latLonAltToVector(this.state.lat, this.state.lon, this.state.altM, position);
    headingToQuaternion(
      this.state.lat,
      this.state.lon,
      this.state.headingDeg,
      this.state.pitchDeg,
      -this.state.rollDeg,
      quaternion,
    );
  }

  /** Amostra compatível com a HUD de observação, globo e trilha. */
  sample(target: FlightSample): FlightSample {
    target.lat = this.state.lat;
    target.lon = this.state.lon;
    target.altM = this.state.altM;
    target.heading = this.state.headingDeg;
    target.speedMps = this.state.speedMps;
    target.verticalRateMps = this.state.verticalRateMps;
    target.onGround = false;
    target.timestamp = Date.now() / 1000;
    return target;
  }

  hudFrame(): PilotHudFrame {
    const runner = this.runner;
    const next = runner?.nextRing ?? null;
    const relBearing = next && runner ? headingDeltaDeg(runner.bearingToNextDeg(this.state), this.state.headingDeg) : 0;
    return {
      missionTitle: this.mission ? `Fase ${this.missionIndex + 1} · ${this.mission.title}` : 'Voo livre',
      objective: this.mission ? this.mission.objective : `${this.spec.name} · voe à vontade.`,
      ringsPassed: runner?.passed ?? 0,
      ringsTotal: runner?.total ?? 0,
      timeSec: runner?.timeSec ?? 0,
      score: runner?.score ?? 0,
      nextDistM: next && runner ? runner.distanceToNextM(this.state) : null,
      nextRelBearingDeg: relBearing,
      nextAltDeltaM: runner?.altitudeDeltaToNextM(this.state) ?? 0,
      throttle01: this.state.throttle,
      pitchDeg: this.state.pitchDeg,
      rollDeg: this.state.rollDeg,
      gearDown: this.gearDown,
      inStorm: runner?.inStorm ?? false,
    };
  }

  /** Posição do próximo anel projetada na câmera (para o marcador HTML). */
  nextRingScreen(camera: THREE.Camera): { x: number; y: number; behind: boolean } | null {
    const next = this.runner?.nextRing;
    if (!next || this.runner?.done) return null;
    latLonAltToVector(next.lat, next.lon, next.altM, this.ringPos);
    this.ringPos.project(camera);
    return { x: this.ringPos.x, y: this.ringPos.y, behind: this.ringPos.z > 1 || Math.abs(this.ringPos.x) > 1.4 };
  }

  toggleGear(): void {
    this.gearManual = !(this.gearManual ?? this.gearDown);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.rings.clear();
    this.audio.dispose();
  }

  private readInput(): void {
    const k = this.keys;
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    let throttle = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) pitch -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) pitch += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) roll -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) roll += 1;
    if (k.has('KeyQ')) yaw -= 1;
    if (k.has('KeyE')) yaw += 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) throttle += 1;
    if (k.has('ControlLeft') || k.has('ControlRight')) throttle -= 1;
    this.input.pitch = clamp(pitch + this.dragPitch);
    this.input.roll = clamp(roll + this.dragRoll);
    this.input.yaw = yaw;
    this.input.throttle = throttle;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.active || event.target instanceof HTMLInputElement) return;
    this.keys.add(event.code);
    if (event.code === 'KeyG') this.toggleGear();
    if (event.code.startsWith('Arrow') || event.code === 'ShiftLeft' || event.code === 'ControlLeft') event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.active || this.dragId !== null) return;
    this.dragId = event.pointerId;
    this.dragX = event.clientX;
    this.dragY = event.clientY;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.dragId) return;
    const scale = Math.max(160, Math.min(this.canvas.clientWidth, this.canvas.clientHeight) * 0.35);
    this.dragRoll = clamp((event.clientX - this.dragX) / scale);
    this.dragPitch = clamp((event.clientY - this.dragY) / scale);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.dragId) return;
    this.dragId = null;
    this.dragPitch = 0;
    this.dragRoll = 0;
  };
}

function clamp(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
