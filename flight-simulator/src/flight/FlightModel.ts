import { destinationPoint } from '../geo/ecef';

/** Modelo de voo arcade: estado puro, sem Three.js, para ser testável. */
export type AircraftKind = 'a350' | 'a320';

export type AircraftSpec = {
  kind: AircraftKind;
  name: string;
  short: string;
  minSpeedMps: number;
  maxSpeedMps: number;
  /** aceleração máxima do motor em m/s² */
  thrustAccel: number;
  pitchRateDeg: number;
  rollRateDeg: number;
  yawRateDeg: number;
  maxBankDeg: number;
  maxPitchDeg: number;
};

export const AIRCRAFT_SPECS: Record<AircraftKind, AircraftSpec> = {
  a350: {
    kind: 'a350',
    name: 'Airbus A350-1000',
    short: 'A350',
    minSpeedMps: 95,
    maxSpeedMps: 290,
    thrustAccel: 4.2,
    pitchRateDeg: 14,
    rollRateDeg: 38,
    yawRateDeg: 6,
    maxBankDeg: 58,
    maxPitchDeg: 24,
  },
  a320: {
    kind: 'a320',
    name: 'Airbus A320neo',
    short: 'A320',
    minSpeedMps: 75,
    maxSpeedMps: 250,
    thrustAccel: 5.4,
    pitchRateDeg: 20,
    rollRateDeg: 58,
    yawRateDeg: 9,
    maxBankDeg: 66,
    maxPitchDeg: 28,
  },
};

export type FlightState = {
  lat: number;
  lon: number;
  altM: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  speedMps: number;
  throttle: number;
  verticalRateMps: number;
};

export type FlightInput = {
  /** -1 (nariz para baixo) … +1 (nariz para cima) */
  pitch: number;
  /** -1 (rolar à esquerda) … +1 (rolar à direita) */
  roll: number;
  /** -1 … +1 */
  yaw: number;
  /** -1 (reduzir) … +1 (aumentar) */
  throttle: number;
};

export const MIN_ALT_M = 25;
export const MAX_ALT_M = 15_500;
const G = 9.81;
const DEG = Math.PI / 180;

export function createFlightState(partial: Partial<FlightState> = {}): FlightState {
  return {
    lat: 0,
    lon: 0,
    altM: 10_000,
    headingDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    speedMps: 230,
    throttle: 0.7,
    verticalRateMps: 0,
    ...partial,
  };
}

export function idleInput(): FlightInput {
  return { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function approach(current: number, target: number, rate: number, dt: number): number {
  const delta = target - current;
  const step = rate * dt;
  if (Math.abs(delta) <= step) return target;
  return current + Math.sign(delta) * step;
}

/**
 * Avança o estado de voo em `dt` segundos. Puro: devolve um novo estado.
 * Regras arcade: manete define velocidade-alvo, banco gera curva (g·tan(φ)/v),
 * pitch gera razão de subida (v·sin θ), atitude volta ao neutro sem input.
 */
export function stepFlight(
  state: FlightState,
  input: FlightInput,
  dt: number,
  spec: AircraftSpec,
  gust: { pitch: number; roll: number } = { pitch: 0, roll: 0 },
): FlightState {
  const step = clamp(dt, 0, 0.1);
  const throttle = clamp(state.throttle + clamp(input.throttle, -1, 1) * 0.45 * step, 0, 1);

  const pitchIn = clamp(input.pitch, -1, 1);
  const rollIn = clamp(input.roll, -1, 1);
  const yawIn = clamp(input.yaw, -1, 1);

  let pitch = state.pitchDeg + pitchIn * spec.pitchRateDeg * step + gust.pitch * step;
  if (pitchIn === 0) pitch = approach(pitch, 0, spec.pitchRateDeg * 0.35, step);
  pitch = clamp(pitch, -spec.maxPitchDeg, spec.maxPitchDeg);

  let roll = state.rollDeg + rollIn * spec.rollRateDeg * step + gust.roll * step;
  if (rollIn === 0) roll = approach(roll, 0, spec.rollRateDeg * 0.42, step);
  roll = clamp(roll, -spec.maxBankDeg, spec.maxBankDeg);

  // velocidade: manete + gravidade ao longo da trajetória
  const targetSpeed = spec.minSpeedMps + (spec.maxSpeedMps - spec.minSpeedMps) * throttle;
  let speed = state.speedMps;
  const gravityAlong = -G * Math.sin(pitch * DEG) * 0.55;
  speed += gravityAlong * step;
  speed = approach(speed, targetSpeed, spec.thrustAccel, step);
  speed = clamp(speed, spec.minSpeedMps * 0.8, spec.maxSpeedMps * 1.12);

  // curva coordenada + leme
  const turnRateRad = (G * Math.tan(roll * DEG)) / Math.max(40, speed);
  let heading = state.headingDeg + (turnRateRad / DEG) * step + yawIn * spec.yawRateDeg * step;
  heading = ((heading % 360) + 360) % 360;

  const climb = speed * Math.sin(pitch * DEG);
  let alt = state.altM + climb * step;
  if (alt < MIN_ALT_M) alt = MIN_ALT_M;
  if (alt > MAX_ALT_M) alt = MAX_ALT_M;
  const ground = speed * Math.cos(pitch * DEG) * step;
  const next = destinationPoint(state.lat, state.lon, heading, ground);

  return {
    lat: next.lat,
    lon: next.lon,
    altM: alt,
    headingDeg: heading,
    pitchDeg: pitch,
    rollDeg: roll,
    speedMps: speed,
    throttle,
    verticalRateMps: alt === state.altM ? 0 : climb,
  };
}

/** Diferença angular assinada (−180…180) entre duas proas. */
export function headingDeltaDeg(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}
