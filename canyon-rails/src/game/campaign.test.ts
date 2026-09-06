import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_KEY, emptyCampaign, isUnlocked, mapStatuses, nextMapId,
  readCampaign, recordCompletion, starsFor, totalStars, writeCampaign,
} from './campaign.ts';
import { WORLD_MAPS } from '../world/maps.ts';

const PAR = { time: 600, coins: 5000 };

function fakeStorage(): Map<string, string> & Pick<Storage, 'getItem' | 'setItem'> {
  const store = new Map<string, string>() as Map<string, string> & Pick<Storage, 'getItem' | 'setItem'>;
  store.getItem = (key: string) => store.get(key) ?? null;
  store.setItem = (key: string, value: string) => { store.set(key, value); };
  return store;
}

describe('campanha', () => {
  it('estrelas: 1 por concluir, +1 por tempo, +1 por moedas', () => {
    expect(starsFor(900, 100, PAR)).toBe(1);
    expect(starsFor(500, 100, PAR)).toBe(2);
    expect(starsFor(900, 6000, PAR)).toBe(2);
    expect(starsFor(500, 6000, PAR)).toBe(3);
  });

  it('só o primeiro mapa começa aberto; concluir abre o seguinte', () => {
    const data = emptyCampaign();
    const before = mapStatuses(data, WORLD_MAPS);
    expect(before.get(WORLD_MAPS[0]!.id)?.unlocked).toBe(true);
    expect(before.get(WORLD_MAPS[1]!.id)?.unlocked).toBe(false);
    expect(before.get(WORLD_MAPS[2]!.id)?.unlocked).toBe(false);

    recordCompletion(data, WORLD_MAPS[0]!.id, 700, 100, PAR, 1);
    const after = mapStatuses(data, WORLD_MAPS);
    expect(after.get(WORLD_MAPS[0]!.id)?.completed).toBe(true);
    expect(after.get(WORLD_MAPS[0]!.id)?.stars).toBe(1);
    expect(after.get(WORLD_MAPS[1]!.id)?.unlocked).toBe(true);
    expect(after.get(WORLD_MAPS[2]!.id)?.unlocked).toBe(false);
    expect(isUnlocked(data, WORLD_MAPS, WORLD_MAPS[1]!.id)).toBe(true);
  });

  it('guarda sempre o melhor resultado', () => {
    const data = emptyCampaign();
    const first = recordCompletion(data, 'm', 700, 100, PAR, 1);
    expect(first).toEqual({ stars: 1, improved: true, firstTime: true });
    const worse = recordCompletion(data, 'm', 800, 100, PAR, 2);
    expect(worse.improved).toBe(false);
    expect(data.maps.m.bestTime).toBe(700);
    const better = recordCompletion(data, 'm', 500, 6000, PAR, 3);
    expect(better).toEqual({ stars: 3, improved: true, firstTime: false });
    expect(totalStars(data)).toBe(3);
  });

  it('persiste e relê, descartando lixo', () => {
    const storage = fakeStorage();
    const data = emptyCampaign();
    recordCompletion(data, 'a', 100, 9000, PAR, 5);
    expect(writeCampaign(data, storage)).toBe(true);
    const loaded = readCampaign(storage);
    expect(loaded.maps.a.stars).toBe(3);
    expect(loaded.maps.a.bestTime).toBe(100);

    storage.set(CAMPAIGN_KEY, '{nope');
    expect(readCampaign(storage).maps).toEqual({});
    storage.set(CAMPAIGN_KEY, JSON.stringify({ version: 1, maps: { x: { stars: 'muitas' }, y: 3, z: { stars: 9 } } }));
    const cleaned = readCampaign(storage);
    expect(cleaned.maps.x).toBeUndefined();
    expect(cleaned.maps.y).toBeUndefined();
    expect(cleaned.maps.z.stars).toBe(3);
  });

  it('sabe qual é o próximo mapa', () => {
    expect(nextMapId(WORLD_MAPS, WORLD_MAPS[0]!.id)).toBe(WORLD_MAPS[1]!.id);
    expect(nextMapId(WORLD_MAPS, WORLD_MAPS[WORLD_MAPS.length - 1]!.id)).toBeNull();
    expect(nextMapId(WORLD_MAPS, 'inexistente')).toBeNull();
  });
});
