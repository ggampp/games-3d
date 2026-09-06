/**
 * Progresso da campanha: quais mapas foram concluídos, com quantas estrelas,
 * e qual é o próximo desbloqueado. Puro (recebe a lista de mapas) e testável.
 * Persistido em `localStorage` numa chave própria, separada dos saves por mapa.
 */

import type { ParRules, WorldDef } from '../world/maps.ts';

export const CAMPAIGN_KEY = 'canyon-rails-campaign-v1';

export interface MapResult {
  /** 1 a 3. */
  stars: number;
  /** Melhor tempo (s) de conclusão dos objetivos. */
  bestTime: number;
  /** Moedas em caixa na melhor conclusão. */
  coins: number;
  completedAt: number;
}

export interface CampaignData {
  version: 1;
  maps: Record<string, MapResult>;
}

export interface MapStatus {
  unlocked: boolean;
  completed: boolean;
  stars: number;
  /** Posição na campanha, começando em 1. */
  order: number;
}

/**
 * Estrelas de uma conclusão: 1 por terminar os objetivos, +1 se bateu o tempo
 * OU as moedas de referência, 3 se bateu os dois.
 */
export function starsFor(elapsedSeconds: number, coins: number, par: ParRules): number {
  let stars = 1;
  if (elapsedSeconds <= par.time) stars++;
  if (coins >= par.coins) stars++;
  return stars;
}

export function emptyCampaign(): CampaignData {
  return { version: 1, maps: {} };
}

export function readCampaign(storage: Pick<Storage, 'getItem'> | null = safeStorage()): CampaignData {
  if (!storage) return emptyCampaign();
  try {
    const raw = storage.getItem(CAMPAIGN_KEY);
    if (!raw) return emptyCampaign();
    const parsed = JSON.parse(raw) as { version?: unknown; maps?: unknown };
    if (parsed.version !== 1 || typeof parsed.maps !== 'object' || parsed.maps === null) {
      return emptyCampaign();
    }
    const maps: Record<string, MapResult> = {};
    for (const [id, value] of Object.entries(parsed.maps as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      const stars = typeof v.stars === 'number' ? Math.min(3, Math.max(1, Math.round(v.stars))) : 0;
      if (stars === 0) continue;
      maps[id] = {
        stars,
        bestTime: typeof v.bestTime === 'number' && Number.isFinite(v.bestTime) ? v.bestTime : Infinity,
        coins: typeof v.coins === 'number' && Number.isFinite(v.coins) ? v.coins : 0,
        completedAt: typeof v.completedAt === 'number' ? v.completedAt : 0,
      };
    }
    return { version: 1, maps };
  } catch {
    return emptyCampaign();
  }
}

export function writeCampaign(
  data: CampaignData,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    const maps: Record<string, MapResult> = {};
    for (const [id, r] of Object.entries(data.maps)) {
      maps[id] = { ...r, bestTime: Number.isFinite(r.bestTime) ? r.bestTime : 0 };
    }
    storage.setItem(CAMPAIGN_KEY, JSON.stringify({ version: 1, maps }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Registra uma conclusão. Mantém sempre o melhor resultado (mais estrelas;
 * em empate, menor tempo). Devolve as estrelas desta conclusão e se foi novidade.
 */
export function recordCompletion(
  data: CampaignData,
  mapId: string,
  elapsedSeconds: number,
  coins: number,
  par: ParRules,
  now = Date.now(),
): { stars: number; improved: boolean; firstTime: boolean } {
  const stars = starsFor(elapsedSeconds, coins, par);
  const previous = data.maps[mapId];
  const firstTime = !previous;
  const improved = !previous
    || stars > previous.stars
    || (stars === previous.stars && elapsedSeconds < previous.bestTime);
  if (improved) {
    data.maps[mapId] = { stars, bestTime: elapsedSeconds, coins, completedAt: now };
  }
  return { stars, improved, firstTime };
}

/** Situação de cada mapa na ordem da campanha: o primeiro é sempre aberto. */
export function mapStatuses(
  data: CampaignData,
  worlds: readonly Pick<WorldDef, 'id'>[],
): Map<string, MapStatus> {
  const out = new Map<string, MapStatus>();
  let previousDone = true;
  worlds.forEach((world, index) => {
    const result = data.maps[world.id];
    const completed = !!result;
    out.set(world.id, {
      unlocked: index === 0 || previousDone,
      completed,
      stars: result?.stars ?? 0,
      order: index + 1,
    });
    previousDone = completed;
  });
  return out;
}

export function isUnlocked(data: CampaignData, worlds: readonly Pick<WorldDef, 'id'>[], mapId: string): boolean {
  return mapStatuses(data, worlds).get(mapId)?.unlocked ?? false;
}

/** Id do mapa seguinte na campanha, ou null se este é o último. */
export function nextMapId(worlds: readonly Pick<WorldDef, 'id'>[], mapId: string): string | null {
  const index = worlds.findIndex((w) => w.id === mapId);
  if (index < 0 || index + 1 >= worlds.length) return null;
  return worlds[index + 1]!.id;
}

export function totalStars(data: CampaignData): number {
  return Object.values(data.maps).reduce((sum, r) => sum + r.stars, 0);
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
