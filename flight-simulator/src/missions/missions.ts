import { CATALOG } from '../flight/catalog';
import type { AirportFix } from '../flight/types';
import { destinationPoint, initialBearingDeg } from '../geo/ecef';
import { interpolateGreatCircle } from '../geo/greatCircle';
import type { MissionLeg, MissionSpec, MissionStart, RingSpec, StormSpec } from './types';

const GRU = CATALOG[0].origin;
const LHR = CATALOG[0].destination;
const JFK = CATALOG[2].destination;
const DXB = CATALOG[3].origin;

/** Proa da pista 27R de Heathrow (aprox. 270°). */
export const LHR_RUNWAY_HEADING = 270;
export const LHR_THRESHOLD = { lat: 51.4775, lon: -0.4335 };

type Waypoint = { lat: number; lon: number };

function greatCirclePath(
  origin: AirportFix,
  destination: AirportFix,
  t0: number,
  count: number,
  stepT: number,
): Waypoint[] {
  const points: Waypoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const p = interpolateGreatCircle(origin, destination, t0 + stepT * i);
    points.push({ lat: p.lat, lon: p.lon });
  }
  return points;
}

function headingsAlong(points: Waypoint[]): number[] {
  return points.map((_p, i) => {
    const next = points[Math.min(points.length - 1, i + 1)];
    const prev = points[Math.max(0, i - 1)];
    return initialBearingDeg(prev.lat, prev.lon, next.lat, next.lon);
  });
}

function startBefore(
  ring: RingSpec,
  distanceM: number,
  speedMps: number,
  throttle: number,
  altM = ring.altM,
): MissionStart {
  const back = destinationPoint(ring.lat, ring.lon, ring.headingDeg + 180, distanceM);
  return { lat: back.lat, lon: back.lon, altM, headingDeg: ring.headingDeg, speedMps, throttle };
}

/** Fase 1 — Cruzeiro: 6 anéis ao longo da rota GRU→LHR na altitude de cruzeiro. */
function cruise(): MissionSpec {
  const spacingT = 5200 / 9_500_000; // ~5,2 km em fração da rota (≈9.500 km)
  const points = greatCirclePath(GRU, LHR, 0.3, 6, spacingT);
  const headings = headingsAlong(points);
  const rings: RingSpec[] = points.map((p, i) => ({
    lat: p.lat,
    lon: p.lon,
    altM: 11_600 + Math.sin(i * 1.3) * 120,
    radiusM: 420,
    headingDeg: headings[i],
  }));
  const start = startBefore(rings[0], 4200, 240, 0.72);
  return {
    id: 'cruzeiro',
    index: 0,
    title: 'Cruzeiro',
    subtitle: 'Atlântico Sul, FL380',
    objective: 'Atravesse os 6 anéis mantendo a proa da rota GRU → LHR.',
    novelty: 'Controles básicos: pitch, rolagem e manete.',
    parTimeSec: 150,
    rings,
    storms: [],
    legs: [{ label: 'GRU → LHR', start, origin: GRU, destination: LHR }],
    minRingFraction: 0.5,
  };
}

/** Fase 2 — Desvio de tempestade: anéis em zigue-zague contornando cumulonimbus. */
function storm(): MissionSpec {
  const spacingT = 4600 / 9_500_000;
  const points = greatCirclePath(GRU, LHR, 0.46, 7, spacingT);
  const headings = headingsAlong(points);
  const rings: RingSpec[] = points.map((p, i) => {
    const side = i === 0 ? 0 : i % 2 === 1 ? 1 : -1;
    const shifted = destinationPoint(p.lat, p.lon, headings[i] + 90, side * 1500);
    return {
      lat: shifted.lat,
      lon: shifted.lon,
      altM: 11_000 + (i % 3) * 260,
      radiusM: 400,
      headingDeg: headings[i],
    };
  });
  const storms: StormSpec[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    const side = i % 2 === 1 ? -1 : 1;
    const centre = destinationPoint(p.lat, p.lon, headings[i] + 90, side * 900);
    storms.push({ lat: centre.lat, lon: centre.lon, altM: 11_100, radiusM: 1300 });
  }
  const start = startBefore(rings[0], 3800, 235, 0.7);
  return {
    id: 'tempestade',
    index: 1,
    title: 'Desvio de tempestade',
    subtitle: 'Zona de convergência intertropical',
    objective: 'Passe pelos 7 anéis desviando das nuvens de tempestade — entrar nelas sacode e custa pontos.',
    novelty: 'Curvas coordenadas em sequência; turbulência dentro das nuvens.',
    parTimeSec: 165,
    rings,
    storms,
    legs: [{ label: 'GRU → LHR', start, origin: GRU, destination: LHR }],
    minRingFraction: 0.5,
  };
}

/** Fase 3 — Descida: perfil de anéis descendo de FL350 até 3.000 ft perto de Londres. */
function descent(): MissionSpec {
  const spacingT = 5200 / 9_500_000;
  const points = greatCirclePath(GRU, LHR, 0.955, 7, spacingT);
  const headings = headingsAlong(points);
  const rings: RingSpec[] = points.map((p, i) => {
    const u = i / (points.length - 1);
    const eased = 1 - (1 - u) * (1 - u);
    return {
      lat: p.lat,
      lon: p.lon,
      altM: 10_700 - (10_700 - 915) * eased,
      radiusM: 430,
      headingDeg: headings[i],
    };
  });
  const start = startBefore(rings[0], 4000, 240, 0.65, 10_900);
  return {
    id: 'descida',
    index: 2,
    title: 'Descida',
    subtitle: 'Perfil para Heathrow',
    objective: 'Perca altitude atravessando os 7 anéis até 3.000 ft — controle a manete para não acelerar demais.',
    novelty: 'Gestão de energia: nariz baixo acelera, manete reduzida segura a velocidade.',
    parTimeSec: 175,
    rings,
    storms: [],
    legs: [{ label: 'GRU → LHR', start, origin: GRU, destination: LHR }],
    minRingFraction: 0.5,
  };
}

/** Fase 4 — Aproximação: alinhar com a pista 27R de LHR dentro da tolerância. */
function approachMission(): MissionSpec {
  const rings: RingSpec[] = [];
  const distances = [16_000, 11_000, 6_500, 2_400];
  const alts = [1_050, 760, 470, 190];
  const offsets = [2600, 1200, 0, 0];
  for (let i = 0; i < distances.length; i += 1) {
    const onFinal = destinationPoint(LHR_THRESHOLD.lat, LHR_THRESHOLD.lon, LHR_RUNWAY_HEADING + 180, distances[i]);
    const shifted = offsets[i]
      ? destinationPoint(onFinal.lat, onFinal.lon, LHR_RUNWAY_HEADING - 90, offsets[i])
      : onFinal;
    const last = i === distances.length - 1;
    rings.push({
      lat: shifted.lat,
      lon: shifted.lon,
      altM: alts[i],
      radiusM: last ? 320 : 400,
      headingDeg: LHR_RUNWAY_HEADING,
      headingToleranceDeg: last ? 8 : undefined,
      maxSpeedMps: last ? 110 : undefined,
    });
  }
  const startPoint = destinationPoint(rings[0].lat, rings[0].lon, LHR_RUNWAY_HEADING + 180 + 25, 5200);
  const start: MissionStart = {
    lat: startPoint.lat,
    lon: startPoint.lon,
    altM: 1250,
    headingDeg: LHR_RUNWAY_HEADING - 25,
    speedMps: 130,
    throttle: 0.28,
  };
  return {
    id: 'aproximacao',
    index: 3,
    title: 'Aproximação',
    subtitle: 'Final para a pista 27R de Heathrow',
    objective: 'Alinhe com a proa 270° e cruze o portão final abaixo de 215 kt com ±8° de tolerância.',
    novelty: 'Proa e velocidade obrigatórias no anel final; trem de pouso baixa automaticamente.',
    parTimeSec: 190,
    rings,
    storms: [],
    legs: [{ label: 'Final 27R', start, origin: GRU, destination: LHR }],
    minRingFraction: 0.75,
  };
}

/** Fase 5 — Volta ao mundo: três trechos entre aeroportos do catálogo. */
function worldTour(): MissionSpec {
  const pairs: [AirportFix, AirportFix, string][] = [
    [LHR, DXB, 'LHR → DXB'],
    [DXB, JFK, 'DXB → JFK'],
    [JFK, GRU, 'JFK → GRU'],
  ];
  const rings: RingSpec[] = [];
  const legs: MissionLeg[] = [];
  pairs.forEach(([origin, destination, label], leg) => {
    const spacingT = 4400 / 8_000_000;
    const points = greatCirclePath(origin, destination, 0.2 + leg * 0.05, 4, spacingT);
    const headings = headingsAlong(points);
    points.forEach((p, i) => {
      rings.push({
        lat: p.lat,
        lon: p.lon,
        altM: 11_200 + Math.sin(leg * 2 + i) * 300,
        radiusM: 400,
        headingDeg: headings[i],
        leg,
      });
    });
    const first = rings[leg * 4];
    legs.push({ label, start: startBefore(first, 3600, 245, 0.75), origin, destination });
  });
  return {
    id: 'volta-ao-mundo',
    index: 4,
    title: 'Volta ao mundo',
    subtitle: 'Londres · Dubai · Nova York · São Paulo',
    objective: 'Três trechos com 4 anéis cada — ao terminar um trecho, o voo salta para o próximo aeroporto.',
    novelty: 'Trechos encadeados com reposicionamento; o tempo total conta.',
    parTimeSec: 300,
    rings,
    storms: [],
    legs,
    minRingFraction: 0.5,
  };
}

export const MISSIONS: MissionSpec[] = [cruise(), storm(), descent(), approachMission(), worldTour()];

export function findMission(id: string): MissionSpec | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}
