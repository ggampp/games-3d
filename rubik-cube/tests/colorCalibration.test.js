import test from 'node:test';
import assert from 'node:assert/strict';
import { CubeState } from '../src/cube/CubeState.js';
import { calibrateFaces, solveAssignment, rgbToLab } from '../src/scanner/colorCalibration.js';
import { validateSixFaces, isCubejsSolvable } from '../src/scanner/sixFacesReconstructor.js';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// Cores típicas de um cubo fotografado sob luz amarelada (tungstênio):
// o branco puxa para o creme e o laranja fica perto do vermelho e do amarelo.
const WARM_LIGHT = {
  U: [228, 214, 170],
  D: [222, 196, 40],
  R: [190, 40, 30],
  L: [225, 105, 30],
  F: [40, 150, 70],
  B: [40, 70, 160]
};

function scrambled(moves) {
  const cube = new CubeState();
  for (const m of moves) cube.applyMove(m);
  return cube.faces;
}

function noisy([r, g, b], seed) {
  // Ruído determinístico de ±12 por canal + variação de brilho por foto
  const n = (k) => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1) * 12;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return [clamp(r + n(1)), clamp(g + n(2)), clamp(b + n(3))];
}

function samplesFor(faces, palette, brightnessByFace = {}) {
  const samples = {};
  let seed = 1;
  for (const face of FACES) {
    const k = brightnessByFace[face] ?? 1;
    samples[face] = faces[face].map((color) => {
      const [r, g, b] = palette[color];
      return noisy([r * k, g * k, b * k], seed++);
    });
  }
  return samples;
}

test('solveAssignment finds the minimum-cost matching', () => {
  const cost = [
    [4, 1, 3],
    [2, 0, 5],
    [3, 2, 2]
  ];
  const assign = solveAssignment(cost);
  const total = assign.reduce((sum, col, row) => sum + cost[row][col], 0);
  assert.equal(total, 5);
  assert.deepEqual([...assign].sort(), [0, 1, 2]);
});

test('rgbToLab maps white to L≈100 and neutral chroma', () => {
  const [L, a, b] = rgbToLab([255, 255, 255]);
  assert.ok(Math.abs(L - 100) < 0.5);
  assert.ok(Math.abs(a) < 0.5 && Math.abs(b) < 0.5);
});

test('calibrateFaces reads a scrambled cube under warm light with uneven brightness', () => {
  const faces = scrambled(['R', 'U', "R'", 'F', 'D', "L'", 'B2', 'U2', 'R', "D'", 'F2', 'L', "U'", 'B']);
  const samples = samplesFor(faces, WARM_LIGHT, { U: 1.08, D: 0.8, B: 0.9, L: 1.05 });

  const { faces: read } = calibrateFaces(samples);
  assert.deepEqual(read, faces);
  assert.equal(validateSixFaces(read).solvable, true);
});

test('calibrateFaces always yields 9 stickers per color', () => {
  const faces = scrambled(["F'", 'R2', 'D', 'B', "U'", 'L2', 'F']);
  const samples = samplesFor(faces, WARM_LIGHT);
  // Deixa uma peça laranja ambígua entre laranja e vermelho
  samples.F[0] = [210, 72, 30];
  const { faces: read } = calibrateFaces(samples);
  const counts = {};
  for (const f of FACES) for (const c of read[f]) counts[c] = (counts[c] || 0) + 1;
  for (const f of FACES) assert.equal(counts[f], 9);
});

test('calibrateFaces keeps manual corrections', () => {
  const faces = new CubeState().faces;
  const samples = samplesFor(faces, WARM_LIGHT);
  const { faces: read } = calibrateFaces(samples, { locked: { U: { 0: 'R' } } });
  assert.equal(read.U[0], 'R');
  assert.equal(read.U[4], 'U');
});

test('calibrateFaces requires all 6 faces', () => {
  assert.throws(() => calibrateFaces({ U: Array(9).fill([255, 255, 255]) }), /face/);
});

test('impossible cubes are rejected (twisted corner, flipped edge, swapped pair)', () => {
  const solved = () => {
    const f = new CubeState().faces;
    return Object.fromEntries(FACES.map((k) => [k, [...f[k]]]));
  };

  // Canto URF torcido: U8 → R0 → F2
  const twisted = solved();
  [twisted.U[8], twisted.R[0], twisted.F[2]] = [twisted.R[0], twisted.F[2], twisted.U[8]];
  assert.equal(isCubejsSolvable(twisted), false);
  assert.equal(validateSixFaces(twisted).solvable, false);

  // Aresta UF invertida: U7 ↔ F1
  const flipped = solved();
  [flipped.U[7], flipped.F[1]] = [flipped.F[1], flipped.U[7]];
  assert.equal(isCubejsSolvable(flipped), false);

  // Duas arestas trocadas (UF ↔ UR) sem mexer nos cantos: paridade ímpar
  const swapped = solved();
  [swapped.U[7], swapped.U[5]] = [swapped.U[5], swapped.U[7]];
  [swapped.F[1], swapped.R[1]] = [swapped.R[1], swapped.F[1]];
  assert.equal(isCubejsSolvable(swapped), false);

  // Um embaralhamento real continua válido
  assert.equal(isCubejsSolvable(scrambled(['R', 'U', "R'", "U'", 'F2', 'D'])), true);
});

test('validateSixFaces flags a wrong center', () => {
  const f = new CubeState().faces;
  const faces = Object.fromEntries(FACES.map((k) => [k, [...f[k]]]));
  [faces.U[4], faces.R[4]] = ['R', 'U'];
  const res = validateSixFaces(faces);
  assert.equal(res.solvable, false);
  assert.ok(res.warnings.some((w) => /centro/.test(w)));
});
