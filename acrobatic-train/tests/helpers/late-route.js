import { warningStart, encounterEnd, budgetFor } from '../../src/levels/level-config.js';
import { TRAIN_GEOMETRY } from '../../src/physics/acrobatics.js';

/** Late player: every lane change happens only after the reaction time has elapsed since the warning appeared. */
export function lateReactionRoute(level) {
  const commands = []; let lane = 0;
  level.encounters.forEach((e, i) => {
    if (e.safeLane === lane || (i > 0 && e.group && e.group === level.encounters[i - 1].group)) return;
    const previous = level.encounters[i - 1];
    const shownAt = Math.max(warningStart(level, e), previous ? encounterEnd(previous) + TRAIN_GEOMETRY.carLength / 2 : 0, 0);
    commands.push({ atM: shownAt + budgetFor(level).reactionS * level.maxSpeedMps, front: e.safeLane, rear: e.safeLane }); lane = e.safeLane;
  });
  return commands;
}
