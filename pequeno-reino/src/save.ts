import { PHASES } from './game/catalog';
import type { SerializedSession } from './game/types';

export const SAVE_KEY = 'pequeno-reino-save-v1';

export type SaveData = {
  maxUnlockedPhase: number;
  completedPhases: number[];
  unlockedTiles: string[];
  discoveredTiles: string[];
  options: {
    music: boolean;
    reduceParticles: boolean;
  };
  session: SerializedSession | null;
};

export function defaultSave(): SaveData {
  return {
    maxUnlockedPhase: 1,
    completedPhases: [],
    unlockedTiles: PHASES[0] ? ['clareira', 'mata', 'roca', 'casa', 'aldeao'] : [],
    discoveredTiles: ['clareira'],
    options: { music: true, reduceParticles: false },
    session: null,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    return { ...defaultSave(), ...parsed, options: { ...defaultSave().options, ...parsed.options } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function hasContinue(data: SaveData): boolean {
  return Boolean(data.session) || data.completedPhases.length > 0 || data.maxUnlockedPhase > 1;
}
