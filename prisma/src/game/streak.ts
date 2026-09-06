/**
 * Sequência de dias do desafio diário. Lógica pura sobre chaves AAAA-MM-DD,
 * para ser testável sem relógio nem localStorage.
 */
export interface DailyStats {
  /** Último dia em que o diário foi resolvido (qualquer dificuldade). */
  lastSolved: string;
  /** Dias seguidos até `lastSolved`. */
  streak: number;
  best: number;
  solvedDays: number;
}

export const EMPTY_STATS: DailyStats = { lastSolved: '', streak: 0, best: 0, solvedDays: 0 };

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Diferença em dias entre duas chaves (positiva se `to` vem depois). */
export function daysBetween(from: string, to: string): number {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return b - a;
}

/** Registra que o diário de `dateKey` foi resolvido. Resolver de novo no mesmo dia não conta. */
export function registerDailySolve(stats: DailyStats, dateKey: string): DailyStats {
  if (stats.lastSolved === dateKey) return stats;
  const gap = stats.lastSolved ? daysBetween(stats.lastSolved, dateKey) : Number.NaN;
  const streak = gap === 1 ? stats.streak + 1 : 1;
  return {
    lastSolved: dateKey,
    streak,
    best: Math.max(stats.best, streak),
    solvedDays: stats.solvedDays + 1,
  };
}

/** Sequência vigente vista de `today`: ainda vale se o último acerto foi hoje ou ontem. */
export function currentStreak(stats: DailyStats, today: string): number {
  if (!stats.lastSolved) return 0;
  const gap = daysBetween(stats.lastSolved, today);
  return gap === 0 || gap === 1 ? stats.streak : 0;
}
