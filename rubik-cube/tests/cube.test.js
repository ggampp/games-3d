import test from 'node:test';
import assert from 'node:assert/strict';
import { CubeState, FACE_NAMES } from '../src/cube/CubeState.js';
import { CubeScrambler } from '../src/cube/CubeScrambler.js';
import { CubeSolver } from '../src/cube/CubeSolver.js';
import { TimerManager, TIMER_STATE } from '../src/ui/TimerManager.js';

test('CubeState - Initial State is Solved', () => {
  const cube = new CubeState();
  assert.equal(cube.isSolved(), true);
  assert.equal(cube.history.length, 0);
  assert.equal(cube.redoStack.length, 0);

  // Each face has 9 matching stickers
  for (const face of FACE_NAMES) {
    assert.equal(cube.faces[face].length, 9);
    assert.ok(cube.faces[face].every(sticker => sticker === face));
  }
});

test('CubeState - 4 consecutive 90° rotations return to solved state', () => {
  const moves = ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z'];

  for (const move of moves) {
    const cube = new CubeState();
    assert.equal(cube.isSolved(), true, `Failed initial check for ${move}`);
    
    // Apply 1 move -> should not be solved (except for whole cube rotations where center changes, but faces still uniform)
    cube.applyMove(move);
    if (!['x', 'y', 'z'].includes(move)) {
      assert.equal(cube.isSolved(), false, `Cube should not be solved after single move ${move}`);
    }

    // Apply remaining 3 moves (total 4)
    cube.applyMove(move);
    cube.applyMove(move);
    cube.applyMove(move);
    assert.equal(cube.isSolved(), true, `Cube should be solved after 4x ${move}`);
  }
});

test('CubeState - Prime (counter-clockwise) and 2 (180°) moves', () => {
  const baseMoves = ['U', 'D', 'L', 'R', 'F', 'B'];

  for (const face of baseMoves) {
    // Face + Face' = solved
    const cube1 = new CubeState();
    cube1.applyMove(face);
    cube1.applyMove(`${face}'`);
    assert.equal(cube1.isSolved(), true, `${face} followed by ${face}' must be solved`);

    // Face' + Face = solved
    const cube2 = new CubeState();
    cube2.applyMove(`${face}'`);
    cube2.applyMove(face);
    assert.equal(cube2.isSolved(), true, `${face}' followed by ${face} must be solved`);

    // Face2 + Face2 = solved
    const cube3 = new CubeState();
    cube3.applyMove(`${face}2`);
    cube3.applyMove(`${face}2`);
    assert.equal(cube3.isSolved(), true, `${face}2 followed by ${face}2 must be solved`);
  }
});

test('CubeState - Slices M, E, S and Cube Rotations x, y, z', () => {
  const slices = ['M', 'E', 'S'];
  for (const slice of slices) {
    const cube = new CubeState();
    cube.applyMove(slice);
    assert.equal(cube.isSolved(), false);
    cube.applyMove(`${slice}'`);
    assert.equal(cube.isSolved(), true);

    // 4 times = solved
    for (let i = 0; i < 4; i++) {
      cube.applyMove(slice);
    }
    assert.equal(cube.isSolved(), true);
  }

  // Rotations x, y, z (preserves solved face consistency)
  const rotations = ['x', 'y', 'z'];
  for (const rot of rotations) {
    const cube = new CubeState();
    cube.applyMove(rot);
    assert.equal(cube.isSolved(), true, `${rot} rotation on solved cube must still have all uniform faces`);
    cube.applyMove(`${rot}'`);
    assert.equal(cube.isSolved(), true);
  }
});

test('CubeState - Undo and Redo', () => {
  const cube = new CubeState();
  cube.applyMove('R');
  cube.applyMove('U');
  cube.applyMove("R'");
  cube.applyMove("U'");

  assert.equal(cube.history.length, 4);
  assert.equal(cube.isSolved(), false);

  // Undo all 4 moves
  const u1 = cube.undo();
  assert.equal(u1, 'U');
  const u2 = cube.undo();
  assert.equal(u2, 'R');
  const u3 = cube.undo();
  assert.equal(u3, "U'");
  const u4 = cube.undo();
  assert.equal(u4, "R'");

  assert.equal(cube.isSolved(), true);
  assert.equal(cube.history.length, 0);
  assert.equal(cube.redoStack.length, 4);

  // Redo all 4 moves
  cube.redo();
  cube.redo();
  cube.redo();
  cube.redo();
  assert.equal(cube.history.length, 4);
  assert.equal(cube.isSolved(), false);
});

test('CubeState - Undo/Redo branching when new move is applied', () => {
  const cube = new CubeState();
  cube.applyMove('R');
  cube.applyMove('U');
  cube.undo(); // back to R

  assert.equal(cube.history.length, 1);
  assert.equal(cube.redoStack.length, 1);

  // Applying a new move must clear redo stack
  cube.applyMove('F');
  assert.equal(cube.history.length, 2);
  assert.equal(cube.redoStack.length, 0);
  assert.equal(cube.redo(), null);
});

test('CubeState - Inversions validation', () => {
  const cube = new CubeState();
  assert.equal(cube.getInverseMove('U'), "U'");
  assert.equal(cube.getInverseMove("U'"), 'U');
  assert.equal(cube.getInverseMove("U’"), 'U');
  assert.equal(cube.getInverseMove('U2'), 'U2');
  assert.equal(cube.getInverseMove('M'), "M'");
  assert.equal(cube.getInverseMove("M'"), 'M');
});

test('CubeState - Sexy Move algorithm (R U R\' U\') x 6 returns to solved', () => {
  const cube = new CubeState();
  for (let i = 0; i < 6; i++) {
    cube.applyMove('R');
    cube.applyMove('U');
    cube.applyMove("R'");
    cube.applyMove("U'");
  }
  assert.equal(cube.isSolved(), true, '6x sexy move must restore the cube to solved state');
});

test('CubeState - toString54 representation and Clone', () => {
  const cube = new CubeState();
  const str = cube.toString54();
  assert.equal(str, 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  assert.equal(str.length, 54);

  const clone = cube.clone();
  clone.applyMove('R');
  assert.notEqual(cube.toString54(), clone.toString54());
  assert.equal(cube.isSolved(), true);
  assert.equal(clone.isSolved(), false);
});

test('CubeScrambler - Generates valid WCA scramble', () => {
  const scramble = CubeScrambler.generateScramble(22);
  assert.equal(scramble.length, 22);

  const validMoves = [
    'U', "U'", 'U2',
    'D', "D'", 'D2',
    'L', "L'", 'L2',
    'R', "R'", 'R2',
    'F', "F'", 'F2',
    'B', "B'", 'B2'
  ];

  for (const move of scramble) {
    assert.ok(validMoves.includes(move), `Invalid move generated: ${move}`);
  }

  const scrambleStr = CubeScrambler.generateScrambleString(20);
  assert.equal(scrambleStr.split(' ').length, 20);
});

test('CubeSolver - Move sequence simplification', () => {
  // R R' -> empty
  assert.deepEqual(CubeSolver.simplifyMoves(['R', "R'"]), []);
  // U U -> U2
  assert.deepEqual(CubeSolver.simplifyMoves(['U', 'U']), ['U2']);
  // U U U -> U'
  assert.deepEqual(CubeSolver.simplifyMoves(['U', 'U', 'U']), ["U'"]);
  // U U U U -> empty
  assert.deepEqual(CubeSolver.simplifyMoves(['U', 'U', 'U', 'U']), []);
  // U U2 -> U'
  assert.deepEqual(CubeSolver.simplifyMoves(['U', 'U2']), ["U'"]);
  // R L R' -> R L R' (different axes, cannot merge adjacent if L in between)
  assert.deepEqual(CubeSolver.simplifyMoves(['R', 'L', "R'"]), ['R', 'L', "R'"]);
});

test('CubeSolver - Solve from History on complex scramble', () => {
  for (let trial = 0; trial < 10; trial++) {
    const cube = new CubeState();
    const scramble = CubeScrambler.generateScramble(25);
    
    scramble.forEach(move => cube.applyMove(move, true));
    assert.equal(cube.isSolved(), false, 'Scrambled cube must not be solved');

    const solutionMoves = CubeSolver.solveFromHistory(cube);
    assert.ok(solutionMoves.length > 0, 'Solution must not be empty');

    // Apply solution moves
    solutionMoves.forEach(move => cube.applyMove(move, false));
    assert.equal(cube.isSolved(), true, `Solution failed to solve scrambled cube on trial ${trial + 1}`);
  }
});

test('CubeSolver - Step Generation', () => {
  const cube = new CubeState();
  cube.applyMove('R', true);
  cube.applyMove('U', true);

  const steps = CubeSolver.generateSolutionSteps(cube);
  assert.ok(steps.length > 0);
  assert.ok(steps[0].phase.length > 0);
  assert.ok(steps[0].description.length > 0);
  assert.equal(steps[0].stepIndex, 1);
  assert.equal(steps[0].totalSteps, steps.length);

  // Applying the steps must solve the cube
  steps.forEach(s => cube.applyMove(s.move, false));
  assert.equal(cube.isSolved(), true);
});

test('TimerManager - Format Time and Stats', () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  const timer = new TimerManager();
  assert.equal(timer.formatTime(null), '--:--');
  assert.equal(timer.formatTime(5230), '5.23');
  assert.equal(timer.formatTime(65430), '1:05.43');
  assert.equal(timer.formatTime(125890), '2:05.89');

  // Test PB calculation
  timer.solves = [
    { id: 1, time: 14500, moves: 45, tps: 3.1 },
    { id: 2, time: 9800, moves: 38, tps: 3.87 },
    { id: 3, time: 12300, moves: 42, tps: 3.41 }
  ];
  assert.equal(timer.getPB(), 9800);

  // Test Ao5 calculation (requires 5 solves, removes min & max, averages remaining 3)
  timer.solves = [
    { time: 10000 }, // min (ignored)
    { time: 12000 }, // counted
    { time: 14000 }, // counted
    { time: 16000 }, // counted
    { time: 20000 }  // max (ignored)
  ];
  // (12000 + 14000 + 16000) / 3 = 14000
  assert.equal(timer.getAo5(), 14000);
});

test('TimerManager - Full lifecycle (Hold -> Ready -> Run -> Stop)', () => {
  let stateLog = [];
  const timer = new TimerManager({
    onStateChange: (state) => stateLog.push(state)
  });

  assert.equal(timer.state, TIMER_STATE.IDLE);

  timer.startHolding();
  assert.equal(timer.state, TIMER_STATE.HOLDING);

  timer.releaseHold();
  assert.equal(timer.state, TIMER_STATE.IDLE);

  timer.startTimer();
  assert.equal(timer.state, TIMER_STATE.RUNNING);

  timer.incrementMove();
  timer.incrementMove();
  assert.equal(timer.moveCount, 2);

  const solve = timer.stop();
  assert.equal(timer.state, TIMER_STATE.STOPPED);
  assert.ok(solve);
  assert.equal(solve.moves, 2);
  assert.ok(solve.time >= 0);

  timer.reset();
  assert.equal(timer.state, TIMER_STATE.IDLE);
  assert.equal(timer.moveCount, 0);
});

test('CubeState - setFrom54, setFaces, and validateState', () => {
  const cube = new CubeState();
  const validCheck = cube.validateState();
  assert.equal(validCheck.valid, true);

  // Invalid state with missing color
  const invalidFaces = {
    U: Array(9).fill('U'),
    D: Array(9).fill('D'),
    F: Array(9).fill('F'),
    B: Array(9).fill('B'),
    R: Array(9).fill('R'),
    L: Array(9).fill('U') // all U instead of L!
  };
  cube.setFaces(invalidFaces);
  const invalidCheck = cube.validateState();
  assert.equal(invalidCheck.valid, false);

  // Restore via setFrom54
  const solved54 = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
  const restored = cube.setFrom54(solved54);
  assert.equal(restored, true);
  assert.equal(cube.isSolved(), true);
});

test('CubeSolver - Solves arbitrary scrambled states with Kociemba Two-Phase Algorithm', () => {
  const scrambles = [
    ["R", "U", "R'", "U'"],
    ["F", "R", "U", "R'", "U'", "F'"],
    ["R", "U2", "R'", "D", "R", "U'", "R'", "D'"],
    ["B2", "L2", "D2", "R2", "U2", "F2", "L", "D'", "B", "R'"]
  ];

  for (const scramble of scrambles) {
    const cube = new CubeState();
    scramble.forEach(m => cube.applyMove(m));
    assert.equal(cube.isSolved(), false);

    const solution = CubeSolver.solveState(cube);
    assert.ok(solution.length > 0, `Solver should return moves for scramble ${scramble.join(' ')}`);

    // Apply solution to clone
    const testCube = cube.clone();
    solution.forEach(m => testCube.applyMove(m, false));
    assert.equal(testCube.isSolved(), true, `Cube must be solved after applying solution: ${solution.join(' ')}`);
  }
});

test('CubeImageScanner - RGB to HSV and Color Classification', async () => {
  const { CubeImageScanner } = await import('../src/scanner/CubeImageScanner.js');

  // Test Pure White (U)
  assert.equal(CubeImageScanner.classifyColor(255, 255, 255), 'U');
  assert.equal(CubeImageScanner.classifyColor(245, 245, 245), 'U');

  // Test Bright Yellow (D)
  assert.equal(CubeImageScanner.classifyColor(250, 204, 21), 'D');

  // Test Emerald Green (F)
  assert.equal(CubeImageScanner.classifyColor(22, 163, 74), 'F');

  // Test Royal Blue (B)
  assert.equal(CubeImageScanner.classifyColor(37, 99, 235), 'B');

  // Test Vivid Red (R)
  assert.equal(CubeImageScanner.classifyColor(220, 38, 38), 'R');

  // Test Bright Orange (L)
  assert.equal(CubeImageScanner.classifyColor(234, 88, 12), 'L');
});
