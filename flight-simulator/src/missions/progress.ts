import type { MissionResult } from './types';

export const PROGRESS_KEY = 'skywatch.campaign.v1';

export type MissionBest = { stars: number; score: number; timeSec: number };

export type CampaignProgress = {
  version: 1;
  /** quantas missões estão liberadas (índice < unlocked) */
  unlocked: number;
  best: Record<string, MissionBest>;
  aircraft: 'a350' | 'a320';
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function defaultProgress(): CampaignProgress {
  return { version: 1, unlocked: 1, best: {}, aircraft: 'a350' };
}

function isProgress(value: unknown): value is CampaignProgress {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<CampaignProgress>;
  return v.version === 1 && typeof v.unlocked === 'number' && typeof v.best === 'object' && v.best !== null;
}

export function loadProgress(storage: StorageLike | null | undefined): CampaignProgress {
  if (!storage) return defaultProgress();
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (!raw) return defaultProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isProgress(parsed)) return defaultProgress();
    return {
      version: 1,
      unlocked: Math.max(1, Math.floor(parsed.unlocked)),
      best: { ...parsed.best },
      aircraft: parsed.aircraft === 'a320' ? 'a320' : 'a350',
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(storage: StorageLike | null | undefined, progress: CampaignProgress): void {
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // armazenamento indisponível (modo privado, cota) — segue sem persistir
  }
}

/** Aplica um resultado de missão ao progresso. Puro: devolve um novo objeto. */
export function recordResult(
  progress: CampaignProgress,
  missionIndex: number,
  result: MissionResult,
  missionCount: number,
): CampaignProgress {
  const best = { ...progress.best };
  const previous = best[result.missionId];
  if (
    !previous ||
    result.stars > previous.stars ||
    (result.stars === previous.stars && result.score > previous.score)
  ) {
    best[result.missionId] = { stars: result.stars, score: result.score, timeSec: result.timeSec };
  }
  let unlocked = progress.unlocked;
  if (result.success) unlocked = Math.max(unlocked, Math.min(missionCount, missionIndex + 2));
  return { ...progress, unlocked, best };
}

export function isUnlocked(progress: CampaignProgress, missionIndex: number): boolean {
  return missionIndex < progress.unlocked;
}

export function totalStars(progress: CampaignProgress): number {
  return Object.values(progress.best).reduce((sum, item) => sum + item.stars, 0);
}
