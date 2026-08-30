import { hexKey, hexNeighbors, parseHexKey, type Hex } from './hex';
import type { TileMap } from './production';

export function occupiedHexes(map: TileMap): Hex[] {
  return [...map.keys()].map(parseHexKey);
}

export function validPlacements(map: TileMap): Hex[] {
  if (map.size === 0) return [{ q: 0, r: 0 }];
  const valid = new Map<string, Hex>();
  for (const hex of occupiedHexes(map)) {
    for (const neighbor of hexNeighbors(hex)) {
      const key = hexKey(neighbor);
      if (!map.has(key)) valid.set(key, neighbor);
    }
  }
  return [...valid.values()];
}

export function canPlace(map: TileMap, hex: Hex): boolean {
  return validPlacements(map).some((spot) => spot.q === hex.q && spot.r === hex.r);
}
