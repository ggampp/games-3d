import { createRng, RNG_VERSION } from '../core/rng.js';
import { rampRewardPosition, TRAIN_GEOMETRY } from '../physics/acrobatics.js';
const config = (number, name, lengthM, startSpeedMps, maxSpeedMps, briefing, objective, encounters) => Object.freeze({
  id: `level-0${number}`, number, name, version: 'm2-v1', seed: `acrobatic-campaign-v1-0${number}`, rngVersion: RNG_VERSION,
  lengthM, startSpeedMps, maxSpeedMps, accelerationMps2: 0.35, briefing, objective,
  encounters: Object.freeze(encounters.map(e => Object.freeze({ ...e, lanes: Object.freeze(e.lanes) }))),
});
export const LEVEL_ONE = config(1, 'Saída da estação', 600, 14, 18,
  'Desvie das obras. Mova a frente com A/D, a traseira com as setas e use W para alinhar.',
  'Extra opcional: coletar 3 itens.', [
    { id: 'work-1', type: 'barrier', s: 105, length: 1.6, lanes: [0], safeLane: -1, message: 'OBRAS NO CENTRO · desvie frente e traseira' },
    { id: 'work-2', type: 'barrier', s: 195, length: 1.6, lanes: [-1], safeLane: 0, message: 'OBRAS À ESQUERDA · centro e direita livres' },
    { id: 'work-3', type: 'barrier', s: 285, length: 1.6, lanes: [1], safeLane: 0, message: 'OBRAS À DIREITA · centro e esquerda livres' },
    { id: 'work-4', type: 'barrier', s: 465, length: 1.6, lanes: [0], safeLane: -1, message: 'OBRAS NO CENTRO · alinhe na lateral' },
  ]);
export const LEVEL_TWO = config(2, 'Trilhos em reparo', 750, 16, 21,
  'Trilhos rompidos derrubam o trem. Procure a via contínua e alinhe os dois truques antes da lacuna.',
  'Extra opcional: seguir uma linha de itens na via segura.', [
    { id: 'gap-1', type: 'gap', s: 115, length: 8, lanes: [0], safeLane: -1, message: 'TRILHO ROMPIDO NO CENTRO · use uma lateral' },
    { id: 'gap-2', type: 'gap', s: 235, length: 10, lanes: [-1], safeLane: 0, message: 'TRILHO ROMPIDO À ESQUERDA · centro livre' },
    { id: 'gap-3', type: 'gap', s: 365, length: 8, lanes: [-1, 0], safeLane: 1, message: 'DOIS TRILHOS ROMPIDOS · frente e traseira à direita' },
    { id: 'gap-4', type: 'gap', s: 505, length: 10, lanes: [1], safeLane: 0, message: 'TRILHO ROMPIDO À DIREITA · volte ao centro' },
    { id: 'gap-5', type: 'gap', s: 615, length: 12, lanes: [0], safeLane: -1, message: 'ÚLTIMO REPARO NO CENTRO · use uma lateral' },
  ]);
export const LEVEL_THREE = config(3, 'Primeiro voo', 850, 18, 24,
  'Rampas são opcionais. Alinhado faz backflip; diagonal faz giro. Passe alinhado pelos postes e pouse em trilho livre.',
  'Extra opcional: pousar uma manobra e coletar um anel aéreo.', [
    { id: 'ramp-1', type: 'ramp', s: 120, length: 7, lanes: [0], safeLane: -1, message: 'RAMPA CENTRAL · voe alinhado ou use a esquerda' },
    { id: 'poles-1', type: 'poles', s: 265, length: 10.5, lanes: [], safeLane: 0, message: 'POSTES ENTRE VIAS · mantenha os truques alinhados' },
    { id: 'ramp-2', type: 'ramp', s: 405, length: 7, lanes: [1], safeLane: -1, spin: true, message: 'RAMPA À DIREITA · giro opcional; esquerda livre' },
    { id: 'ramp-3', type: 'ramp', s: 565, length: 7, lanes: [0], safeLane: -1, message: 'ANEL AÉREO · precisa de altura; esquerda livre' },
    { id: 'ramp-4', type: 'ramp', s: 695, length: 7, lanes: [-1], safeLane: 0, message: 'ÚLTIMA RAMPA · salto opcional e pouso livre' },
  ]);
export const LEVELS = Object.freeze([LEVEL_ONE, LEVEL_TWO, LEVEL_THREE]);
export const getLevel = id => LEVELS.find(level => level.id === id) || null;

/** Compatibility fixture for the M1 travel regression; gameplay uses full content. */
export function createBasicLayout(level = LEVEL_ONE) {
  const random = createRng(level.seed);
  return [120, 200, 280, 360, 440].flatMap((s, row) => {
    const lane = Math.floor(random() * 3) - 1;
    return Array.from({ length: 5 }, (_, i) => ({ id: `${level.id}:row-${row}:item-${i}`, s: s + i * 3, lane, points: 10 }));
  });
}
export function encounterEnd(e) { return e.type === 'barrier' ? e.s + e.length / 2 : e.s + e.length; }
export function encounterStart(e) { return e.type === 'barrier' ? e.s - e.length / 2 : e.s; }
export function warningStart(level, encounter) { return encounterStart(encounter) - TRAIN_GEOMETRY.carLength / 2 - level.maxSpeedMps * 2.7; }
export function getWarning(level, dist) {
  if (!level) return '';
  const next = level.encounters.find(e => dist <= encounterEnd(e) + TRAIN_GEOMETRY.carLength / 2);
  return next && dist >= warningStart(level, next) ? next.message : '';
}
export function createLevelContent(level) {
  const items = [], barriers = [], gaps = [], poles = [], ramps = [];
  const addRow = (s, lane, id) => { for (let i = 0; i < 5; i++) items.push({ id: `${level.id}:${id}:${i}`, s: s + i * 3, lane, y: 1.6, level: 0, points: 10 }); };
  for (const e of level.encounters) {
    if (e.type === 'barrier') e.lanes.forEach(lane => barriers.push({ id: e.id, s: e.s, lane, length: e.length, width: 2.2, height: 3.2 }));
    if (e.type === 'gap') e.lanes.forEach(lane => gaps.push({ id: `${e.id}:${lane}`, a: e.s, b: e.s + e.length, lane }));
    if (e.type === 'poles') for (const lat of [-1.7, 1.7]) for (let i = 0; i < 4; i++) poles.push({ id: `${e.id}:${lat}:${i}`, s: e.s + i * 3.5, lat, height: 3.2, radius: 0.16 });
    if (e.type === 'ramp') {
      ramps.push({ id: e.id, s: e.s, lane: e.lanes[0] });
      const reward = rampRewardPosition(e.s, level.maxSpeedMps, Boolean(e.spin));
      items.push({ id: `${level.id}:${e.id}:air`, ...reward, lane: e.lanes[0], level: e.spin ? 1 : 2, points: 50 });
    }
    addRow(encounterEnd(e) + 12, e.safeLane, e.id);
  }
  if (level.number === 1) addRow(360, 0, 'center-items');
  return { barriers, gaps, poles, ramps, items };
}
export function validateLevel(level) {
  const errors = [];
  if (!level || !/^level-0[1-9]$/.test(level.id)) return ['Invalid level ID'];
  if (!Number.isFinite(level.lengthM) || level.lengthM < 300 || !Number.isFinite(level.startSpeedMps) || !Number.isFinite(level.maxSpeedMps) || level.startSpeedMps <= 0 || level.maxSpeedMps < level.startSpeedMps || level.maxSpeedMps > 42 || !Number.isFinite(level.accelerationMps2) || level.accelerationMps2 < 0 || typeof level.seed !== 'string' || !level.seed) errors.push('Invalid dimensions/speed/seed');
  if (!Array.isArray(level.encounters)) return [...errors, 'Invalid encounters'];
  let lastEnd = 0;
  for (const e of level.encounters) {
    if (!e || !['barrier', 'gap', 'poles', 'ramp'].includes(e.type) || !Number.isFinite(e.s) || !Number.isFinite(e.length) || e.length <= 0 || !Array.isArray(e.lanes) || !e.lanes.every(l => [-1, 0, 1].includes(l))) { errors.push('Invalid encounter'); continue; }
    if (encounterStart(e) < 80 || encounterEnd(e) > level.lengthM - 80) errors.push('Unsafe start/finish');
    if (e.lanes.length >= 3 || ![-1, 0, 1].includes(e.safeLane) || (e.type !== 'poles' && e.lanes.includes(e.safeLane))) errors.push('No terrestrial route');
    if (lastEnd && encounterStart(e) - lastEnd < level.maxSpeedMps * 2.5) errors.push('Insufficient recovery');
    lastEnd = encounterEnd(e);
  }
  return errors;
}
