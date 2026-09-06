import { describe, expect, it } from 'vitest';
import { BLUE, RED, YELLOW } from '../puzzle/colors.ts';
import { DOWN, RIGHT } from '../puzzle/grid.ts';
import type { Puzzle } from '../puzzle/grid.ts';
import { simulate } from '../puzzle/simulate.ts';
import { boardEmoji, formatSeconds, shareText } from './share.ts';

function tiny(): Puzzle {
  // Amarelo para a direita cruza vermelho para baixo; alvo laranja à direita.
  return {
    width: 4, height: 3, mirrorBudget: 2, par: 1, seed: 1, difficulty: 'teste', solution: new Map(),
    cells: [
      { kind: 'empty' }, { kind: 'emitter', color: RED, dir: DOWN }, { kind: 'empty' }, { kind: 'wall' },
      { kind: 'emitter', color: YELLOW, dir: RIGHT }, { kind: 'empty' }, { kind: 'empty' }, { kind: 'target', want: 3 },
      { kind: 'prism' }, { kind: 'filter', pass: BLUE }, { kind: 'empty' }, { kind: 'empty' },
    ],
  };
}

describe('compartilhar', () => {
  it('desenha o tabuleiro em emojis com as cores da luz', () => {
    const puzzle = tiny();
    const placements = new Map();
    const sim = simulate(puzzle, placements);
    const rows = boardEmoji(puzzle, sim, placements);
    expect(rows.length).toBe(3);
    expect(rows[0]).toBe('⬛🔴⬛🧱');
    expect(rows[1]).toBe('🟡🟧🟧🟠');
    expect(rows[2]).toBe('🔷🔳⬛⬛');
  });

  it('o alvo apagado aparece como anel e o espelho como espelho', () => {
    const puzzle = tiny();
    puzzle.cells[7] = { kind: 'target', want: 4 };
    const placements = new Map([[2, 'slash' as const]]);
    const sim = simulate(puzzle, placements);
    const rows = boardEmoji(puzzle, sim, placements);
    expect(rows[0]).toBe('⬛🔴🪞🧱');
    expect(rows[1].endsWith('⭕')).toBe(true);
  });

  it('monta o texto com cabeçalho, contadores e sequência', () => {
    const puzzle = tiny();
    const placements = new Map();
    const sim = simulate(puzzle, placements);
    const text = shareText(puzzle, sim, placements, { title: '2026-09-06 · Médio', seconds: 75, streak: 3, stars: 2 });
    expect(text.startsWith('Prisma · 2026-09-06 · Médio\n')).toBe(true);
    expect(text).toContain('🪞 0/1');
    expect(text).toContain('⏱ 1m15s');
    expect(text).toContain('★★☆');
    expect(text).toContain('🔥 3');
    expect(text.split('\n').length).toBe(6);
  });

  it('formata segundos', () => {
    expect(formatSeconds(9)).toBe('9s');
    expect(formatSeconds(61)).toBe('1m01s');
  });
});
