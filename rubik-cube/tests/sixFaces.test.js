import test from 'node:test';
import assert from 'node:assert/strict';
import Cube from 'cubejs';
import { CubeState, FACE_NAMES } from '../src/cube/CubeState.js';
import { CubeSolver } from '../src/cube/CubeSolver.js';
import {
  validateSixFaces,
  rotateGrid90cw,
  rotateGrid180,
  rotateGrid90ccw,
  countColors,
  analyzePieces,
  isCubejsSolvable
} from '../src/scanner/sixFacesReconstructor.js';
import { EXAMPLE_SIX_FACES_GRIDS } from '../src/scanner/exampleSixFaceData.js';
import { CubeImageScanner } from '../src/scanner/CubeImageScanner.js';

test('grid rotations for face photos', () => {
  const grid = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
  assert.deepEqual(rotateGrid90cw(grid), ['6', '3', '0', '7', '4', '1', '8', '5', '2']);
  assert.deepEqual(rotateGrid180(grid), ['8', '7', '6', '5', '4', '3', '2', '1', '0']);
  assert.deepEqual(rotateGrid90ccw(grid), ['2', '5', '8', '1', '4', '7', '0', '3', '6']);
  assert.deepEqual(rotateGrid90cw(rotateGrid90ccw(grid)), grid);
});

test('classifyColor accurately maps WCA colors', () => {
  // Branco (U)
  assert.equal(CubeImageScanner.classifyColor(250, 250, 250), 'U');
  // Amarelo (D)
  assert.equal(CubeImageScanner.classifyColor(240, 210, 20), 'D');
  // Verde (F)
  assert.equal(CubeImageScanner.classifyColor(20, 170, 60), 'F');
  // Azul (B)
  assert.equal(CubeImageScanner.classifyColor(30, 90, 220), 'B');
  // Vermelho (R)
  assert.equal(CubeImageScanner.classifyColor(220, 30, 30), 'R');
  // Laranja (L)
  assert.equal(CubeImageScanner.classifyColor(240, 110, 10), 'L');
});

test('validateSixFaces validates solved cube', () => {
  CubeSolver.init();
  const cube = new CubeState();
  const res = validateSixFaces(cube.faces);

  assert.equal(res.complete, true);
  assert.equal(res.allNine, true);
  assert.equal(res.legal, true);
  assert.equal(res.solvable, true);
});

test('validateSixFaces validates scrambled cube across 6 faces', () => {
  CubeSolver.init();
  const cube = new CubeState();
  const moves = ['R', 'U', "R'", 'F', 'D', "L'", 'B2', 'U2', 'R', "D'", 'F2', 'L'];
  for (const move of moves) cube.applyMove(move);

  const res = validateSixFaces(cube.faces);
  assert.equal(res.complete, true);
  assert.equal(res.allNine, true);
  assert.equal(res.legal, true);
  assert.equal(res.solvable, true);
});

test('validateSixFaces detects missing faces', () => {
  const partial = {
    U: Array(9).fill('U'),
    F: Array(9).fill('F')
  };
  const res = validateSixFaces(partial);
  assert.equal(res.complete, false);
  assert.equal(new Set(res.missingFaces).size, 4);
  assert.ok(res.missingFaces.includes('D'));
  assert.ok(res.missingFaces.includes('B'));
  assert.ok(res.missingFaces.includes('R'));
  assert.ok(res.missingFaces.includes('L'));
  assert.equal(res.solvable, false);
});

test('example 6-faces fixture is legal and solvable', () => {
  CubeSolver.init();
  const res = validateSixFaces(EXAMPLE_SIX_FACES_GRIDS);
  const counts = countColors(EXAMPLE_SIX_FACES_GRIDS);

  for (const face of FACE_NAMES) {
    assert.equal(counts[face], 9);
  }

  assert.equal(res.complete, true);
  assert.equal(res.allNine, true);
  assert.equal(res.legal, true);
  assert.equal(res.solvable, true);

  const cube = new CubeState();
  cube.setFaces(EXAMPLE_SIX_FACES_GRIDS);
  const solution = Cube.fromString(cube.toString54()).solve();
  assert.equal(typeof solution, 'string');
  assert.ok(solution.length > 0);
});
