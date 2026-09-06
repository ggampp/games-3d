/**
 * OptimalSolver.js
 * Busca em profundidade iterativa (IDDFS) sobre as 54 facetas para encontrar a
 * solução ÓTIMA (métrica HTM: U, U', U2 contam 1) até uma profundidade curta.
 * Usado pelo modo Aprendiz (posições de 1 a 5 movimentos) e pela dica.
 * Independente de Three.js e de cubejs para poder ser testado em Node.
 */

import { CubeState, FACE_NAMES } from './CubeState.js';

const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
const AXIS_OF = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIXES = ['', "'", '2'];

let MOVE_TABLE = null;

/**
 * Constrói (uma única vez) a permutação de 54 índices de cada um dos 18 movimentos,
 * reutilizando a lógica de CubeState com facetas rotuladas de 0 a 53.
 */
function buildMoveTable() {
  if (MOVE_TABLE) return MOVE_TABLE;
  MOVE_TABLE = [];
  for (const face of FACES) {
    for (const suffix of SUFFIXES) {
      const cube = new CubeState();
      let idx = 0;
      for (const f of FACE_NAMES) {
        cube.faces[f] = Array.from({ length: 9 }, () => idx++);
      }
      cube.applyMove(face + suffix, false);
      const perm = new Uint8Array(54);
      let out = 0;
      for (const f of FACE_NAMES) {
        for (let i = 0; i < 9; i++) perm[out++] = cube.faces[f][i];
      }
      MOVE_TABLE.push({ move: face + suffix, face, axis: AXIS_OF[face], perm });
    }
  }
  return MOVE_TABLE;
}

function applyPerm(state, perm) {
  const out = new Array(54);
  for (let i = 0; i < 54; i++) out[i] = state[perm[i]];
  return out;
}

function isUniform(state) {
  for (let f = 0; f < 6; f++) {
    const base = f * 9;
    const center = state[base + 4];
    for (let i = 0; i < 9; i++) {
      if (state[base + i] !== center) return false;
    }
  }
  return true;
}

/**
 * Poda canônica: nunca repete a face anterior e, em faces opostas (mesmo eixo),
 * só permite uma ordem (evita "U D" e "D U" serem exploradas duas vezes).
 */
function isCanonical(entry, last) {
  if (!last) return true;
  if (entry.face === last.face) return false;
  if (entry.axis === last.axis && FACES.indexOf(entry.face) < FACES.indexOf(last.face)) return false;
  return true;
}

function search(state, depth, last, path, table) {
  if (depth === 0) return isUniform(state) ? [...path] : null;
  for (const entry of table) {
    if (!isCanonical(entry, last)) continue;
    const next = applyPerm(state, entry.perm);
    path.push(entry.move);
    const found = search(next, depth - 1, entry, path, table);
    path.pop();
    if (found) return found;
  }
  return null;
}

export class OptimalSolver {
  /** Profundidade padrão máxima; acima disso o custo cresce ~13x por nível. */
  static DEFAULT_MAX_DEPTH = 5;

  /**
   * Procura a solução ótima (HTM) para um CubeState.
   * @param {CubeState} cubeState
   * @param {number} maxDepth
   * @returns {string[]|null} lista de movimentos (vazia se já resolvido) ou null se não achou até maxDepth
   */
  static solve(cubeState, maxDepth = OptimalSolver.DEFAULT_MAX_DEPTH) {
    const table = buildMoveTable();
    const state = cubeState.toString54().split('');
    if (isUniform(state)) return [];
    for (let depth = 1; depth <= maxDepth; depth++) {
      const found = search(state, depth, null, [], table);
      if (found) return found;
    }
    return null;
  }

  /**
   * Distância ótima em movimentos (ou null se maior que maxDepth).
   */
  static distance(cubeState, maxDepth = OptimalSolver.DEFAULT_MAX_DEPTH) {
    const sol = OptimalSolver.solve(cubeState, maxDepth);
    return sol ? sol.length : null;
  }
}
