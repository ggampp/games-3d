import test from 'node:test';
import assert from 'node:assert/strict';
import { CubeState } from '../src/cube/CubeState.js';
import { CubeScrambler } from '../src/cube/CubeScrambler.js';
import { OptimalSolver } from '../src/cube/OptimalSolver.js';
import { PATTERNS, matchesPattern, patternTarget, allOrientations, parseAlg } from '../src/cube/Patterns.js';
import {
  TRACKS, ALL_CHALLENGES, getChallenge, getNextChallenge, getPreviousChallenge,
  starsForScramble, starsForPattern, starsForTimed, countsAsMove, describeObjective, formatLimit
} from '../src/challenges/ChallengeDefs.js';
import { ChallengeProgress, PROGRESS_KEY } from '../src/challenges/ChallengeProgress.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

test('OptimalSolver - cubo resolvido retorna lista vazia', () => {
  assert.deepEqual(OptimalSolver.solve(new CubeState()), []);
});

test('OptimalSolver - encontra a solução ótima para scrambles de 1 a 5 movimentos', () => {
  for (let n = 1; n <= 5; n++) {
    for (let rep = 0; rep < 3; rep++) {
      const cube = new CubeState();
      const scramble = CubeScrambler.generateScramble(n);
      scramble.forEach((m) => cube.applyMove(m));
      const sol = OptimalSolver.solve(cube, 5);
      assert.ok(sol, `Sem solução para ${scramble.join(' ')}`);
      assert.ok(sol.length <= n, `Solução ${sol.join(' ')} maior que o scramble ${scramble.join(' ')}`);
      const check = cube.clone();
      sol.forEach((m) => check.applyMove(m, false));
      assert.equal(check.isSolved(), true, `Solução inválida para ${scramble.join(' ')}`);
    }
  }
});

test('OptimalSolver - posição de 1 movimento tem distância exatamente 1', () => {
  const cube = new CubeState();
  cube.applyMove("F'");
  assert.equal(OptimalSolver.distance(cube), 1);
  assert.deepEqual(OptimalSolver.solve(cube), ['F']);
});

test('OptimalSolver - retorna null acima da profundidade máxima', () => {
  const cube = new CubeState();
  CubeScrambler.generateScramble(22).forEach((m) => cube.applyMove(m));
  // Um scramble WCA de 22 movimentos praticamente nunca fica a <= 2 movimentos do resolvido
  assert.equal(OptimalSolver.solve(cube, 2), null);
});

test('CubeState.getSolvedFaces - faces uniformes', () => {
  const cube = new CubeState();
  assert.deepEqual(cube.getSolvedFaces(), ['U', 'R', 'F', 'D', 'L', 'B']);
  cube.applyMove('U');
  // Um giro de U mantém U e D uniformes e quebra as 4 laterais
  assert.deepEqual(cube.getSolvedFaces(), ['U', 'D']);
});

test('Patterns - algoritmo aplicado ao cubo resolvido bate com o padrão em qualquer orientação', () => {
  for (const p of Object.values(PATTERNS)) {
    const cube = new CubeState();
    assert.equal(matchesPattern(cube, p.alg), false, `${p.name}: cubo resolvido não é o padrão`);
    parseAlg(p.alg).forEach((m) => cube.applyMove(m));
    assert.equal(matchesPattern(cube, p.alg), true, `${p.name}: algoritmo deve produzir o padrão`);
    cube.applyMove('y');
    cube.applyMove("x'");
    assert.equal(matchesPattern(cube, p.alg), true, `${p.name}: orientação não deve importar`);
    cube.applyMove('R');
    assert.equal(matchesPattern(cube, p.alg), false, `${p.name}: um giro a mais quebra o padrão`);
  }
});

test('Patterns - Checkerboard gera exatamente 24 orientações distintas e centros alternados', () => {
  const target = patternTarget(PATTERNS.checkerboard.alg);
  assert.equal(allOrientations(target).length, 24);
  // No checkerboard, cantos ficam com a cor da face e arestas com a cor oposta
  assert.equal(target[0], 'U');
  assert.equal(target[1], 'D');
});

test('ChallengeDefs - pelo menos 12 desafios em 3 trilhas com ids únicos', () => {
  assert.equal(TRACKS.length, 3);
  assert.ok(ALL_CHALLENGES.length >= 12);
  const ids = new Set(ALL_CHALLENGES.map((c) => c.id));
  assert.equal(ids.size, ALL_CHALLENGES.length);
  assert.equal(getChallenge('apr-1').scrambleLength, 1);
  assert.equal(getNextChallenge('apr-1').id, 'apr-2');
  assert.equal(getNextChallenge('apr-5'), null);
  assert.equal(getPreviousChallenge('pat-checker'), null);
  assert.equal(getPreviousChallenge('clk-120').id, 'clk-180');
});

test('ChallengeDefs - estrelas do Aprendiz', () => {
  assert.equal(starsForScramble(3, 3), 3);
  assert.equal(starsForScramble(5, 3), 2);
  assert.equal(starsForScramble(6, 3), 1);
  assert.equal(starsForScramble(3, 3, true), 2);
});

test('ChallengeDefs - estrelas dos Padrões', () => {
  assert.equal(starsForPattern(6, 6), 3);
  assert.equal(starsForPattern(12, 6), 2);
  assert.equal(starsForPattern(13, 6), 1);
  assert.equal(starsForPattern(6, 6, true), 2);
});

test('ChallengeDefs - estrelas contra o relógio', () => {
  assert.equal(starsForTimed(200000, 180000), 0);
  assert.equal(starsForTimed(170000, 180000), 1);
  assert.equal(starsForTimed(130000, 180000), 2);
  assert.equal(starsForTimed(80000, 180000), 3);
});

test('ChallengeDefs - rotações do cubo inteiro não contam como movimento', () => {
  assert.equal(countsAsMove('R'), true);
  assert.equal(countsAsMove("U'"), true);
  assert.equal(countsAsMove('M2'), true);
  assert.equal(countsAsMove('x'), false);
  assert.equal(countsAsMove("y'"), false);
  assert.equal(countsAsMove('z2'), false);
});

test('ChallengeDefs - textos de objetivo e limite', () => {
  assert.match(describeObjective(getChallenge('apr-3'), { optimal: 3 }), /3 movimentos/);
  assert.match(describeObjective(getChallenge('pat-checker')), /Checkerboard/);
  assert.match(describeObjective(getChallenge('clk-90')), /1 min 30/);
  assert.equal(formatLimit(180000), '3 min');
  assert.equal(formatLimit(45000), '45s');
});

test('ChallengeProgress - desbloqueio sequencial e persistência', () => {
  const storage = new MemoryStorage();
  const progress = new ChallengeProgress(storage);
  assert.equal(progress.isUnlocked('apr-1'), true);
  assert.equal(progress.isUnlocked('pat-checker'), true);
  assert.equal(progress.isUnlocked('clk-180'), true);
  assert.equal(progress.isUnlocked('apr-2'), false);

  const r1 = progress.record('apr-1', { stars: 2, moves: 3, timeMs: 5000 });
  assert.equal(r1.improved, true);
  assert.equal(progress.isUnlocked('apr-2'), true);

  const r2 = progress.record('apr-1', { stars: 1, moves: 1, timeMs: 9000 });
  assert.equal(r2.improved, false);
  assert.equal(progress.getStars('apr-1'), 2, 'mantém o melhor de estrelas');
  assert.equal(progress.get('apr-1').bestMoves, 1, 'mantém o menor número de movimentos');
  assert.equal(progress.get('apr-1').bestTimeMs, 5000, 'mantém o menor tempo');
  assert.equal(progress.get('apr-1').plays, 2);

  // Falha (0 estrelas) não desbloqueia
  progress.record('clk-180', { stars: 0, timeMs: 200000 });
  assert.equal(progress.isUnlocked('clk-120'), false);

  // Recarrega do storage
  const reloaded = new ChallengeProgress(storage);
  assert.equal(reloaded.getStars('apr-1'), 2);
  assert.equal(reloaded.totalStars(), 2);
  assert.ok(storage.getItem(PROGRESS_KEY));

  // Storage corrompido não quebra
  storage.setItem(PROGRESS_KEY, '{nope');
  const broken = new ChallengeProgress(storage);
  assert.equal(broken.totalStars(), 0);
});
