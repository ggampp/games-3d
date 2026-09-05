import { hexKey, hexNeighbors, hexToWorld, parseHexKey, type Hex } from './hex';
import type { TileMap } from './production';

export type Villager = {
  id: number;
  from: Hex;
  to: Hex;
  t: number;
  speed: number;
  wait: number;
  goal: Hex | null;
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

/** Próximo passo de um caminho por hexes ocupados (BFS). Fica parado se não há rota. */
export function nextStepOnMap(map: TileMap, from: Hex, to: Hex): Hex {
  const start = hexKey(from);
  const goal = hexKey(to);
  if (start === goal) return from;
  const prev = new Map<string, string>();
  const queue = [start];
  prev.set(start, start);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === goal) break;
    for (const neighbor of hexNeighbors(parseHexKey(current))) {
      const key = hexKey(neighbor);
      if (prev.has(key) || !map.has(key)) continue;
      prev.set(key, current);
      queue.push(key);
    }
  }
  if (!prev.has(goal)) return from;
  let cursor = goal;
  while (prev.get(cursor) !== start) cursor = prev.get(cursor)!;
  return parseHexKey(cursor);
}

export function syncVillagers(map: TileMap, existing: Villager[]): Villager[] {
  const homes = tilesOf(map, HOME_IDS);
  const next: Villager[] = [];

  homes.forEach((home, index) => {
    const previous = existing[index];
    const stillValid = previous && map.has(hexKey(previous.from)) && map.has(hexKey(previous.to));
    next.push({
      id: index,
      from: stillValid ? previous.from : home,
      to: stillValid ? previous.to : home,
      t: stillValid ? previous.t : 0,
      speed: 0.55 + (index % 3) * 0.08,
      wait: previous?.wait ?? index * 0.4,
      goal: stillValid ? previous.goal : null,
    });
  });

  return next;
}

export function stepVillagers(villagers: Villager[], map: TileMap, dt: number, rng: () => number): Villager[] {
  const work = tilesOf(map, WORK_IDS);
  const homes = tilesOf(map, HOME_IDS);

  return villagers.map((villager, index) => {
    const copy = { ...villager };
    if (copy.wait > 0) {
      copy.wait -= dt;
      return copy;
    }
    copy.t += dt * copy.speed;
    if (copy.t < 1) return copy;

    copy.from = copy.to;
    copy.t = 0;
    const arrived = copy.goal && copy.goal.q === copy.from.q && copy.goal.r === copy.from.r;
    if (!copy.goal || arrived) {
      const pool = index % 2 === 0 ? work : homes;
      const alt = pool.length > 0 ? pool : homes;
      copy.goal = alt.length > 0 ? alt[Math.floor(rng() * alt.length)]! : null;
      copy.wait = 0.4 + (index % 4) * 0.2;
    }
    copy.to = copy.goal ? nextStepOnMap(map, copy.from, copy.goal) : copy.from;
    if (copy.to.q === copy.from.q && copy.to.r === copy.from.r) {
      copy.goal = null;
      copy.wait = 0.3;
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
