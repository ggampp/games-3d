/**
 * ChallengeDefs.js
 * Definição das trilhas e desafios do modo Desafios + regras puras de estrelas.
 * Sem DOM e sem Three.js: testável em Node.
 */

import { PATTERNS } from '../cube/Patterns.js';

export const CHALLENGE_TYPES = {
  SCRAMBLE: 'scramble', // resolver posição com N movimentos (Aprendiz)
  PATTERN: 'pattern',   // chegar a um padrão famoso
  TIMED: 'timed'        // scramble completo contra o relógio
};

export const TRACKS = [
  {
    id: 'aprendiz',
    name: 'Aprendiz',
    icon: 'graduation-cap',
    description: 'Posições curtas: resolva com o mínimo de movimentos.',
    challenges: [
      { id: 'apr-1', name: 'Primeiro giro', type: CHALLENGE_TYPES.SCRAMBLE, scrambleLength: 1 },
      { id: 'apr-2', name: 'Dupla', type: CHALLENGE_TYPES.SCRAMBLE, scrambleLength: 2 },
      { id: 'apr-3', name: 'Trinca', type: CHALLENGE_TYPES.SCRAMBLE, scrambleLength: 3 },
      { id: 'apr-4', name: 'Quarteto', type: CHALLENGE_TYPES.SCRAMBLE, scrambleLength: 4 },
      { id: 'apr-5', name: 'Mão cheia', type: CHALLENGE_TYPES.SCRAMBLE, scrambleLength: 5 }
    ]
  },
  {
    id: 'padroes',
    name: 'Padrões',
    icon: 'layout-grid',
    description: 'Partindo do cubo resolvido, monte padrões famosos.',
    challenges: [
      { id: 'pat-checker', name: 'Checkerboard', type: CHALLENGE_TYPES.PATTERN, pattern: 'checkerboard' },
      { id: 'pat-spots', name: 'Six Spots', type: CHALLENGE_TYPES.PATTERN, pattern: 'sixSpots' },
      { id: 'pat-tetris', name: 'Tetris', type: CHALLENGE_TYPES.PATTERN, pattern: 'tetris' },
      { id: 'pat-cube', name: 'Cube in a Cube', type: CHALLENGE_TYPES.PATTERN, pattern: 'cubeInCube' }
    ]
  },
  {
    id: 'relogio',
    name: 'Contra o relógio',
    icon: 'timer',
    description: 'Scramble oficial de 22 movimentos: resolva antes do tempo acabar.',
    challenges: [
      { id: 'clk-180', name: 'Em 3 minutos', type: CHALLENGE_TYPES.TIMED, limitMs: 180000 },
      { id: 'clk-120', name: 'Em 2 minutos', type: CHALLENGE_TYPES.TIMED, limitMs: 120000 },
      { id: 'clk-90', name: 'Em 1 min 30', type: CHALLENGE_TYPES.TIMED, limitMs: 90000 },
      { id: 'clk-60', name: 'Em 1 minuto', type: CHALLENGE_TYPES.TIMED, limitMs: 60000 }
    ]
  }
];

export const ALL_CHALLENGES = TRACKS.flatMap((t) => t.challenges.map((c) => ({ ...c, trackId: t.id })));

export function getChallenge(id) {
  return ALL_CHALLENGES.find((c) => c.id === id) || null;
}

export function getTrack(trackId) {
  return TRACKS.find((t) => t.id === trackId) || null;
}

/** Próximo desafio na mesma trilha (ou null se for o último). */
export function getNextChallenge(id) {
  const idx = ALL_CHALLENGES.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const next = ALL_CHALLENGES[idx + 1];
  return next && next.trackId === ALL_CHALLENGES[idx].trackId ? next : null;
}

/** Desafio anterior na mesma trilha (pré-requisito) ou null se for o primeiro. */
export function getPreviousChallenge(id) {
  const idx = ALL_CHALLENGES.findIndex((c) => c.id === id);
  if (idx <= 0) return null;
  const prev = ALL_CHALLENGES[idx - 1];
  return prev.trackId === ALL_CHALLENGES[idx].trackId ? prev : null;
}

/** Texto do objetivo exibido no HUD. */
export function describeObjective(def, extra = {}) {
  switch (def.type) {
    case CHALLENGE_TYPES.SCRAMBLE:
      return `Resolva a posição de ${def.scrambleLength} movimento${def.scrambleLength > 1 ? 's' : ''}. Ótimo: ${extra.optimal ?? def.scrambleLength} mov.`;
    case CHALLENGE_TYPES.PATTERN: {
      const p = PATTERNS[def.pattern];
      return `Monte o padrão "${p.name}" a partir do cubo resolvido (${parseLen(p.alg)} mov. pelo algoritmo).`;
    }
    case CHALLENGE_TYPES.TIMED:
      return `Resolva o scramble completo em menos de ${formatLimit(def.limitMs)}.`;
    default:
      return '';
  }
}

function parseLen(alg) {
  return alg.trim().split(/\s+/).filter(Boolean).length;
}

export function formatLimit(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s.toString().padStart(2, '0')}`;
}

/**
 * Estrelas do modo Aprendiz: 3 = ótimo, 2 = até ótimo+2, 1 = qualquer outro.
 * Usar dica limita a 2 estrelas.
 */
export function starsForScramble(moves, optimal, hintUsed = false) {
  let stars = 1;
  if (moves <= optimal) stars = 3;
  else if (moves <= optimal + 2) stars = 2;
  if (hintUsed) stars = Math.min(stars, 2);
  return stars;
}

/**
 * Estrelas do modo Padrões: 3 = no máximo o tamanho do algoritmo, 2 = até o dobro, 1 = mais.
 * Revelar o algoritmo limita a 2 estrelas.
 */
export function starsForPattern(moves, algLength, algShown = false) {
  let stars = 1;
  if (moves <= algLength) stars = 3;
  else if (moves <= algLength * 2) stars = 2;
  if (algShown) stars = Math.min(stars, 2);
  return stars;
}

/**
 * Estrelas contra o relógio: 0 = estourou o limite, 1 = dentro do limite,
 * 2 = até 75% do limite, 3 = até 50% do limite.
 */
export function starsForTimed(timeMs, limitMs) {
  if (timeMs > limitMs) return 0;
  if (timeMs <= limitMs * 0.5) return 3;
  if (timeMs <= limitMs * 0.75) return 2;
  return 1;
}

/** Movimentos que contam na métrica (rotações do cubo inteiro não contam). */
export function countsAsMove(move) {
  if (!move) return false;
  const base = move.replace(/['’2]/g, '');
  return !['x', 'y', 'z'].includes(base);
}
