import { GATE, WAGON, gateCycle, gateGeometry, wagonPhase } from '../physics/hazards.js';
import { TRAIN_GEOMETRY } from '../physics/acrobatics.js';
import { advanceTravel } from '../physics/train-motion.js';

const SPACING = TRAIN_GEOMETRY.trackSpacing;
const mod = (a, n) => ((a % n) + n) % n;
/** Simulation time (tick/60) at which the locomotive reference first reaches s; same integrator as RunSession. */
export function arrivalTimeS(level, s) {
  const travel = { speed: level.startSpeedMps, dist: 0 };
  let tick = 0;
  while (travel.dist < s && tick < 60 * 600) { tick += 1; advanceTravel(travel, 1 / 60, level); }
  return tick / 60;
}
/** Lateral band the aligned locomotive occupies in a lane, with a safety margin. */
const laneBand = (lane, margin) => [lane * SPACING - TRAIN_GEOMETRY.carWidth / 2 - margin, lane * SPACING + TRAIN_GEOMETRY.carWidth / 2 + margin];
const overlaps = ([a, b], [c, d]) => a < d && c < b;
const GATE_LABEL = { open: 'ABERTA', warning: 'SINAL ATIVO', closing: 'FECHANDO', closed: 'FECHADA', reopening: 'ABRINDO' };
const WAGON_LABEL = { waiting: 'VAGÃO PARADO', entering: 'VAGÃO ENTRANDO', blocking: 'VAGÃO NA VIA', leaving: 'VAGÃO SAINDO', parked: 'VAGÃO RECOLHIDO' };
const LANE_NAME = { '-1': 'ESQ', 0: 'CENTRO', 1: 'DIR' };

/**
 * M3 obstacle families: configuration validation, deterministic content and HUD state.
 * Meshes live in entities/obstacles.js, volumes and cycles in physics/hazards.js.
 */
export const HAZARD_FAMILIES = Object.freeze({
  gate: {
    validate(e) {
      const errors = [];
      if (!Array.isArray(e.arrivalCycleS) || e.arrivalCycleS.length !== e.lanes.length || !e.arrivalCycleS.every(t => Number.isFinite(t) && t >= 0 && t < GATE.cycleS)) errors.push('Invalid gate cycle');
      return errors;
    },
    build(e, level, content) {
      const arrival = arrivalTimeS(level, e.s);
      e.lanes.forEach((lane, i) => content.gates.push({ id: `${e.id}:${lane}`, encounterId: e.id, s: e.s, lane, ...gateGeometry(lane, SPACING),
        arrivalCycleS: e.arrivalCycleS[i], phaseOffsetS: mod(e.arrivalCycleS[i] - arrival, GATE.cycleS) }));
    },
    status(e, content, timeS) {
      const gates = content.gates.filter(g => g.encounterId === e.id);
      return gates.map(g => `${gates.length > 1 ? `${LANE_NAME[g.lane]} ` : ''}${GATE_LABEL[gateCycle(g, timeS).phase]}`).join(' · ');
    },
  },
  gantry: {
    validate(e) {
      return e.lanes.length !== 2 || e.lanes.includes(e.safeLane) ? ['Gantry must leave exactly the safe lane open'] : [];
    },
    build(e, level, content) {
      content.gantries.push({ id: e.id, encounterId: e.id, s: e.s, openLane: e.safeLane, openLat: e.safeLane * SPACING });
    },
    status: () => '',
  },
  wagon: {
    validate(e, level) {
      const errors = [], side = Math.sign(e.lanes[0]);
      if (!side || e.lanes.some((lane, i) => lane !== e.lanes[0] - side * i)) return ['Wagon lanes must start at its outer side and be contiguous'];
      const wagon = wagonShape(e);
      const sweep = [Math.min(wagon.restLat, wagon.reachLat) - WAGON.length / 2, Math.max(wagon.restLat, wagon.reachLat) + WAGON.length / 2];
      if (overlaps(sweep, laneBand(e.safeLane, 0.5))) errors.push('Wagon sweeps the safe lane');
      for (const lane of e.lanes) if (!overlaps([wagon.reachLat - WAGON.length / 2, wagon.reachLat + WAGON.length / 2], laneBand(lane, 0))) errors.push('Wagon does not reach announced lane');
      if (Math.abs(wagon.restLat) - WAGON.length / 2 < SPACING + TRAIN_GEOMETRY.carWidth / 2 + 1.5) errors.push('Wagon rests inside the track envelope');
      if (arrivalTimeS(level, e.s) - WAGON.inS - WAGON.leadS < 1) errors.push('Wagon starts before the run');
      return errors;
    },
    build(e, level, content) {
      content.wagons.push({ id: e.id, encounterId: e.id, s: e.s, lanes: [...e.lanes], ...wagonShape(e),
        startTimeS: arrivalTimeS(level, e.s) - WAGON.inS - WAGON.leadS });
    },
    status(e, content, timeS) {
      const wagon = content.wagons.find(w => w.encounterId === e.id);
      return wagon ? WAGON_LABEL[wagonPhase(wagon, timeS)] : '';
    },
  },
});
function wagonShape(e) {
  const side = Math.sign(e.lanes[0]), inner = e.lanes[e.lanes.length - 1] * SPACING - side * WAGON.reachMargin;
  return { side, restLat: side * (WAGON.restEdge + WAGON.length / 2), reachLat: inner + side * WAGON.length / 2 };
}
export const isHazardFamily = type => Object.hasOwn(HAZARD_FAMILIES, type);
