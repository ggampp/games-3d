import { hexKey, hexNeighbors, parseHexKey, type Hex } from './hex';
import type { Evaluation, Harmony, PlaceFloat, Resources } from './types';

export type TileMap = Map<string, string>;

export function emptyHarmony(): Harmony {
  return { natureza: 0, povo: 0, agua: 0 };
}

export function emptyResources(): Resources {
  return { farinha: 0, pao: 0, madeira: 0, pedra: 0, peixe: 0, populacao: 0 };
}

export function neighborIds(map: TileMap, hex: Hex): string[] {
  return hexNeighbors(hex)
    .map((n) => map.get(hexKey(n)))
    .filter((id): id is string => Boolean(id));
}

export function countNeighbor(map: TileMap, hex: Hex, tileId: string): number {
  return neighborIds(map, hex).filter((id) => id === tileId).length;
}

export function countNeighborAny(map: TileMap, hex: Hex, ids: string[]): number {
  return neighborIds(map, hex).filter((id) => ids.includes(id)).length;
}

export function largestConnected(map: TileMap, tileId: string): number {
  const keys = [...map.entries()].filter(([, id]) => id === tileId).map(([key]) => key);
  const seen = new Set<string>();
  let best = 0;

  for (const start of keys) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    let size = 0;
    while (stack.length > 0) {
      const current = stack.pop()!;
      size += 1;
      for (const neighbor of hexNeighbors(parseHexKey(current))) {
        const key = hexKey(neighbor);
        if (seen.has(key) || map.get(key) !== tileId) continue;
        seen.add(key);
        stack.push(key);
      }
    }
    best = Math.max(best, size);
  }

  return best;
}

export function evaluateKingdom(map: TileMap): Evaluation {
  const harmony = emptyHarmony();
  const resources = emptyResources();

  for (const [key, tileId] of map) {
    const hex = parseHexKey(key);

    switch (tileId) {
      case 'clareira':
        harmony.natureza += 1;
        break;
      case 'mata':
        harmony.natureza += 1;
        break;
      case 'rio':
        harmony.agua += 1;
        break;
      case 'lago':
        harmony.agua += 2;
        break;
      case 'monte':
        harmony.natureza += 1;
        break;
      case 'roca':
        harmony.natureza += 1;
        break;
      case 'trigo':
        harmony.natureza += 1;
        break;
      case 'horta':
        harmony.natureza += 1;
        harmony.povo += 1;
        break;
      case 'vinha':
        harmony.natureza += 1 + countNeighbor(map, hex, 'mata');
        break;
      case 'pomar':
        harmony.natureza += 1 + countNeighbor(map, hex, 'mata');
        break;
      case 'poco':
        harmony.agua += 2;
        break;
      case 'engenho': {
        const grain = countNeighborAny(map, hex, ['roca', 'trigo']);
        const rios = countNeighbor(map, hex, 'rio');
        resources.farinha += grain + rios;
        harmony.povo += grain > 0 ? 1 : 0;
        harmony.agua += rios;
        break;
      }
      case 'moinho_vento': {
        const grain = countNeighborAny(map, hex, ['trigo', 'roca']);
        resources.farinha += 1 + grain;
        harmony.povo += 1;
        break;
      }
      case 'padaria': {
        const mills = countNeighborAny(map, hex, ['engenho', 'moinho_vento']);
        resources.pao += 1 + mills;
        harmony.povo += 2 + mills;
        break;
      }
      case 'serraria': {
        const forests = countNeighbor(map, hex, 'mata');
        resources.madeira += forests;
        harmony.natureza += forests;
        break;
      }
      case 'cabana_mateiro': {
        const forests = countNeighbor(map, hex, 'mata');
        harmony.natureza += 2 * forests;
        break;
      }
      case 'cais': {
        const waters = countNeighborAny(map, hex, ['rio', 'lago']);
        resources.peixe += waters;
        harmony.agua += 2 * waters;
        break;
      }
      case 'ponte': {
        const waters = countNeighborAny(map, hex, ['rio', 'lago']);
        harmony.agua += 2 * waters;
        harmony.povo += waters >= 2 ? 1 : 0;
        break;
      }
      case 'pedreira': {
        const mounts = countNeighbor(map, hex, 'monte');
        resources.pedra += mounts;
        harmony.natureza += mounts;
        break;
      }
      case 'olaria': {
        const mounts = countNeighbor(map, hex, 'monte');
        resources.pedra += mounts;
        harmony.povo += 1;
        break;
      }
      case 'casa':
        harmony.povo += 1;
        resources.populacao += 1;
        break;
      case 'sobrado':
        harmony.povo += 2;
        resources.populacao += 2;
        break;
      case 'casa_pedra':
        harmony.povo += 2;
        resources.populacao += 2;
        break;
      case 'mercado': {
        const homes = countNeighborAny(map, hex, ['casa', 'sobrado', 'casa_pedra']);
        harmony.povo += homes;
        break;
      }
      case 'capela':
        harmony.povo += 2;
        break;
      case 'escola':
        harmony.povo += 2;
        break;
      case 'estabulo': {
        const homes = countNeighborAny(map, hex, ['casa', 'sobrado', 'casa_pedra']);
        harmony.povo += 1 + homes;
        break;
      }
      case 'farol':
        harmony.agua += 1 + countNeighborAny(map, hex, ['rio', 'lago', 'cais']);
        break;
      case 'aldeao':
        resources.populacao += 1;
        harmony.povo += 1;
        break;
      case 'moleiro': {
        resources.populacao += 1;
        harmony.povo += 1;
        resources.farinha += countNeighborAny(map, hex, ['engenho', 'moinho_vento']);
        break;
      }
      case 'padeiro': {
        resources.populacao += 1;
        harmony.povo += 1;
        resources.pao += countNeighbor(map, hex, 'padaria');
        break;
      }
      case 'pescador': {
        resources.populacao += 1;
        harmony.povo += 1;
        resources.peixe += 1 + countNeighborAny(map, hex, ['rio', 'lago', 'cais']);
        harmony.agua += countNeighborAny(map, hex, ['rio', 'lago']);
        break;
      }
      default:
        break;
    }
  }

  resources.populacao += Math.floor(resources.pao / 2);

  return { harmony, resources };
}

export function placementFloats(map: TileMap, hex: Hex, tileId: string): PlaceFloat[] {
  const before = evaluateKingdom(map);
  const next = new Map(map);
  next.set(hexKey(hex), tileId);
  const after = evaluateKingdom(next);
  const floats: PlaceFloat[] = [];

  const axes: Array<{ key: keyof Harmony; label: string }> = [
    { key: 'natureza', label: 'Natureza' },
    { key: 'povo', label: 'Povo' },
    { key: 'agua', label: 'Água' },
  ];
  for (const axis of axes) {
    const amount = after.harmony[axis.key] - before.harmony[axis.key];
    if (amount !== 0) {
      floats.push({ axis: axis.key, label: axis.label, amount });
    }
  }

  const recursos: Array<{ key: keyof Resources; label: string }> = [
    { key: 'farinha', label: 'Farinha' },
    { key: 'pao', label: 'Pão' },
    { key: 'madeira', label: 'Madeira' },
    { key: 'peixe', label: 'Peixe' },
    { key: 'pedra', label: 'Pedra' },
  ];
  for (const rec of recursos) {
    const amount = after.resources[rec.key] - before.resources[rec.key];
    if (amount !== 0) {
      floats.push({ axis: 'recurso', label: rec.label, amount });
    }
  }

  return floats;
}
