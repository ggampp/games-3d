export const ease = t => t * t * (3 - 2 * t);
export const easeD = t => 6 * t * (1 - t);
export function advanceTravel(travel, dt, profile) {
  travel.speed = Math.min(profile.maxSpeedMps, travel.speed + profile.accelerationMps2 * dt);
  travel.dist += travel.speed * dt;
}
export function moveLift(m, { hop = 0.9, airMax = 0.5, airFade = 0.15 } = {}) {
  if (m.t >= 1) return 0;
  const fade = Math.max(0, Math.min(1, 1 - (m.airT - airMax) / airFade));
  return Math.max(m.h0 * (1 - ease(m.t)), hop * Math.sin(Math.PI * m.t)) * fade;
}
export function targetMove(m, track, hop = 0.9) {
  if (track === m.to) return false;
  m.h0 = Math.min(moveLift(m, { hop }), hop); m.from = m.value; m.to = track; m.t = 0;
  return true;
}
export function stepMove(m, dt, crossTimeS = 0.28) {
  if (m.t >= 1) return false;
  m.t = Math.min(1, m.t + dt / crossTimeS);
  m.airT = m.t >= 1 ? 0 : m.airT + dt;
  m.value = m.from + (m.to - m.from) * ease(m.t);
  return m.t >= 1;
}
