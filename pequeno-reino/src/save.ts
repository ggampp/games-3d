import { tilesUnlockedAt } from './game/catalog';
import type { SerializedSession } from './game/types';

export const SAVE_KEY = 'pequeno-reino-save-v1';
export const SAVE_VERSION = 2;

export type SaveOptions = {
  music: boolean;
  musicVolume: number;
  sfxVolume: number;
  voice: boolean;
  reduceParticles: boolean;
  models3d: boolean;
  tutorialDone: boolean;
};

export type SaveData = {
  version: number;
  maxUnlockedPhase: number;
  completedPhases: number[];
  /** Estrelas (0–3) e melhor pontuação por fase. */
  stars: Record<string, number>;
  bestScores: Record<string, number>;
  unlockedTiles: string[];
  discoveredTiles: string[];
  options: SaveOptions;
  session: SerializedSession | null;
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    maxUnlockedPhase: 1,
    completedPhases: [],
    stars: {},
    bestScores: {},
    unlockedTiles: tilesUnlockedAt(1),
    discoveredTiles: ['clareira'],
    options: {
      music: true,
      musicVolume: 0.6,
      sfxVolume: 0.8,
      voice: true,
      reduceParticles: false,
      models3d: true,
      tutorialDone: false,
    },
    session: null,
  };
}

/** Sessões antigas (v1/v2) não têm os campos novos: descarta a sessão, mantém o progresso. */
function migrate(parsed: Partial<SaveData> & { session?: unknown }): SaveData {
  const base = defaultSave();
  const version = typeof parsed.version === 'number' ? parsed.version : 1;
  const session =
    parsed.session && (parsed.session as SerializedSession).version === 3 ? (parsed.session as SerializedSession) : null;
  const merged: SaveData = {
    ...base,
    ...parsed,
    version: SAVE_VERSION,
    stars: { ...(parsed.stars ?? {}) },
    bestScores: { ...(parsed.bestScores ?? {}) },
    options: { ...base.options, ...(parsed.options ?? {}) },
    session,
  };
  if (version < 2) {
    for (const id of merged.completedPhases) merged.stars[String(id)] = Math.max(merged.stars[String(id)] ?? 0, 1);
  }
  // Tudo que a campanha já liberou por progresso entra na lista, sem duplicar.
  merged.unlockedTiles = [...new Set([...merged.unlockedTiles, ...tilesUnlockedAt(merged.maxUnlockedPhase)])];
  return merged;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // armazenamento indisponível (modo privado): o jogo segue sem persistir
  }
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
}

export function hasContinue(data: SaveData): boolean {
  return Boolean(data.session);
}

export function totalStars(data: SaveData): number {
  return Object.values(data.stars).reduce((sum, value) => sum + value, 0);
}
