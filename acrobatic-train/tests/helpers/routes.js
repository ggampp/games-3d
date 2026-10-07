export const ROUTES = {
  'level-01': [{ atM: 55, front: -1, rear: -1 }, { atM: 170, front: 0, rear: 0 }, { atM: 425, front: -1, rear: -1 }],
  'level-02': [{ atM: 60, front: -1, rear: -1 }, { atM: 190, front: 0, rear: 0 }, { atM: 315, front: 1, rear: 1 }, { atM: 455, front: 0, rear: 0 }, { atM: 565, front: -1, rear: -1 }],
  'level-03': [{ atM: 50, front: -1, rear: -1 }, { atM: 640, front: 0, rear: 0 }],
  'level-04': [{ atM: 60, front: -1, rear: -1 }, { atM: 200, front: 0, rear: 0 }, { atM: 700, front: -1, rear: -1 }],
  'level-05': [{ atM: 220, front: 1, rear: 1 }, { atM: 560, front: -1, rear: -1 }, { atM: 800, front: 0, rear: 0 }],
  'level-06': [{ atM: 60, front: 1, rear: 1 }, { atM: 230, front: -1, rear: -1 }, { atM: 440, front: 1, rear: 1 }],
  'level-07': [{ atM: 50, front: -1, rear: -1 }, { atM: 160, front: 0, rear: 0 }, { atM: 358, front: -1, rear: -1 }, { atM: 543, front: 1, rear: 1 }, { atM: 742, front: 0, rear: 0 }],
  'level-08': [{ atM: 50, front: 1, rear: 1 }, { atM: 343, front: -1, rear: -1 }, { atM: 523, front: 1, rear: 1 }, { atM: 727, front: -1, rear: -1 }, { atM: 928, front: 1, rear: 1 }, { atM: 1083, front: 0, rear: 0 }, { atM: 1163, front: 1, rear: 1 }],
  'level-09': [{ atM: 50, front: 1, rear: 1 }, { atM: 152, front: -1, rear: -1 }, { atM: 287, front: 0, rear: 0 }, { atM: 552, front: 1, rear: 1 }, { atM: 812, front: -1, rear: -1 }, { atM: 1183, front: 0, rear: 0 }],
};
/** M4 optional acrobatic variants: every ramp they take lands before the next decision. */
export const AIR_ROUTES = {
  'level-07': [{ atM: 360, front: -1, rear: -1 }, { atM: 543, front: 1, rear: 1 }, { atM: 1000, front: 0, rear: 0 }],
  'level-08': [{ atM: 50, front: 1, rear: 1 }, { atM: 343, front: -1, rear: -1 }, { atM: 928, front: 1, rear: 1 }, { atM: 1083, front: 0, rear: 0 }, { atM: 1163, front: 1, rear: 1 }],
  'level-09': [{ atM: 50, front: 1, rear: 1 }, { atM: 152, front: -1, rear: -1 }, { atM: 287, front: 0, rear: 0 }, { atM: 430, front: 1, rear: 1 }, { atM: 812, front: -1, rear: -1 }, { atM: 960, front: 0, rear: 0 }, { atM: 1100, front: -1, rear: -1 }, { atM: 1183, front: 0, rear: 0 }],
};
/** Optional challenges: pass the open gates (L at gate-2, R at gate-3) instead of the gate-free lane. */
export const OPEN_GATE_ROUTE = [{ atM: 60, front: -1, rear: -1 }, { atM: 380, front: 1, rear: 1 }, { atM: 540, front: 0, rear: 0 }, { atM: 700, front: -1, rear: -1 }];
/** Phase 6 with the optional central ramp before the final crossing. */
export const L6_AIR_ROUTE = [{ atM: 60, front: 1, rear: 1 }, { atM: 230, front: -1, rear: -1 }, { atM: 440, front: 1, rear: 1 }, { atM: 700, front: 0, rear: 0 }, { atM: 880, front: 1, rear: 1 }];
export const AIR_ROUTE = [{ atM: 340, front: 1, rear: 0 }, { atM: 445, front: 0, rear: 0 }, { atM: 645, front: -1, rear: -1 }];
export const ZERO_SCORE_ROUTE = [{ atM: 55, front: 1, rear: 1 }, { atM: 230, front: -1, rear: -1 }, { atM: 415, front: 1, rear: 1 }];
