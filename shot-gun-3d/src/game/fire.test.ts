import { describe, expect, it } from 'vitest';
import { FireSystem } from './fire.ts';
import { PhysicsSim } from '../physics/sim.ts';
import { VoxelGrid } from '../voxels/grid.ts';

describe('fogo', () => {
  it('acende madeira, espalha e apaga com água; adobe não queima', async () => {
    const sim = await PhysicsSim.create();
    const grid = new VoxelGrid();
    const wall = grid.fillBox(0, 0, 0, 6, 8, 0, 'plank', 'structure', 0);
    grid.fillBox(10, 0, 0, 12, 4, 0, 'adobe', 'structure', 1);
    sim.rebuild(grid);
    const dead: number[] = [];
    let flames = 0;
    const fire = new FireSystem(grid, sim, { burnOut: (vs) => { dead.push(vs.length); }, setBurning: () => {}, flame: () => { flames += 1; } });
    expect(fire.ignite(grid.get(11, 1, 0)!)).toBe(false);
    expect(fire.ignite(wall[0])).toBe(true);
    for (let i = 0; i < 300; i++) fire.update(1 / 30); // 10 s
    expect(fire.count).toBeGreaterThan(3);
    expect(flames).toBeGreaterThan(0);
    const put = fire.extinguishAround(0, 0.3, 0, 10);
    expect(put).toBe(fire.count + put - fire.count);
    expect(fire.count).toBe(0);
  });

  it('queima até virar cinza', async () => {
    const sim = await PhysicsSim.create();
    const grid = new VoxelGrid();
    const v = grid.add(0, 0, 0, 'hay', 'structure', 0)!;
    sim.rebuild(grid);
    const dead: number[] = [];
    const fire = new FireSystem(grid, sim, { burnOut: (vs) => { dead.push(vs.length); }, setBurning: () => {}, flame: () => {} });
    fire.ignite(v);
    for (let i = 0; i < 300; i++) fire.update(1 / 30);
    expect(dead.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
