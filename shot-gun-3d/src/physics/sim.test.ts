import { describe, expect, it } from 'vitest';
import { PhysicsSim, GROUND_INDEX } from './sim.ts';
import { buildTown, TOWN } from '../voxels/town.ts';
import { VoxelGrid } from '../voxels/grid.ts';
import { groupKind } from '../voxels/types.ts';

describe('física (rapier em node)', () => {
  it('constrói a vila com juntas para portas, correntes e moinho', async () => {
    const sim = await PhysicsSim.create();
    const grid = buildTown();
    const t0 = performance.now();
    sim.rebuild(grid);
    const ms = performance.now() - t0;
    const d = sim.diagnostics();
    console.log('rebuild ms', ms.toFixed(0), JSON.stringify(d));
    const doors = new Set<string>();
    const chains = new Set<string>();
    let spin = 0;
    for (const v of grid.values()) {
      const k = groupKind(v.group);
      if (k === 'door') doors.add(v.group);
      if (k === 'chain') chains.add(v.group);
      if (k === 'spin') spin = 1;
    }
    // cada porta 1 junta; cada corrente ≥ 1 elo + pendurado; moinho 1
    expect(d.joints).toBeGreaterThanOrEqual(doors.size + chains.size + spin);
    expect(d.colliders).toBeLessThan(grid.size / 4);
    expect(ms).toBeLessThan(5000);
  });

  it('remoção incremental mantém o resto e só refaz o corpo atingido', async () => {
    const sim = await PhysicsSim.create();
    const grid = new VoxelGrid();
    // coluna apoiada + bloco solto em cima, separados por uma camada que vamos tirar
    const col = grid.fillBox(0, 0, 0, 0, 5, 0, 'adobe', 'structure', 0);
    grid.fillBox(5, 0, 5, 6, 2, 6, 'wood', 'structure', 1);
    sim.rebuild(grid);
    const before = sim.diagnostics();
    expect(before.dynamic).toBe(0);
    const mid = col[3];
    grid.remove(mid);
    sim.removeVoxels([mid]);
    const after = sim.diagnostics();
    expect(after.dynamic).toBe(1); // topo da coluna virou corpo dinâmico
    expect(after.bindings).toBe(before.bindings + 1);
    sim.step(1 / 30);
    expect(sim.isDynamic(col[5])).toBe(true);
    expect(sim.isDynamic(col[0])).toBe(false);
    expect(GROUND_INDEX).toBeGreaterThanOrEqual(1);
  });

  it('jogador anda, colide com parede e pula', async () => {
    const sim = await PhysicsSim.create();
    const grid = new VoxelGrid();
    grid.fillBox(-5, 0, -12, 5, 25, -12, 'adobe', 'structure', 0); // parede em z = -0.96
    sim.rebuild(grid);
    sim.createPlayer(0, 0.85, 0);
    let grounded = false;
    for (let i = 0; i < 60; i++) {
      const r = sim.movePlayer({ x: 0, y: -0.05, z: -0.05 });
      grounded = r.grounded;
      sim.step(1 / 60);
    }
    const p = sim.playerPosition();
    expect(grounded).toBe(true);
    expect(p.z).toBeGreaterThan(-0.9); // parou na parede (raio 0,3 + parede)
    expect(p.y).toBeGreaterThan(0.7);
  });

  it('a lista TOWN tem ids únicos', () => {
    const ids = TOWN.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
