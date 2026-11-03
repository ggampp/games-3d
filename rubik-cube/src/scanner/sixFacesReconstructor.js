/**
 * sixFacesReconstructor.js
 * Módulo de validação, reconstrução e verificação de solvabilidade para o Cubo Mágico
 * a partir das fotos dos 6 lados (U, L, F, R, B, D).
 */

import Cube from 'cubejs';
import { CubeState, FACE_NAMES } from '../cube/CubeState.js';

export const COLOR_NAME_TO_FACE = {
  white: 'U',
  branco: 'U',
  w: 'U',
  u: 'U',
  red: 'R',
  vermelho: 'R',
  r: 'R',
  green: 'F',
  verde: 'F',
  g: 'F',
  f: 'F',
  yellow: 'D',
  amarelo: 'D',
  y: 'D',
  d: 'D',
  orange: 'L',
  laranja: 'L',
  o: 'L',
  l: 'L',
  blue: 'B',
  azul: 'B',
  b: 'B'
};

export const OPPOSITE_FACES = {
  U: 'D',
  D: 'U',
  R: 'L',
  L: 'R',
  F: 'B',
  B: 'F'
};

export const CORNER_SLOTS = [
  [['U', 8], ['R', 0], ['F', 2]],
  [['U', 6], ['F', 0], ['L', 2]],
  [['U', 0], ['L', 0], ['B', 2]],
  [['U', 2], ['B', 0], ['R', 2]],
  [['D', 2], ['F', 8], ['R', 6]],
  [['D', 0], ['L', 8], ['F', 6]],
  [['D', 6], ['B', 8], ['L', 6]],
  [['D', 8], ['R', 8], ['B', 6]]
];

export const EDGE_SLOTS = [
  [['U', 5], ['R', 1]],
  [['U', 7], ['F', 1]],
  [['U', 3], ['L', 1]],
  [['U', 1], ['B', 1]],
  [['D', 5], ['R', 7]],
  [['D', 1], ['F', 7]],
  [['D', 3], ['L', 7]],
  [['D', 7], ['B', 7]],
  [['F', 5], ['R', 3]],
  [['F', 3], ['L', 5]],
  [['B', 5], ['L', 3]],
  [['B', 3], ['R', 5]]
];

export function rotateGrid90cw(grid) {
  const g = [...grid];
  return [g[6], g[3], g[0], g[7], g[4], g[1], g[8], g[5], g[2]];
}

export function rotateGrid180(grid) {
  return rotateGrid90cw(rotateGrid90cw(grid));
}

export function rotateGrid90ccw(grid) {
  return rotateGrid90cw(rotateGrid180(grid));
}

export function normalizeColorToken(token) {
  if (token == null) return null;
  const raw = String(token).trim().toLowerCase();
  if (COLOR_NAME_TO_FACE[raw]) return COLOR_NAME_TO_FACE[raw];
  if (raw.length === 1 && COLOR_NAME_TO_FACE[raw]) return COLOR_NAME_TO_FACE[raw];
  return null;
}

export function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 9) {
    throw new Error('Cada face precisa de uma grade 3×3 com 9 cores.');
  }
  return grid.map((cell, idx) => {
    const mapped = normalizeColorToken(cell);
    if (!mapped) {
      throw new Error(`Cor inválida na célula ${idx + 1}: ${cell}`);
    }
    return mapped;
  });
}

export function countColors(faces) {
  const counts = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (const face of FACE_NAMES) {
    if (!faces[face]) continue;
    for (const sticker of faces[face]) {
      if (sticker && counts[sticker] !== undefined) counts[sticker]++;
    }
  }
  return counts;
}

function pieceKey(...colors) {
  return [...colors].sort().join('');
}

export function analyzePieces(faces) {
  const cornerKeys = new Set();
  let illegalCorners = 0;
  for (const slot of CORNER_SLOTS) {
    const colors = slot.map(([face, i]) => faces[face]?.[i]);
    if (colors.some(c => c == null)) continue;
    const uniq = new Set(colors);
    if (uniq.size !== 3) {
      illegalCorners++;
      continue;
    }
    if (colors.some((c, idx) => colors.slice(idx + 1).some((o) => OPPOSITE_FACES[c] === o))) {
      illegalCorners++;
      continue;
    }
    cornerKeys.add(pieceKey(...colors));
  }

  const edgeKeys = new Set();
  let illegalEdges = 0;
  for (const slot of EDGE_SLOTS) {
    const colors = slot.map(([face, i]) => faces[face]?.[i]);
    if (colors.some(c => c == null)) continue;
    if (colors[0] === colors[1] || OPPOSITE_FACES[colors[0]] === colors[1]) {
      illegalEdges++;
      continue;
    }
    edgeKeys.add(pieceKey(...colors));
  }

  return {
    uniqueCorners: cornerKeys.size,
    uniqueEdges: edgeKeys.size,
    illegalCorners,
    illegalEdges
  };
}

function isPermutation(perm, size) {
  if (!Array.isArray(perm) || perm.length !== size) return false;
  const seen = new Set(perm);
  return seen.size === size && perm.every((v) => Number.isInteger(v) && v >= 0 && v < size);
}

function permutationParity(perm) {
  const visited = new Array(perm.length).fill(false);
  let parity = 0;
  for (let i = 0; i < perm.length; i++) {
    if (visited[i]) continue;
    let len = 0;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      j = perm[j];
      len++;
    }
    parity ^= (len - 1) & 1;
  }
  return parity;
}

/**
 * Verifica se o estado é alcançável num cubo real, pelas invariantes do grupo do cubo:
 * peças únicas, soma da orientação dos cantos ≡ 0 (mod 3), soma da orientação das
 * arestas ≡ 0 (mod 2) e mesma paridade nas permutações de cantos e arestas.
 * (O `solve()` do cubejs devolve uma "solução" mesmo para estados impossíveis,
 * por isso não serve como teste.)
 */
export function isCubejsSolvable(faces) {
  try {
    const cube = new CubeState();
    cube.setFaces(faces);
    const str54 = cube.toString54();
    if (str54.length !== 54) return false;
    const centers = FACE_NAMES.map((f) => cube.faces[f][4]).join('');
    if (centers !== FACE_NAMES.join('')) return false;

    const pieces = analyzePieces(cube.faces);
    if (pieces.illegalCorners || pieces.illegalEdges) return false;
    if (pieces.uniqueCorners !== 8 || pieces.uniqueEdges !== 12) return false;

    const { cp, co, ep, eo } = Cube.fromString(str54);
    if (!isPermutation(cp, 8) || !isPermutation(ep, 12)) return false;
    if (co.reduce((a, b) => a + b, 0) % 3 !== 0) return false;
    if (eo.reduce((a, b) => a + b, 0) % 2 !== 0) return false;
    return permutationParity(cp) === permutationParity(ep);
  } catch {
    return false;
  }
}

/**
 * Valida o conjunto de 6 faces e devolve diagnóstico detalhado
 */
export function validateSixFaces(faces) {
  const normalized = {};
  const missingFaces = [];

  for (const face of FACE_NAMES) {
    if (!faces[face] || faces[face].length !== 9) {
      missingFaces.push(face);
    } else {
      try {
        normalized[face] = normalizeGrid(faces[face]);
      } catch (err) {
        throw new Error(`Erro na face ${face}: ${err.message}`);
      }
    }
  }

  if (missingFaces.length > 0) {
    return {
      complete: false,
      missingFaces,
      legal: false,
      solvable: false,
      counts: countColors(normalized),
      warnings: [`Faltam fotos para as faces: ${missingFaces.join(', ')}.`]
    };
  }

  const counts = countColors(normalized);
  const isAllNine = Object.values(counts).every(c => c === 9);
  const pieces = analyzePieces(normalized);
  const wrongCenters = FACE_NAMES.filter((face) => normalized[face][4] !== face);
  const legalPieces =
    isAllNine &&
    wrongCenters.length === 0 &&
    pieces.uniqueCorners === 8 &&
    pieces.uniqueEdges === 12 &&
    pieces.illegalCorners === 0 &&
    pieces.illegalEdges === 0;

  const solvable = legalPieces ? isCubejsSolvable(normalized) : false;
  const warnings = [];

  if (wrongCenters.length > 0) {
    warnings.push(`O centro das faces ${wrongCenters.join(', ')} não bate com a cor da face.`);
  }
  if (!isAllNine) {
    warnings.push('A contagem de cores difere de 9 peças por cor.');
  }
  if (pieces.illegalCorners > 0) {
    warnings.push(`${pieces.illegalCorners} cantos possuem cores conflitantes.`);
  }
  if (pieces.illegalEdges > 0) {
    warnings.push(`${pieces.illegalEdges} arestas possuem cores conflitantes.`);
  }
  if (pieces.illegalCorners === 0 && pieces.illegalEdges === 0 && isAllNine &&
      (pieces.uniqueCorners !== 8 || pieces.uniqueEdges !== 12)) {
    warnings.push('Há peças repetidas: alguma cor foi lida trocada em um canto ou aresta.');
  }
  if (legalPieces && !solvable) {
    warnings.push('As peças existem, mas o cubo é impossível: um canto torcido, uma aresta invertida ou duas peças trocadas.');
  }

  return {
    complete: true,
    faces: normalized,
    counts,
    pieces,
    allNine: isAllNine,
    legal: legalPieces,
    solvable,
    warnings
  };
}
