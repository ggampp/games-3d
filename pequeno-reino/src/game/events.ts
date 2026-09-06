import { parseHexKey } from './hex';
import { countNeighbor, countNeighborAny, HOME_IDS, type TileMap } from './production';
import type { EventId, KingdomEvent } from './types';

/** Um evento de estação a cada tantas cartas posadas. */
export const EVENT_EVERY = 5;
/** Turnos de chuva depois do evento. */
export const RAIN_TURNS = 3;
/** Moedas que a feira paga por moradia. */
export const FEIRA_COINS_PER_HOME = 2;

const TITLES: Record<EventId, string> = {
  chuva: 'Chuva mansa',
  praga: 'Praga na roça',
  feira: 'Dia de feira',
};

/** Roças que ainda podem pegar praga: sem praga e sem horta ao lado. */
export function blightTargets(map: TileMap, blighted: readonly string[]): string[] {
  return [...map.entries()]
    .filter(([key, id]) => id === 'roca' && !blighted.includes(key) && countNeighbor(map, parseHexKey(key), 'horta') === 0)
    .map(([key]) => key);
}

export function homesCount(map: TileMap): number {
  return [...map.values()].filter((id) => (HOME_IDS as readonly string[]).includes(id)).length;
}

/** Eventos possíveis no estado atual do reino, em ordem fixa (a escolha usa o rng). */
export function eventCandidates(map: TileMap, blighted: readonly string[]): EventId[] {
  const out: EventId[] = [];
  if ([...map.values()].includes('rio')) out.push('chuva');
  if (blightTargets(map, blighted).length > 0) out.push('praga');
  if (homesCount(map) > 0) out.push('feira');
  return out;
}

/** Verdadeiro no turno em que um evento deve disparar. */
export function eventDue(turns: number): boolean {
  return turns > 0 && turns % EVENT_EVERY === 0;
}

/** Sorteia e descreve um evento; devolve null se nada se aplica ao reino. */
export function rollEvent(map: TileMap, blighted: readonly string[], rng: () => number): KingdomEvent | null {
  const candidates = eventCandidates(map, blighted);
  if (candidates.length === 0) return null;
  const id = candidates[Math.floor(rng() * candidates.length) % candidates.length]!;
  switch (id) {
    case 'chuva':
      return {
        id,
        titulo: TITLES.chuva,
        texto: `Chove fininho: cada rio rende +1 Água por ${RAIN_TURNS} turnos.`,
        coins: 0,
        target: null,
      };
    case 'praga': {
      const targets = blightTargets(map, blighted);
      const target = targets[Math.floor(rng() * targets.length) % targets.length]!;
      return {
        id,
        titulo: TITLES.praga,
        texto: 'Uma roça murchou: não rende nada até ganhar uma horta vizinha.',
        coins: 0,
        target,
      };
    }
    case 'feira': {
      const coins = homesCount(map) * FEIRA_COINS_PER_HOME;
      return {
        id,
        titulo: TITLES.feira,
        texto: `Feira na praça: ${coins} moedas (${FEIRA_COINS_PER_HOME} por moradia).`,
        coins,
        target: null,
      };
    }
    default:
      return null;
  }
}

/** Só para descrever no HUD: quantas moradias/rios/roças o evento poderia atingir. */
export function eventReach(map: TileMap): { rios: number; rocas: number; casas: number } {
  const values = [...map.values()];
  return {
    rios: values.filter((id) => id === 'rio').length,
    rocas: values.filter((id) => id === 'roca').length,
    casas: homesCount(map),
  };
}

export function isHome(id: string): boolean {
  return (HOME_IDS as readonly string[]).includes(id);
}

export function anyNeighborHome(map: TileMap, key: string): boolean {
  return countNeighborAny(map, parseHexKey(key), [...HOME_IDS]) > 0;
}
