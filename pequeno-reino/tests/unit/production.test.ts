import { describe, expect, it } from 'vitest';
import { canPlace, validPlacements } from '../../src/game/placement';
import { evaluateKingdom, largestConnected } from '../../src/game/production';
import { questProgress } from '../../src/game/quests';
import { Session } from '../../src/game/session';

describe('produção e harmonia', () => {
  it('engenho soma farinha por roça vizinha', () => {
    const map = new Map([
      ['0,0', 'engenho'],
      ['1,0', 'roca'],
      ['0,-1', 'roca'],
    ]);
    const { resources, harmony } = evaluateKingdom(map);
    expect(resources.farinha).toBe(2);
    expect(harmony.povo).toBeGreaterThan(0);
  });

  it('cabana do mateiro pontua mata adjacente', () => {
    const map = new Map([
      ['0,0', 'cabana_mateiro'],
      ['1,0', 'mata'],
      ['0,1', 'mata'],
      ['-1,1', 'mata'],
    ]);
    expect(evaluateKingdom(map).harmony.natureza).toBe(2 * 3 + 3);
  });

  it('moinho de vento mói trigo vizinho', () => {
    const map = new Map([
      ['0,0', 'moinho_vento'],
      ['1,0', 'trigo'],
    ]);
    const { resources, harmony } = evaluateKingdom(map);
    expect(resources.farinha).toBe(2);
    expect(harmony.povo).toBeGreaterThan(0);
    expect(harmony.natureza).toBe(1);
  });

  it('cais e rio aumentam água', () => {
    const map = new Map([
      ['0,0', 'cais'],
      ['1,0', 'rio'],
      ['2,-1', 'rio'],
    ]);
    const { harmony, resources } = evaluateKingdom(map);
    expect(resources.peixe).toBe(1);
    expect(harmony.agua).toBe(2 + 1 + 1);
  });

  it('rio contínuo mede componente', () => {
    const map = new Map([
      ['0,0', 'rio'],
      ['1,0', 'rio'],
      ['2,0', 'rio'],
      ['3,0', 'rio'],
      ['0,2', 'rio'],
    ]);
    expect(largestConnected(map, 'rio')).toBe(4);
  });
});

describe('colocação e sessão', () => {
  it('só deixa posar em vizinho vazio', () => {
    const map = new Map([['0,0', 'clareira']]);
    expect(validPlacements(map).length).toBe(6);
    expect(canPlace(map, { q: 1, r: 0 })).toBe(true);
    expect(canPlace(map, { q: 3, r: 0 })).toBe(false);
  });

  it('missões da clareira começam incompletas', () => {
    const session = new Session(1, 1);
    const progress = questProgress(['p1-rocas', 'p1-casas'], session.map, session.evaluation);
    expect(progress.every((quest) => !quest.done)).toBe(true);
    expect(session.hand.length).toBe(3);
    expect(session.map.get('0,0')).toBe('clareira');
  });

  it('posar carta reduz a mão e recarrega', () => {
    const session = new Session(1, 42);
    const before = session.hand.length;
    const spot = validPlacements(session.map)[0]!;
    session.selectHand(0);
    const result = session.place(spot);
    expect(result.ok).toBe(true);
    expect(session.hand.length).toBe(before);
    expect(session.map.size).toBe(2);
  });
});
