import type { AirportFix } from '../flight/types';

export type RingSpec = {
  lat: number;
  lon: number;
  altM: number;
  /** raio do anel em metros */
  radiusM: number;
  /** proa (graus) que o anel "olha" — o avião deve atravessá-lo nesta direção */
  headingDeg: number;
  /** tolerância de proa exigida ao passar (só na aproximação) */
  headingToleranceDeg?: number;
  /** velocidade máxima ao passar (m/s), só na aproximação */
  maxSpeedMps?: number;
  /** índice do trecho (missão "volta ao mundo") */
  leg?: number;
};

export type StormSpec = {
  lat: number;
  lon: number;
  altM: number;
  radiusM: number;
};

export type MissionStart = {
  lat: number;
  lon: number;
  altM: number;
  headingDeg: number;
  speedMps: number;
  throttle: number;
};

export type MissionLeg = {
  label: string;
  start: MissionStart;
  origin: AirportFix;
  destination: AirportFix;
};

export type MissionSpec = {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  objective: string;
  /** novidade mecânica desta fase (para o GDD e o seletor) */
  novelty: string;
  /** tempo alvo para 3 estrelas (s) */
  parTimeSec: number;
  rings: RingSpec[];
  storms: StormSpec[];
  legs: MissionLeg[];
  /** fração mínima de anéis para concluir a missão */
  minRingFraction: number;
};

export type RingStatus = 'upcoming' | 'next' | 'passed' | 'missed';

export type MissionEvent =
  | { type: 'ring-pass'; index: number; precision01: number; points: number }
  | { type: 'ring-miss'; index: number; reason: 'offset' | 'heading' | 'speed' }
  | { type: 'storm-enter' }
  | { type: 'leg-change'; leg: number }
  | { type: 'complete'; result: MissionResult };

export type MissionResult = {
  missionId: string;
  success: boolean;
  passed: number;
  total: number;
  timeSec: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
};
