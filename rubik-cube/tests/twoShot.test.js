import test from 'node:test';
import assert from 'node:assert/strict';
import Cube from 'cubejs';
import { CubeState, FACE_NAMES } from '../src/cube/CubeState.js';
import { CubeSolver } from '../src/cube/CubeSolver.js';
import {
  packFacesAsTwoShots,
  reconstructFromTwoShotReadings,
  rotate180,
  rotate90ccw,
  rotate90cw,
  countColors,
  deduceSixthFace
} from '../src/scanner/twoShotReconstructor.js';
import { EXAMPLE_TWO_SHOT_READINGS } from '../src/scanner/exampleTwoShotReadings.js';

test('two-shot geometry helpers', () => {
  const grid = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  assert.deepEqual(rotate90cw(grid), ['g', 'd', 'a', 'h', 'e', 'b', 'i', 'f', 'c']);
  assert.deepEqual(rotate180(grid), ['i', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(rotate90ccw(grid), ['c', 'f', 'i', 'b', 'e', 'h', 'a', 'd', 'g']);
  assert.deepEqual(rotate90cw(rotate90ccw(grid)), grid);
});

test('two-shot roundtrip from a scrambled cube (6 faces / opposite corners)', () => {
  CubeSolver.init();
  const cube = new CubeState();
  const moves = ['R', 'U', "R'", 'F', 'D', "L'", 'B2', 'U2', 'R', "D'", 'F2', 'L'];
  for (const move of moves) cube.applyMove(move);

  const packed = packFacesAsTwoShots(cube.faces);
  const result = reconstructFromTwoShotReadings(packed);

  assert.equal(result.coverage.isOppositeCorners, true);
  assert.equal(result.legal, true, JSON.stringify(result.ranked));
  assert.equal(result.solvable, true);
  assert.deepEqual(result.faces, cube.faces);
});

test('deduceSixthFace restores hidden 6th face from 5 faces and makes it solvable', () => {
  CubeSolver.init();
  const cube = new CubeState();
  const moves = ['R', 'U', "R'", 'F', 'D', "L'", 'B2', 'U2', 'R'];
  for (const m of moves) cube.applyMove(m);

  const fiveFaces = {
    U: [...cube.faces.U],
    F: [...cube.faces.F],
    R: [...cube.faces.R],
    B: [...cube.faces.B],
    L: [...cube.faces.L]
  };

  const reconstructed = deduceSixthFace(fiveFaces, 'D');
  assert.equal(reconstructed.D.length, 9);
  assert.equal(reconstructed.D[4], cube.faces.D[4]);

  const restoredCube = new CubeState();
  restoredCube.setFaces(reconstructed);
  const sol = Cube.fromString(restoredCube.toString54()).solve();
  assert.equal(typeof sol, 'string');
  assert.ok(sol.length > 0);
});

test('example 5-face two-shot photos reconstruct a valid solvable cube', () => {
  CubeSolver.init();
  const result = reconstructFromTwoShotReadings(EXAMPLE_TWO_SHOT_READINGS);
  const counts = countColors(result.faces);

  assert.equal(result.mode, '5-faces');
  assert.equal(result.legal, true, JSON.stringify(result.ranked));
  assert.equal(result.solvable, true);

  for (const color of FACE_NAMES) {
    assert.equal(result.faces[color].length, 9);
    assert.equal(counts[color], 9);
  }

  const restored = new CubeState();
  restored.setFaces(result.faces);
  const solution = Cube.fromString(restored.toString54()).solve();
  assert.equal(typeof solution, 'string');
  assert.ok(solution.length > 0);
});
