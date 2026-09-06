import type { Mirror } from '../puzzle/grid.ts';
import { EMPTY_STATS } from './streak.ts';
import type { DailyStats } from './streak.ts';

const KEY = 'prisma-progresso-v1';
const JOURNEY_KEY = 'prisma-jornada-v1';
const STATS_KEY = 'prisma-diario-v1';

export interface Progress {
  dateKey: string;
  difficultyId: string;
  /** Espelhos do jogador: pares [índice da célula, orientação]. */
  placements: [number, Mirror][];
  solved: boolean;
}

const EMPTY: Progress = {
  dateKey: '',
  difficultyId: 'medio',
  placements: [],
  solved: false,
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem armazenamento disponível: o jogo segue, só não guarda o progresso.
  }
}

export function saveProgress(progress: Progress): void {
  write(KEY, progress);
}

/** Lê o progresso do dia, descartando qualquer coisa malformada. */
export function loadProgress(): Progress {
  const raw = read(KEY);
  if (!raw) return { ...EMPTY };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const placements = Array.isArray(parsed.placements)
      ? (parsed.placements as unknown[]).flatMap((entry): [number, Mirror][] => {
        if (!Array.isArray(entry) || entry.length !== 2) return [];
        const [index, mirror] = entry as [unknown, unknown];
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return [];
        if (mirror !== 'slash' && mirror !== 'backslash') return [];
        return [[index, mirror]];
      })
      : [];
    return {
      dateKey: typeof parsed.dateKey === 'string' ? parsed.dateKey : '',
      difficultyId: typeof parsed.difficultyId === 'string' ? parsed.difficultyId : 'medio',
      placements,
      solved: parsed.solved === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}

/** Progresso da Jornada: estrelas por nível (`c1n1` → 1..3) e último nível aberto. */
export interface JourneyProgress {
  stars: Record<string, number>;
  lastChapter: number;
  lastLevel: number;
}

export function loadJourney(): JourneyProgress {
  const fallback: JourneyProgress = { stars: {}, lastChapter: 1, lastLevel: 1 };
  const raw = read(JOURNEY_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const stars: Record<string, number> = {};
    if (parsed.stars && typeof parsed.stars === 'object') {
      for (const [id, value] of Object.entries(parsed.stars as Record<string, unknown>)) {
        if (/^c\d+n\d+$/.test(id) && typeof value === 'number' && value >= 1 && value <= 3) {
          stars[id] = Math.floor(value);
        }
      }
    }
    const lastChapter = typeof parsed.lastChapter === 'number' ? parsed.lastChapter : 1;
    const lastLevel = typeof parsed.lastLevel === 'number' ? parsed.lastLevel : 1;
    return { stars, lastChapter, lastLevel };
  } catch {
    return fallback;
  }
}

export function saveJourney(progress: JourneyProgress): void {
  write(JOURNEY_KEY, progress);
}

export function loadDailyStats(): DailyStats {
  const raw = read(STATS_KEY);
  if (!raw) return { ...EMPTY_STATS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return {
      lastSolved: typeof parsed.lastSolved === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastSolved) ? parsed.lastSolved : '',
      streak: num(parsed.streak),
      best: num(parsed.best),
      solvedDays: num(parsed.solvedDays),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function saveDailyStats(stats: DailyStats): void {
  write(STATS_KEY, stats);
}
