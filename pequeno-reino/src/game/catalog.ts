import phasesJson from '../data/phases.pt-BR.json';
import questsJson from '../data/quests.pt-BR.json';
import tilesJson from '../data/tiles.pt-BR.json';
import type { PhaseDef, QuestDef, TileDef } from './types';

export const TILES: TileDef[] = tilesJson.tiles as TileDef[];
export const PHASES: PhaseDef[] = phasesJson.phases as PhaseDef[];
export const QUESTS: QuestDef[] = questsJson.quests as QuestDef[];

const tilesById = new Map(TILES.map((tile) => [tile.id, tile]));
const phasesById = new Map(PHASES.map((phase) => [phase.id, phase]));
const questsById = new Map(QUESTS.map((quest) => [quest.id, quest]));

export function getTile(id: string): TileDef {
  const tile = tilesById.get(id);
  if (!tile) throw new Error(`Tile desconhecido: ${id}`);
  return tile;
}

export function hasTile(id: string): boolean {
  return tilesById.has(id);
}

export function getPhase(id: number): PhaseDef {
  const phase = phasesById.get(id);
  if (!phase) throw new Error(`Fase desconhecida: ${id}`);
  return phase;
}

export function getQuest(id: string): QuestDef {
  const quest = questsById.get(id);
  if (!quest) throw new Error(`Missão desconhecida: ${id}`);
  return quest;
}

/** Tiles disponíveis por progresso de campanha (unlockPhase = primeira fase em que aparecem). */
export function tilesUnlockedAt(maxPhase: number): string[] {
  return TILES.filter((tile) => tile.unlockPhase <= maxPhase).map((tile) => tile.id);
}

/**
 * Baralho de uma fase: o baralho base mais os tiles já desbloqueados que ainda não estão nele.
 * Assim a recompensa de cada fase entra de fato nas fases seguintes. No sandbox entram em dobro.
 */
export function buildDeck(phase: PhaseDef, unlockedTiles: Iterable<string>): string[] {
  const deck = [...phase.deck];
  const base = new Set(deck);
  const copies = phase.sandbox ? 2 : 1;
  for (const id of new Set(unlockedTiles)) {
    if (!hasTile(id) || base.has(id)) continue;
    const tile = getTile(id);
    if (tile.unlockPhase > phase.id) continue;
    for (let i = 0; i < copies; i += 1) deck.push(id);
  }
  return deck;
}
