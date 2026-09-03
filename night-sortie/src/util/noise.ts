// Deterministic hash + value/gradient noise (CPU side) used by terrain, city lights and shaders.
export function hash2(x: number, y: number): number {
  let h = Math.imul((x | 0) * 374761393, 1) + Math.imul((y | 0) * 668265263, 1);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const PERM = new Uint8Array(512);
{
  let seed = 1337;
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
function grad(hash: number, x: number, y: number) { const g = GRAD[hash & 7]; return g[0] * x + g[1] * y; }

/** Perlin gradient noise in [-1,1] */
export function perlin2(x: number, y: number): number {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const A = PERM[X] + Y, B = PERM[X + 1] + Y;
  return lerp(
    lerp(grad(PERM[A], x, y), grad(PERM[B], x - 1, y), u),
    lerp(grad(PERM[A + 1], x, y - 1), grad(PERM[B + 1], x - 1, y - 1), u),
    v,
  ) * 1.6;
}

export function fbm(x: number, y: number, octaves = 5, lac = 2.0, gain = 0.5): number {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) { s += a * perlin2(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}

export function ridged(x: number, y: number, octaves = 4): number {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) {
    const v = 1 - Math.abs(perlin2(x * f, y * f));
    s += a * v * v; n += a; a *= 0.5; f *= 2.1;
  }
  return s / n;
}

export function smoothstep(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }
export function mix(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Seeded PRNG (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
