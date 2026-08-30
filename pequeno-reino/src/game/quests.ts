import { getQuest } from './catalog';
import { parseHexKey } from './hex';
import { countNeighbor, countNeighborAny, largestConnected, type TileMap } from './production';
import type { Evaluation, QuestDef } from './types';

export type QuestProgress = {
  id: string;
  titulo: string;
  descricao: string;
  current: number;
  amount: number;
  done: boolean;
  optional: boolean;
};

export function evaluateQuest(quest: QuestDef, map: TileMap, evaluation: Evaluation): number {
  switch (quest.type) {
    case 'count':
      return [...map.values()].filter((id) => id === quest.tileId).length;
    case 'adjacentCount': {
      if (!quest.tileId || !quest.neighborId) return 0;
      let best = 0;
      for (const [key, id] of map) {
        if (id !== quest.tileId) continue;
        best = Math.max(best, countNeighbor(map, parseHexKey(key), quest.neighborId));
      }
      return best;
    }
    case 'adjacentAny': {
      if (!quest.tileId || !quest.neighborIds) return 0;
      let best = 0;
      for (const [key, id] of map) {
        if (id !== quest.tileId) continue;
        best = Math.max(best, countNeighborAny(map, parseHexKey(key), quest.neighborIds));
      }
      return best;
    }
    case 'connected':
      return quest.tileId ? largestConnected(map, quest.tileId) : 0;
    case 'populacao':
      return evaluation.resources.populacao;
    case 'harmonyAll':
      return Math.min(
        evaluation.harmony.natureza,
        evaluation.harmony.povo,
        evaluation.harmony.agua,
      );
    case 'mapSize':
      return map.size;
    default:
      return 0;
  }
}

export function questProgress(questIds: string[], map: TileMap, evaluation: Evaluation): QuestProgress[] {
  return questIds.map((id) => {
    const quest = getQuest(id);
    const current = evaluateQuest(quest, map, evaluation);
    return {
      id: quest.id,
      titulo: quest.titulo,
      descricao: quest.descricao,
      current,
      amount: quest.amount,
      done: current >= quest.amount,
      optional: Boolean(quest.optional),
    };
  });
}

export function requiredQuestsDone(progress: QuestProgress[]): boolean {
  const required = progress.filter((quest) => !quest.optional);
  if (required.length === 0) return false;
  return required.every((quest) => quest.done);
}
