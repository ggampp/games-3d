/**
 * Reconstrói o estado de 54 facetas do Cubo Mágico a partir de duas fotos.
 * Suporta dois modos de captura do mundo real:
 * 1) 5 Faces (Mesa / Giro de 180°): Ambas as fotos mostram o Topo compartilhado e 4 faces laterais. A 6ª face (base) é 100% deduzida geometricamente!
 * 2) 6 Faces (Cantos Opostos): Duas fotos isométricas de cantos opostos sem repetição de centro.
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

const OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

const ALL_LEGAL_CORNERS = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B']
];

const ALL_LEGAL_EDGES = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'],
  ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'],
  ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R']
];

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

export function rotate90cw(grid) {
  const g = [...grid];
  return [g[6], g[3], g[0], g[7], g[4], g[1], g[8], g[5], g[2]];
}

export function rotate180(grid) {
  return rotate90cw(rotate90cw(grid));
}

export function rotate90ccw(grid) {
  return rotate90cw(rotate180(grid));
}

export function rotateN(grid, turns) {
  let out = [...grid];
  const n = ((turns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) out = rotate90cw(out);
  return out;
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

function normalizeShotFace(face, label) {
  if (!face) throw new Error(`Face ausente: ${label}`);
  const center = normalizeColorToken(face.center);
  const grid = normalizeGrid(face.grid);
  if (!center) throw new Error(`Centro inválido em ${label}: ${face.center}`);
  if (grid[4] !== center) {
    grid[4] = center;
  }
  return { center, grid };
}

export function normalizeShot(shot, photoLabel) {
  return {
    top: normalizeShotFace(shot.top, `${photoLabel}.top`),
    front: normalizeShotFace(shot.front, `${photoLabel}.front`),
    right: normalizeShotFace(shot.right, `${photoLabel}.right`)
  };
}

function cloneFaces(faces) {
  return {
    U: [...faces.U],
    R: [...faces.R],
    F: [...faces.F],
    D: [...faces.D],
    L: [...faces.L],
    B: [...faces.B]
  };
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
    if (colors.some((c, idx) => colors.slice(idx + 1).some((o) => OPPOSITE[c] === o))) {
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
    if (colors[0] === colors[1] || OPPOSITE[colors[0]] === colors[1]) {
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

let solverReady = false;

function ensureSolver() {
  if (!solverReady) {
    Cube.initSolver();
    solverReady = true;
  }
}

export function isCubejsSolvable(faces) {
  try {
    ensureSolver();
    const cube = new CubeState();
    cube.setFaces(faces);
    const str54 = cube.toString54();
    if (str54.length !== 54) return false;
    const instance = Cube.fromString(str54);
    const sol = instance.solve();
    return typeof sol === 'string';
  } catch {
    return false;
  }
}

function scoreFaces(faces) {
  const counts = countColors(faces);
  const pieces = analyzePieces(faces);
  let score = 0;
  let allNine = true;
  for (const color of FACE_NAMES) {
    const n = counts[color] || 0;
    score -= Math.abs(n - 9) * 12;
    if (n !== 9) allNine = false;
  }
  score += pieces.uniqueCorners * 8;
  score += pieces.uniqueEdges * 4;
  score -= pieces.illegalCorners * 25;
  score -= pieces.illegalEdges * 18;
  const legalPieces =
    allNine &&
    pieces.uniqueCorners === 8 &&
    pieces.uniqueEdges === 12 &&
    pieces.illegalCorners === 0 &&
    pieces.illegalEdges === 0;
  if (legalPieces) score += 80;
  return { score, counts, pieces, allNine, legalPieces };
}

export function orientCentersToWCA(faces) {
  const pitches = ['', 'x', 'x2', "x'", 'z', "z'"];
  const yaws = ['', 'y', 'y2', "y'"];
  const seed = new CubeState();
  seed.setFaces(faces);

  for (const pitch of pitches) {
    for (const yaw of yaws) {
      const cube = seed.clone();
      if (pitch) cube.applyMove(pitch, false);
      if (yaw) cube.applyMove(yaw, false);
      const ok = FACE_NAMES.every((face) => cube.faces[face][4] === face);
      if (ok) {
        return {
          faces: cloneFaces(cube.faces),
          moves: [pitch, yaw].filter(Boolean)
        };
      }
    }
  }
  return { faces: cloneFaces(faces), moves: [] };
}

export function describeCoverage(photo1, photo2) {
  const a = [photo1.top.center, photo1.front.center, photo1.right.center];
  const b = [photo2.top.center, photo2.front.center, photo2.right.center];
  const uniqueCenters = Array.from(new Set([...a, ...b]));
  const overlap = a.filter((c) => b.includes(c));
  const missing = FACE_NAMES.filter((c) => !uniqueCenters.includes(c));

  const isSharedTop = photo1.top.center === photo2.top.center && uniqueCenters.length === 5;
  const isOppositeCorners = overlap.length === 0 && missing.length === 0;

  return {
    photo1Centers: a,
    photo2Centers: b,
    uniqueCenters,
    overlap,
    missing,
    isSharedTop,
    isOppositeCorners,
    mode: isSharedTop || uniqueCenters.length === 5 ? '5-faces' : '6-faces'
  };
}

/**
 * Deduce a 6ª face que está oculta (ex: face D/base) a partir das 5 faces conhecidas.
 */
export function deduceSixthFace(fiveFaces, missingFaceName = 'D') {
  const baseFaces = {
    U: [...fiveFaces.U],
    D: fiveFaces.D ? [...fiveFaces.D] : new Array(9).fill(null),
    F: [...fiveFaces.F],
    B: [...fiveFaces.B],
    R: [...fiveFaces.R],
    L: [...fiveFaces.L]
  };

  const topFaceName = OPPOSITE[missingFaceName] || 'U';
  const topCenter = baseFaces[topFaceName][4];
  const centerD = OPPOSITE[topCenter] || missingFaceName;

  // 1. Cantos conhecidos na camada de cima
  const usedCorners = new Set([
    pieceKey(baseFaces.U[8], baseFaces.R[0], baseFaces.F[2]),
    pieceKey(baseFaces.U[6], baseFaces.F[0], baseFaces.L[2]),
    pieceKey(baseFaces.U[0], baseFaces.L[0], baseFaces.B[2]),
    pieceKey(baseFaces.U[2], baseFaces.B[0], baseFaces.R[2])
  ]);

  const cornerSlots = [
    { dIdx: 0, c1: baseFaces.L[8], c2: baseFaces.F[6] },
    { dIdx: 2, c1: baseFaces.F[8], c2: baseFaces.R[6] },
    { dIdx: 8, c1: baseFaces.R[8], c2: baseFaces.B[6] },
    { dIdx: 6, c1: baseFaces.B[8], c2: baseFaces.L[6] }
  ];

  const remainingCorners = ALL_LEGAL_CORNERS.filter((c) => !usedCorners.has(pieceKey(...c)));
  const allCornersCombo = [];
  function pickCorners(slotIdx, currentPicked, usedIndices) {
    if (slotIdx === cornerSlots.length) {
      allCornersCombo.push([...currentPicked]);
      return;
    }
    const slot = cornerSlots[slotIdx];
    let matched = false;
    for (let i = 0; i < remainingCorners.length; i++) {
      if (!usedIndices.has(i)) {
        const triple = remainingCorners[i];
        if (triple.includes(slot.c1) && triple.includes(slot.c2)) {
          matched = true;
          const c3 = triple.find((c) => c !== slot.c1 && c !== slot.c2) || slot.c1;
          currentPicked[slot.dIdx] = c3;
          usedIndices.add(i);
          pickCorners(slotIdx + 1, currentPicked, usedIndices);
          usedIndices.delete(i);
        }
      }
    }
    if (!matched) {
      currentPicked[slot.dIdx] = centerD;
      pickCorners(slotIdx + 1, currentPicked, usedIndices);
    }
  }
  pickCorners(0, new Array(9).fill(null), new Set());

  // 2. Arestas conhecidas (4 do topo + 4 do meio)
  const usedEdges = new Set([
    pieceKey(baseFaces.U[5], baseFaces.R[1]),
    pieceKey(baseFaces.U[7], baseFaces.F[1]),
    pieceKey(baseFaces.U[3], baseFaces.L[1]),
    pieceKey(baseFaces.U[1], baseFaces.B[1]),
    pieceKey(baseFaces.F[5], baseFaces.R[3]),
    pieceKey(baseFaces.F[3], baseFaces.L[5]),
    pieceKey(baseFaces.B[5], baseFaces.L[3]),
    pieceKey(baseFaces.B[3], baseFaces.R[5])
  ]);

  const remainingEdges = ALL_LEGAL_EDGES.filter((e) => !usedEdges.has(pieceKey(...e)));

  const edgeSlots = [
    { dIdx: 1, sideColor: baseFaces.F[7] },
    { dIdx: 5, sideColor: baseFaces.R[7] },
    { dIdx: 7, sideColor: baseFaces.B[7] },
    { dIdx: 3, sideColor: baseFaces.L[7] }
  ];

  const allEdgesCombo = [];
  function pickEdges(slotIdx, currentPicked, usedIndices) {
    if (slotIdx === edgeSlots.length) {
      allEdgesCombo.push({ ...currentPicked });
      return;
    }
    const slot = edgeSlots[slotIdx];
    let matched = false;
    for (let i = 0; i < remainingEdges.length; i++) {
      if (!usedIndices.has(i)) {
        const edge = remainingEdges[i];
        if (edge.includes(slot.sideColor)) {
          matched = true;
          const otherColor = edge[0] === slot.sideColor ? edge[1] : edge[0];
          currentPicked[slot.dIdx] = otherColor;
          usedIndices.add(i);
          pickEdges(slotIdx + 1, currentPicked, usedIndices);
          usedIndices.delete(i);
        }
      }
    }
    if (!matched) {
      currentPicked[slot.dIdx] = centerD;
      pickEdges(slotIdx + 1, currentPicked, usedIndices);
    }
  }
  pickEdges(0, {}, new Set());

  let bestFaces = null;

  for (const cD of allCornersCombo) {
    for (const eD of allEdgesCombo) {
      const D = [...cD];
      D[4] = centerD;
      D[1] = eD[1] || centerD;
      D[5] = eD[5] || centerD;
      D[7] = eD[7] || centerD;
      D[3] = eD[3] || centerD;

      const candidateFaces = {
        U: [...baseFaces.U],
        D,
        F: [...baseFaces.F],
        B: [...baseFaces.B],
        R: [...baseFaces.R],
        L: [...baseFaces.L]
      };

      const counts = countColors(candidateFaces);
      const isAllNine = Object.values(counts).every((c) => c === 9);

      if (isAllNine) {
        const oriented = orientCentersToWCA(candidateFaces);
        if (isCubejsSolvable(oriented.faces)) {
          return candidateFaces;
        }
        if (!bestFaces) bestFaces = candidateFaces;
      }
    }
  }

  // Se não fechou perfeito com 9 por cor, preenche os nulos com as cores faltantes
  const fallbackD = allCornersCombo[0] || new Array(9).fill(centerD);
  fallbackD[4] = centerD;
  fallbackD[1] = fallbackD[1] || centerD;
  fallbackD[5] = fallbackD[5] || centerD;
  fallbackD[7] = fallbackD[7] || centerD;
  fallbackD[3] = fallbackD[3] || centerD;

  const resFaces = { ...baseFaces, D: fallbackD };
  const currentCounts = countColors(resFaces);
  for (let i = 0; i < 9; i++) {
    if (!resFaces.D[i] || currentCounts[resFaces.D[i]] > 9) {
      for (const color of FACE_NAMES) {
        if (currentCounts[color] < 9) {
          resFaces.D[i] = color;
          currentCounts[color]++;
          break;
        }
      }
    }
  }

  return bestFaces || resFaces;
}

/**
 * Monta as 5 faces para o caso de fotos com Top compartilhado
 */
function assembleFiveFaces(photo1, photo2) {
  // Photo 1: Top = U, Front = F, Right = R
  // Photo 2: Top = U (visto com giro de 180°), Front = B, Right = L
  return {
    U: [...photo1.top.grid],
    F: [...photo1.front.grid],
    R: [...photo1.right.grid],
    B: [...photo2.front.grid],
    L: [...photo2.right.grid]
  };
}

function assembleOppositeCorners(photo1, photo2) {
  return {
    U: [...photo1.top.grid],
    F: [...photo1.front.grid],
    R: [...photo1.right.grid],
    B: [...photo2.top.grid],
    D: rotate180(photo2.front.grid),
    L: rotate90ccw(photo2.right.grid)
  };
}

/**
 * @param {{photo1: object, photo2: object}} readings
 * @returns {{faces: object, coverage: object, ranked: object, oriented: object, warnings: string[], legal: boolean, solvable: boolean, mode: string}}
 */
export function reconstructFromTwoShotReadings(readings) {
  if (!readings?.photo1 || !readings?.photo2) {
    throw new Error('Envie as duas fotos do cubo.');
  }

  const photo1 = normalizeShot(readings.photo1, 'foto1');
  const photo2 = normalizeShot(readings.photo2, 'foto2');
  const coverage = describeCoverage(photo1, photo2);
  const warnings = [];

  let chosenFaces;
  let mode = coverage.mode;

  if (mode === '5-faces') {
    // 5 faces visíveis -> Deduzir a 6ª face oculta
    const five = assembleFiveFaces(photo1, photo2);
    chosenFaces = deduceSixthFace(five, 'D');
  } else {
    // 6 faces visíveis (cantos opostos)
    chosenFaces = assembleOppositeCorners(photo1, photo2);
  }

  const oriented = orientCentersToWCA(chosenFaces);
  const orientedRank = scoreFaces(oriented.faces);
  const solvable = orientedRank.legalPieces && isCubejsSolvable(oriented.faces);

  if (mode === '5-faces') {
    warnings.push('Modo 5 Faces: A base do cubo foi calculada e deduzida geometricamente.');
  }

  if (!orientedRank.allNine) {
    warnings.push('Contagem de cores com variação (reflexo/iluminação). Revise e confirme no editor 2D.');
  }
  if (orientedRank.pieces.illegalCorners || orientedRank.pieces.illegalEdges) {
    warnings.push('Algumas peças precisam de confirmação visual. Ajuste no mapa 2D.');
  }
  if (orientedRank.legalPieces && !solvable) {
    warnings.push('Cores contadas corretamente, mas ajuste de paridade necessário no mapa 2D.');
  }

  return {
    faces: oriented.faces,
    coverage,
    ranked: orientedRank,
    orientationMoves: oriented.moves,
    warnings,
    legal: orientedRank.legalPieces,
    solvable,
    mode
  };
}

export function extractJsonObject(text) {
  if (!text) throw new Error('Resposta vazia da visão.');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('A visão não devolveu JSON das faces.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export function packFacesAsTwoShots(faces) {
  return {
    photo1: {
      top: { center: faces.U[4], grid: [...faces.U] },
      front: { center: faces.F[4], grid: [...faces.F] },
      right: { center: faces.R[4], grid: [...faces.R] }
    },
    photo2: {
      top: { center: faces.B[4], grid: [...faces.B] },
      front: { center: faces.D[4], grid: rotate180(faces.D) },
      right: { center: faces.L[4], grid: rotate90cw(faces.L) }
    }
  };
}
