/**
 * Patterns.js
 * Padrões famosos do cubo 3x3 (algoritmo a partir do cubo resolvido) e verificação
 * de estado independente da orientação do cubo (as 24 rotações inteiras contam como iguais).
 */

import { CubeState } from './CubeState.js';

export const PATTERNS = {
  checkerboard: {
    id: 'checkerboard',
    name: 'Checkerboard',
    alg: 'U2 D2 F2 B2 L2 R2',
    description: 'Tabuleiro de xadrez: cada face alterna a própria cor com a cor da face oposta.'
  },
  cubeInCube: {
    id: 'cubeInCube',
    name: 'Cube in a Cube',
    alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U",
    description: 'Um cubo 2x2 de cores trocadas aparece dentro de um canto do cubo.'
  },
  sixSpots: {
    id: 'sixSpots',
    name: 'Six Spots',
    alg: "U D' R L' F B' U D'",
    description: 'Cada face fica inteira de uma cor com o centro de outra cor (seis pontos).'
  },
  tetris: {
    id: 'tetris',
    name: 'Tetris',
    alg: "L R F B U' D' L' R'",
    description: 'Blocos em L lembrando peças de Tetris em todas as faces.'
  }
};

export function parseAlg(alg) {
  return alg.trim().split(/\s+/).filter(Boolean);
}

/**
 * Estado (string de 54) obtido aplicando o algoritmo ao cubo resolvido.
 */
export function patternTarget(alg) {
  const cube = new CubeState();
  parseAlg(alg).forEach((m) => cube.applyMove(m, false));
  return cube.toString54();
}

/**
 * Gera as 24 orientações inteiras de um estado (rotações x/y/z).
 */
export function allOrientations(str54) {
  const seen = new Set();
  const base = new CubeState();
  base.setFrom54(str54);

  // 6 escolhas para a face de cima (via x / x' / x2 / z / z') x 4 giros em y
  const tops = [[], ['x'], ["x'"], ['x2'], ['z'], ["z'"]];
  for (const topMoves of tops) {
    const c = base.clone();
    topMoves.forEach((m) => c.applyMove(m, false));
    for (let k = 0; k < 4; k++) {
      seen.add(c.toString54());
      c.applyMove('y', false);
    }
  }
  return [...seen];
}

const orientationCache = new Map();

/**
 * Verifica se o estado atual corresponde ao padrão, em qualquer orientação.
 * @param {CubeState} cubeState
 * @param {string} alg
 */
export function matchesPattern(cubeState, alg) {
  let set = orientationCache.get(alg);
  if (!set) {
    set = new Set(allOrientations(patternTarget(alg)));
    orientationCache.set(alg, set);
  }
  return set.has(cubeState.toString54());
}
