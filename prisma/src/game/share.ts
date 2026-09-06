import type { Placements, Puzzle } from '../puzzle/grid.ts';
import type { Simulation } from '../puzzle/simulate.ts';

/** Resumo em emojis do resultado, no espírito dos jogos diários. */
export interface ShareMeta {
  title: string;
  seconds: number;
  streak?: number;
  stars?: number;
  url?: string;
}

const SQUARE: Record<number, string> = {
  1: '🟥', 2: '🟨', 3: '🟧', 4: '🟦', 5: '🟪', 6: '🟩', 7: '⬜',
};
const DOT: Record<number, string> = {
  1: '🔴', 2: '🟡', 3: '🟠', 4: '🔵', 5: '🟣', 6: '🟢', 7: '⚪',
};

/** Uma linha por fileira do tabuleiro: cores da luz, peças e escuro. */
export function boardEmoji(puzzle: Puzzle, sim: Simulation, placements: Placements): string[] {
  const rows: string[] = [];
  for (let y = 0; y < puzzle.height; y++) {
    let row = '';
    for (let x = 0; x < puzzle.width; x++) {
      const index = y * puzzle.width + x;
      const cell = puzzle.cells[index];
      const mask = sim.atCell[index] & 7;
      if (cell.kind === 'wall') row += '🧱';
      else if (cell.kind === 'emitter') row += DOT[cell.color] ?? '⚫';
      else if (cell.kind === 'target') row += sim.lit.has(index) ? (DOT[cell.want] ?? '⚫') : '⭕';
      else if (cell.kind === 'prism') row += '🔷';
      else if (cell.kind === 'filter') row += '🔳';
      else if (placements.has(index)) row += '🪞';
      else row += mask ? (SQUARE[mask] ?? '⬜') : '⬛';
    }
    rows.push(row);
  }
  return rows;
}

export function shareText(puzzle: Puzzle, sim: Simulation, placements: Placements, meta: ShareMeta): string {
  const lines = [
    `Prisma · ${meta.title}`,
    `🪞 ${placements.size}/${puzzle.par} · 🎯 ${sim.lit.size} · ⏱ ${formatSeconds(meta.seconds)}`
      + (meta.stars ? ` · ${'★'.repeat(meta.stars)}${'☆'.repeat(3 - meta.stars)}` : '')
      + (meta.streak ? ` · 🔥 ${meta.streak}` : ''),
    '',
    ...boardEmoji(puzzle, sim, placements),
  ];
  if (meta.url) lines.push('', meta.url);
  return lines.join('\n');
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
