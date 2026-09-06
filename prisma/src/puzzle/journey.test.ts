import { describe, expect, it } from 'vitest';
import {
  CHAPTERS, JOURNEY_SLACK, LEVELS_PER_CHAPTER, allLevelRefs, isUnlocked, journeyPuzzle,
  levelId, levelSpec, nextLevel, starsFor, totalStars,
} from './journey.ts';
import { countKind } from './grid.ts';
import { isSolved, simulate } from './simulate.ts';

describe('jornada', () => {
  it('tem 4 capítulos de 6 níveis', () => {
    expect(CHAPTERS.length).toBe(4);
    expect(LEVELS_PER_CHAPTER).toBe(6);
    expect(allLevelRefs().length).toBe(24);
  });

  it('os 24 níveis geram sem fallback, são resolvíveis e têm as peças do capítulo', () => {
    for (const ref of allLevelRefs()) {
      const spec = levelSpec(ref);
      const puzzle = journeyPuzzle(ref);
      const label = levelId(ref);
      expect(puzzle.difficulty, `${label} caiu no fallback`).toBe(spec.id);
      expect(isSolved(puzzle, simulate(puzzle, puzzle.solution)), label).toBe(true);
      expect(countKind(puzzle, 'prism'), `${label} prismas`).toBe(spec.prisms ?? 0);
      expect(countKind(puzzle, 'filter'), `${label} filtros`).toBe(spec.filters ?? 0);
      expect(puzzle.mirrorBudget).toBe(puzzle.par + JOURNEY_SLACK);
      expect(puzzle.par).toBeGreaterThanOrEqual(spec.minMirrors ?? 1);
    }
  });

  it('capítulo 2 introduz o prisma e capítulo 3 o filtro', () => {
    for (let level = 1; level <= LEVELS_PER_CHAPTER; level++) {
      expect(countKind(journeyPuzzle({ chapter: 1, level }), 'prism')).toBe(0);
      expect(countKind(journeyPuzzle({ chapter: 2, level }), 'prism')).toBeGreaterThan(0);
      expect(countKind(journeyPuzzle({ chapter: 3, level }), 'filter')).toBeGreaterThan(0);
      expect(countKind(journeyPuzzle({ chapter: 4, level }), 'prism')).toBeGreaterThan(0);
      expect(countKind(journeyPuzzle({ chapter: 4, level }), 'filter')).toBeGreaterThan(0);
    }
  });

  it('o mesmo nível dá sempre o mesmo tabuleiro', () => {
    const a = journeyPuzzle({ chapter: 2, level: 3 });
    const b = journeyPuzzle({ chapter: 2, level: 3 });
    expect(a.seed).toBe(b.seed);
    expect(a.cells).toEqual(b.cells);
  });

  it('estrelas: par = 3, par + 1 = 2, resto = 1', () => {
    expect(starsFor(4, 3)).toBe(3);
    expect(starsFor(4, 4)).toBe(3);
    expect(starsFor(4, 5)).toBe(2);
    expect(starsFor(4, 6)).toBe(1);
  });

  it('desbloqueio sequencial e próximo nível', () => {
    expect(isUnlocked({ chapter: 1, level: 1 }, {})).toBe(true);
    expect(isUnlocked({ chapter: 1, level: 2 }, {})).toBe(false);
    expect(isUnlocked({ chapter: 1, level: 2 }, { c1n1: 1 })).toBe(true);
    expect(isUnlocked({ chapter: 2, level: 1 }, { c1n6: 2 })).toBe(true);
    expect(isUnlocked({ chapter: 2, level: 1 }, { c1n5: 3 })).toBe(false);
    expect(nextLevel({ chapter: 1, level: 6 })).toEqual({ chapter: 2, level: 1 });
    expect(nextLevel({ chapter: 4, level: 6 })).toBeNull();
    expect(totalStars({ c1n1: 3, c1n2: 2, lixo: 9 })).toBe(5);
  });
});
