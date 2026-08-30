import { hexDistance, hexNeighbors, hexToWorld, parseHexKey, type Hex } from './hex';
import type { TileMap } from './production';

export type Villager = {
  id: number;
  from: Hex;
  to: Hex;
  t: number;
  speed: number;
  wait: number;
};

const HOME_IDS = new Set(['casa', 'sobrado', 'casa_pedra', 'aldeao', 'moleiro', 'padeiro', 'pescador']);
const WORK_IDS = new Set([
  'roca',
  'trigo',
  'horta',
  'vinha',
  'engenho',
  'moinho_vento',
  'mercado',
  'padaria',
  'cais',
  'serraria',
  'pomar',
  'escola',
  'estabulo',
  'ponte',
  'farol',
  'olaria',
  'poco',
]);

function tilesOf(map: TileMap, ids: Set<string>): Hex[] {
  return [...map.entries()].filter(([, id]) => ids.has(id)).map(([key]) => parseHexKey(key));
}

function greedyStep(from: Hex, to: Hex): Hex {
  if (from.q === to.q && from.r === to.r) return from;
  let best = from;
  let bestDist = hexDistance(from, to);
  for (const neighbor of hexNeighbors(from)) {
    const dist = hexDistance(neighbor, to);
    if (dist < bestDist) {
      best = neighbor;
      bestDist = dist;
    }
  }
  return best;
}

export function syncVillagers(map: TileMap, existing: Villager[]): Villager[] {
  const homes = tilesOf(map, HOME_IDS);
  const work = tilesOf(map, WORK_IDS);
  const next: Villager[] = [];

  homes.forEach((home, index) => {
    const previous = existing[index];
    const target = work.length === 0 ? home : work[index % work.length]!;
    next.push({
      id: index,
      from: previous?.from ?? home,
      to: previous?.to ?? target,
      t: previous?.t ?? 0,
      speed: 0.55 + (index % 3) * 0.08,
      wait: previous?.wait ?? index * 0.4,
    });
  });

  return next;
}

export function stepVillagers(villagers: Villager[], map: TileMap, dt: number): Villager[] {
  const work = tilesOf(map, WORK_IDS);
  const homes = tilesOf(map, HOME_IDS);

  return villagers.map((villager, index) => {
    const copy = { ...villager };
    if (copy.wait > 0) {
      copy.wait -= dt;
      return copy;
    }
    copy.t += dt * copy.speed;
    if (copy.t >= 1) {
      copy.from = copy.to;
      copy.t = 0;
      const pool = index % 2 === 0 ? work : homes;
      const destination = pool.length === 0 ? copy.from : pool[Math.floor(Math.random() * pool.length)]!;
      copy.to = greedyStep(copy.from, destination);
      if (copy.to.q === copy.from.q && copy.to.r === copy.from.r && pool.length > 0) {
        copy.to = pool[index % pool.length]!;
      }
      copy.wait = 0.2 + (index % 4) * 0.15;
    }
    return copy;
  });
}

export function villagerWorld(villager: Villager): { x: number; z: number } {
  const a = hexToWorld(villager.from);
  const b = hexToWorld(villager.to);
  const t = villager.t;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}
