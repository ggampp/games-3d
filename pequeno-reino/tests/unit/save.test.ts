import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSave, loadSave, SAVE_KEY, totalStars, writeSave } from '../../src/save';

// localStorage mínimo em memória (sem jsdom)
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

describe('save v2', () => {
  beforeEach(() => {
    store.clear();
  });

  it('sem nada salvo devolve o padrão', () => {
    const save = loadSave();
    expect(save.version).toBe(2);
    expect(save.maxUnlockedPhase).toBe(1);
    expect(save.unlockedTiles).toContain('clareira');
    expect(save.session).toBeNull();
  });

  it('migra um save v1: mantém progresso, dá 1 estrela por fase feita e descarta sessão velha', () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        maxUnlockedPhase: 3,
        completedPhases: [1, 2],
        unlockedTiles: ['clareira', 'engenho'],
        discoveredTiles: ['clareira', 'casa'],
        options: { music: false, reduceParticles: true },
        session: { phaseId: 2, map: [['0,0', 'clareira']], hand: [], deck: [], discard: [], selectedHandIndex: 0, turns: 0, status: 'playing', rngState: 1, spentPao: 0 },
      }),
    );
    const save = loadSave();
    expect(save.version).toBe(2);
    expect(save.maxUnlockedPhase).toBe(3);
    expect(save.stars).toEqual({ '1': 1, '2': 1 });
    expect(save.session).toBeNull();
    expect(save.options.music).toBe(false);
    expect(save.options.reduceParticles).toBe(true);
    expect(save.options.musicVolume).toBe(0.6);
    expect(save.unlockedTiles).toContain('rio');
    expect(totalStars(save)).toBe(2);
  });

  it('save corrompido volta ao padrão', () => {
    localStorage.setItem(SAVE_KEY, '{nope');
    expect(loadSave()).toEqual(defaultSave());
  });

  it('escreve e lê de volta', () => {
    const save = defaultSave();
    save.stars['1'] = 3;
    writeSave(save);
    expect(loadSave().stars['1']).toBe(3);
  });
});
