import { seedFor } from './daily.ts';
import { generatePuzzle } from './generate.ts';
import type { DifficultySpec } from './generate.ts';
import type { Puzzle } from './grid.ts';

/**
 * Modo Jornada: 24 níveis fixos em 4 capítulos. Cada nível tem semente
 * própria (derivada do id) e parâmetros que crescem dentro do capítulo, então
 * o tabuleiro é sempre o mesmo para todo mundo — e o teste varre os 24.
 */

export const LEVELS_PER_CHAPTER = 6;

export interface ChapterSpec {
  id: number;
  title: string;
  /** O que o capítulo introduz — aparece no seletor e no HUD. */
  intro: string;
  /** Parâmetros do nível `n` (1..6) deste capítulo. */
  level: (n: number) => Omit<DifficultySpec, 'id' | 'label'>;
}

export const CHAPTERS: ChapterSpec[] = [
  {
    id: 1,
    title: 'Primeiros raios',
    intro: 'Espelhos e misturas: dois feixes, depois três.',
    level: (n) => ({
      size: n <= 3 ? 6 : 7,
      emitters: n <= 2 ? 2 : 3,
      targets: n <= 2 ? 2 : 3,
      turns: n <= 2 ? [1, 2] : [2, 3],
      walls: n <= 3 ? 2 : 3,
      minMirrors: n <= 2 ? 2 : n <= 4 ? 3 : 4,
    }),
  },
  {
    id: 2,
    title: 'O divisor',
    intro: 'Um prisma fixo divide o feixe em duas perpendiculares.',
    level: (n) => ({
      size: 7,
      emitters: n <= 2 ? 2 : 3,
      targets: 3,
      turns: [2, 3],
      walls: 3,
      prisms: n >= 5 ? 2 : 1,
      minMirrors: n <= 2 ? 2 : n <= 4 ? 3 : 4,
    }),
  },
  {
    id: 3,
    title: 'Filtros de cor',
    intro: 'O filtro só deixa passar uma primária — separe o que misturou.',
    level: (n) => ({
      size: 7,
      emitters: 3,
      targets: 3,
      turns: [2, 3],
      walls: 4,
      filters: n >= 4 ? 2 : 1,
      prisms: n >= 5 ? 1 : 0,
      minMirrors: n <= 3 ? 4 : 5,
    }),
  },
  {
    id: 4,
    title: 'O ateliê completo',
    intro: 'Tabuleiro 8×8 com prisma e filtro: tudo junto.',
    level: (n) => ({
      size: 8,
      emitters: n <= 3 ? 3 : 4,
      targets: n <= 3 ? 3 : 4,
      turns: [3, 4],
      walls: 5,
      prisms: 1,
      filters: 1,
      minMirrors: n <= 3 ? 6 : 7,
    }),
  },
];

export interface LevelRef {
  chapter: number;
  level: number;
}

export function levelId(ref: LevelRef): string {
  return `c${ref.chapter}n${ref.level}`;
}

export function levelSpec(ref: LevelRef): DifficultySpec {
  const chapter = CHAPTERS.find((c) => c.id === ref.chapter) ?? CHAPTERS[0];
  const n = Math.min(LEVELS_PER_CHAPTER, Math.max(1, ref.level));
  return {
    id: `jornada-${levelId({ chapter: chapter.id, level: n })}`,
    label: `Cap. ${chapter.id} · Nível ${n}`,
    ...chapter.level(n),
  };
}

/** Espelhos extras além do par: dá margem para 2 e 1 estrelas. */
export const JOURNEY_SLACK = 2;

export function journeyPuzzle(ref: LevelRef): Puzzle {
  const spec = levelSpec(ref);
  const seed = seedFor(`jornada-${ref.chapter}-${ref.level}`, spec.id);
  const puzzle = generatePuzzle(seed, spec);
  return { ...puzzle, mirrorBudget: puzzle.par + JOURNEY_SLACK };
}

export function allLevelRefs(): LevelRef[] {
  const out: LevelRef[] = [];
  for (const chapter of CHAPTERS) {
    for (let level = 1; level <= LEVELS_PER_CHAPTER; level++) out.push({ chapter: chapter.id, level });
  }
  return out;
}

export function nextLevel(ref: LevelRef): LevelRef | null {
  if (ref.level < LEVELS_PER_CHAPTER) return { chapter: ref.chapter, level: ref.level + 1 };
  if (ref.chapter < CHAPTERS.length) return { chapter: ref.chapter + 1, level: 1 };
  return null;
}

/** 3 estrelas = no par (ou abaixo), 2 = par + 1, 1 = resolveu. */
export function starsFor(par: number, used: number): 1 | 2 | 3 {
  if (used <= par) return 3;
  if (used === par + 1) return 2;
  return 1;
}

/** Nível liberado quando o anterior tem pelo menos uma estrela. */
export function isUnlocked(ref: LevelRef, stars: Record<string, number>): boolean {
  if (ref.chapter === 1 && ref.level === 1) return true;
  const previous = ref.level > 1
    ? { chapter: ref.chapter, level: ref.level - 1 }
    : { chapter: ref.chapter - 1, level: LEVELS_PER_CHAPTER };
  return (stars[levelId(previous)] ?? 0) > 0;
}

export function totalStars(stars: Record<string, number>): number {
  return allLevelRefs().reduce((sum, ref) => sum + (stars[levelId(ref)] ?? 0), 0);
}
