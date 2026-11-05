// Matemática vetorial mínima com arrays [x, y, z]. Sem Three.js: testável no Node.

export const DEG = Math.PI / 180;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0];
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Normaliza um ângulo para (-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/**
 * Direção do alvo PARA a câmera (eixo +z da câmera).
 * yaw gira em torno de Y (0 = câmera em +Z), pitch é a elevação acima do horizonte.
 */
export function viewDir(yaw, pitch) {
  const c = Math.cos(pitch);
  return [c * Math.sin(yaw), Math.sin(pitch), c * Math.cos(yaw)];
}

/** Base ortonormal da câmera, idêntica à produzida por Object3D.lookAt com up = +Y. */
export function viewBasis(yaw, pitch) {
  const d = viewDir(yaw, pitch);
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = cross(d, right);
  return { d, right, up, yaw, pitch };
}

/** Projeção ortográfica em coordenadas de tela (unidades de mundo). */
export const project = (p, basis) => [dot(p, basis.right), dot(p, basis.up)];

export function screenDist(a, b, basis) {
  const pa = project(a, basis);
  const pb = project(b, basis);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
}

/**
 * Ângulos de vista em que A e B caem no mesmo pixel: quando (B - A) é paralelo à
 * direção de vista. Retorna null se a ligação exige olhar do horizonte ou de baixo.
 */
export function linkAngles(a, b) {
  let v = sub(b, a);
  if (v[1] < 0) v = scale(v, -1);
  const h = Math.hypot(v[0], v[2]);
  if (v[1] < 1e-6 || h < 1e-6) return null;
  return { yaw: Math.atan2(v[0], v[2]), pitch: Math.atan2(v[1], h) };
}

/** Distância angular aproximada entre duas vistas (radianos). */
export function angDist(y1, p1, y2, p2) {
  const dy = wrapAngle(y1 - y2) * Math.cos((p1 + p2) / 2);
  return Math.hypot(dy, p1 - p2);
}

/** Raio (origem o, direção d) contra caixa alinhada aos eixos. true se acerta com t > eps. */
export function rayHitsAABB(o, d, box, eps = 1e-4) {
  let tmin = eps;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < box.min[i] || o[i] > box.max[i]) return false;
    } else {
      let t1 = (box.min[i] - o[i]) / d[i];
      let t2 = (box.max[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }
  }
  return true;
}
