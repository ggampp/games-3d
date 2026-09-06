import { hexKey, hexNeighbors, parseHexKey, type Hex } from './hex';
import type { ChainDef, Evaluation, Harmony, KingdomModifiers, PlaceFloat, Resources } from './types';

export type TileMap = Map<string, string>;

export const HOME_IDS = ['casa', 'sobrado', 'casa_pedra'] as const;
/** População base de cada moradia (a estrada dobra isso quando liga ao mercado). */
const HOME_POP: Record<string, number> = { casa: 1, sobrado: 2, casa_pedra: 2 };

/** Cadeias de produção que fecham um combo quando ficam completas por vizinhança. */
export const CHAINS: ChainDef[] = [
  { id: 'pao', nome: 'Pão quente', links: [['roca', 'trigo'], ['engenho', 'moinho_vento'], ['padaria']] },
  { id: 'peixe', nome: 'Peixe fresco', links: [['rio', 'lago'], ['cais'], ['pescador']] },
  { id: 'pedra', nome: 'Casa de pedra', links: [['monte'], ['pedreira', 'olaria'], ['casa_pedra']] },
  { id: 'madeira', nome: 'Telhado novo', links: [['mata'], ['serraria'], ['casa', 'sobrado']] },
  { id: 'feira', nome: 'Dia de feira', links: [['casa', 'sobrado', 'casa_pedra'], ['estrada'], ['mercado']] },
];

export function emptyModifiers(): KingdomModifiers {
  return { rain: false, blighted: [] };
}

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

/**
 * Conta quantos tiles do último elo fecham a cadeia inteira: cada elo precisa ser vizinho
 * de um tile do elo anterior, até chegar ao primeiro.
 */
export function completedChains(map: TileMap, links: string[][]): number {
  if (links.length === 0) return 0;
  const reaches = (key: string, link: number): boolean => {
    if (link === 0) return true;
    const wanted = links[link - 1]!;
    for (const neighbor of hexNeighbors(parseHexKey(key))) {
      const id = map.get(hexKey(neighbor));
      if (id && wanted.includes(id) && reaches(hexKey(neighbor), link - 1)) return true;
    }
    return false;
  };
  const last = links[links.length - 1]!;
  let count = 0;
  for (const [key, id] of map) {
    if (last.includes(id) && reaches(key, links.length - 1)) count += 1;
  }
  return count;
}

/** Ids das cadeias completas, repetidos por quantidade (para detectar combos novos). */
export function chainsClosed(map: TileMap): string[] {
  const out: string[] = [];
  for (const chain of CHAINS) {
    const n = completedChains(map, chain.links);
    for (let i = 0; i < n; i += 1) out.push(chain.id);
  }
  return out;
}

export type RoadNetwork = { roads: string[]; homes: string[]; markets: string[] };

/** Redes de estrada (componentes conexos) com as casas e mercados encostados nelas. */
export function roadNetworks(map: TileMap): RoadNetwork[] {
  const seen = new Set<string>();
  const networks: RoadNetwork[] = [];
  for (const [start, id] of map) {
    if (id !== 'estrada' || seen.has(start)) continue;
    const roads: string[] = [];
    const homes = new Set<string>();
    const markets = new Set<string>();
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const current = stack.pop()!;
      roads.push(current);
      for (const neighbor of hexNeighbors(parseHexKey(current))) {
        const key = hexKey(neighbor);
        const other = map.get(key);
        if (!other) continue;
        if (other === 'estrada' && !seen.has(key)) {
          seen.add(key);
          stack.push(key);
        } else if ((HOME_IDS as readonly string[]).includes(other)) homes.add(key);
        else if (other === 'mercado') markets.add(key);
      }
    }
    networks.push({ roads, homes: [...homes], markets: [...markets] });
  }
  return networks;
}

/** Maior número de casas ligadas por estrada a um mercado. */
export function roadHomesLinked(map: TileMap): number {
  let best = 0;
  for (const net of roadNetworks(map)) {
    if (net.markets.length > 0) best = Math.max(best, net.homes.length);
  }
  return best;
}

/** Roças com praga que ainda não têm horta vizinha (as outras já se curaram). */
export function activeBlight(map: TileMap, blighted: readonly string[]): Set<string> {
  const active = new Set<string>();
  for (const key of blighted) {
    if (map.get(key) !== 'roca') continue;
    if (countNeighbor(map, parseHexKey(key), 'horta') > 0) continue;
    active.add(key);
  }
  return active;
}

export function evaluateKingdom(map: TileMap, modifiers: KingdomModifiers = emptyModifiers()): Evaluation {
  const harmony = emptyHarmony();
  const resources = emptyResources();
  const blight = activeBlight(map, modifiers.blighted);
  /** Roças e trigais que rendem grão (roça com praga não conta). */
  const grainAround = (hex: Hex): number =>
    hexNeighbors(hex).filter((n) => {
      const id = map.get(hexKey(n));
      return id === 'trigo' || (id === 'roca' && !blight.has(hexKey(n)));
    }).length;

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
        harmony.agua += modifiers.rain ? 2 : 1;
        break;
      case 'lago':
        harmony.agua += 2;
        break;
      case 'monte':
        harmony.natureza += 1;
        break;
      case 'roca':
        if (!blight.has(key)) harmony.natureza += 1;
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
        const grain = grainAround(hex);
        const rios = countNeighbor(map, hex, 'rio');
        resources.farinha += grain + rios;
        harmony.povo += grain > 0 ? 1 : 0;
        harmony.agua += rios;
        break;
      }
      case 'moinho_vento': {
        const grain = grainAround(hex);
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
      case 'pantano': {
        // Água parada: rende Água, mas a bruma tira 1 de Natureza de cada vizinho
        // (menos dos outros pântanos) até um junco encostar nele.
        harmony.agua += 1;
        if (countNeighbor(map, hex, 'junco') === 0) {
          harmony.natureza -= neighborIds(map, hex).filter((id) => id !== 'pantano' && id !== 'junco').length;
        }
        break;
      }
      case 'junco': {
        harmony.natureza += 1;
        harmony.agua += countNeighborAny(map, hex, ['pantano', 'rio', 'lago']);
        break;
      }
      case 'estrada': {
        harmony.povo += countNeighborAny(map, hex, [...HOME_IDS]) > 0 ? 1 : 0;
        break;
      }
      default:
        break;
    }
  }

  // Estrada: uma rede que liga pelo menos 2 casas a um mercado dobra a população dessas casas.
  for (const net of roadNetworks(map)) {
    if (net.markets.length === 0 || net.homes.length < 2) continue;
    for (const home of net.homes) resources.populacao += HOME_POP[map.get(home) ?? ''] ?? 0;
  }

  resources.populacao += Math.floor(resources.pao / 2);
  harmony.natureza = Math.max(0, harmony.natureza);
  harmony.povo = Math.max(0, harmony.povo);
  harmony.agua = Math.max(0, harmony.agua);

  return { harmony, resources };
}

export function placementFloats(
  map: TileMap,
  hex: Hex,
  tileId: string,
  modifiers: KingdomModifiers = emptyModifiers(),
): PlaceFloat[] {
  const before = evaluateKingdom(map, modifiers);
  const next = new Map(map);
  next.set(hexKey(hex), tileId);
  const after = evaluateKingdom(next, modifiers);
  return harmonyFloats(before, after);
}

/** Diferença entre duas avaliações, como rótulos flutuantes. */
export function harmonyFloats(before: Evaluation, after: Evaluation): PlaceFloat[] {
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
