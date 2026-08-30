import { describe, expect, it } from 'vitest';
import { HEX_SIZE, hexDistance, hexKey, hexNeighbors, hexRound, hexToWorld, worldToHex } from '../../src/game/hex';

describe('hex axial', () => {
  it('tem seis vizinhos', () => {
    expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6);
  });

  it('chave é estável', () => {
    expect(hexKey({ q: -2, r: 3 })).toBe('-2,3');
  });

  it('distância axial', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
  });

  it('mundo e hex redondam de volta', () => {
    const origin = { q: 3, r: -2 };
    const world = hexToWorld(origin);
    const back = worldToHex(world.x, world.z);
    expect(back).toEqual(origin);
  });

  it('vizinho +q fica a uma largura de hex (faces coladas)', () => {
    const a = hexToWorld({ q: 0, r: 0 });
    const b = hexToWorld({ q: 1, r: 0 });
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    expect(dist).toBeCloseTo(Math.sqrt(3) * HEX_SIZE, 6);
  });

  it('arredonda cube coords', () => {
    expect(hexRound(0.2, -0.1)).toEqual({ q: 0, r: 0 });
  });
});
