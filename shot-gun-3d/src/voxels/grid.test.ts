import { describe, expect, it } from 'vitest';
import { VoxelGrid } from './grid.ts';
import { connectedComponents, damageAt, greedyBoxes, isSupported, voxelRaycast, voxelRaycastWorld } from './connectivity.ts';
import { VOXEL_SIZE, groupKind, groupId, voxelKey } from './types.ts';
import { buildTown, TOWN, hollow } from './town.ts';
import { Builder } from './builder.ts';
import { textRows } from './font.ts';

describe('grade', () => {
  it('chave inteira é única no domínio', () => {
    const seen = new Set<number>();
    for (let x = -30; x <= 30; x += 7) {
      for (let y = 0; y <= 60; y += 9) {
        for (let z = -30; z <= 30; z += 11) {
          const k = voxelKey(x, y, z);
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
    }
  });

  it('generation muda em add/remove', () => {
    const g = new VoxelGrid();
    const v = g.add(0, 0, 0, 'wood', 'structure')!;
    const g1 = g.generation;
    g.remove(v);
    expect(g.generation).toBeGreaterThan(g1);
  });

  it('grupos por prefixo', () => {
    expect(groupKind('structure')).toBe('structure');
    expect(groupKind('door:saloon-l')).toBe('door');
    expect(groupId('chain:bell')).toBe('bell');
  });
});

describe('conectividade', () => {
  it('um bloco sozinho é um componente', () => {
    const g = new VoxelGrid();
    g.add(0, 2, 0, 'adobe', 'structure');
    expect(connectedComponents(g)).toHaveLength(1);
  });

  it('vizinhos ortogonais da estrutura ficam no mesmo componente', () => {
    const g = new VoxelGrid();
    g.add(0, 2, 0, 'adobe', 'structure');
    g.add(1, 2, 0, 'adobe', 'structure');
    g.add(1, 3, 0, 'wood', 'structure');
    expect(connectedComponents(g)).toHaveLength(1);
  });

  it('porta não se funde com a estrutura (junta, não contato)', () => {
    const g = new VoxelGrid();
    g.add(0, 2, 0, 'adobe', 'structure');
    g.add(1, 2, 0, 'plank', 'door:x');
    expect(connectedComponents(g)).toHaveLength(2);
  });

  it('remover o meio parte a coluna em dois', () => {
    const g = new VoxelGrid();
    const a = g.add(0, 2, 0, 'adobe', 'structure')!;
    const b = g.add(0, 3, 0, 'adobe', 'structure')!;
    const c = g.add(0, 4, 0, 'adobe', 'structure')!;
    g.remove(b);
    const comps = connectedComponents(g);
    expect(comps).toHaveLength(2);
    const ids = comps.map((comp) => comp.map((v) => v.id).sort().join(','));
    expect(ids).toContain(String(a.id));
    expect(ids).toContain(String(c.id));
  });

  it('componentes restritos a um subconjunto', () => {
    const g = new VoxelGrid();
    const a = g.add(0, 0, 0, 'wood', 'structure')!;
    g.add(1, 0, 0, 'wood', 'structure');
    g.add(5, 0, 0, 'wood', 'structure');
    expect(connectedComponents(g, [a])).toHaveLength(1);
    expect(connectedComponents(g, [a])[0]).toHaveLength(2);
  });

  it('suporte depende do índice de chão informado', () => {
    const g = new VoxelGrid();
    const comp = [g.add(0, 3, 0, 'wood', 'structure')!, g.add(0, 4, 0, 'wood', 'structure')!];
    expect(isSupported(comp, 2)).toBe(false);
    expect(isSupported(comp, 3)).toBe(true);
  });
});

describe('dano', () => {
  it('atinge só a vizinhança do impacto e o direto sempre', () => {
    const g = new VoxelGrid();
    const direct = g.add(0, 0, 0, 'plank', 'structure')!;
    const near = g.add(1, 0, 0, 'plank', 'structure')!;
    const far = g.add(40, 0, 0, 'plank', 'structure')!;
    const hpFar = far.hp;
    const destroyed = damageAt(g, 0, VOXEL_SIZE / 2, 0, VOXEL_SIZE * 1.2, 100, VOXEL_SIZE, direct);
    expect(destroyed).toContain(direct);
    expect(destroyed).toContain(near);
    expect(far.hp).toBe(hpFar);
  });

  it('dano cai com a distância', () => {
    const g = new VoxelGrid();
    const a = g.add(1, 0, 0, 'adobe', 'structure')!;
    const b = g.add(3, 0, 0, 'adobe', 'structure')!;
    damageAt(g, 0, VOXEL_SIZE / 2, 0, VOXEL_SIZE * 4, 5, VOXEL_SIZE);
    expect(a.hp).toBeLessThan(b.hp);
  });

  it('voxels de corpos que se mexeram são medidos na pose visual', () => {
    const g = new VoxelGrid();
    const v = g.add(50, 0, 0, 'plank', 'structure')!;
    const poseOf = (x: typeof v) => (x === v ? { x: 0, y: VOXEL_SIZE / 2, z: 0 } : null);
    const destroyed = damageAt(g, 0, VOXEL_SIZE / 2, 0, VOXEL_SIZE, 100, VOXEL_SIZE, undefined, [v], poseOf);
    expect(destroyed).toContain(v);
  });
});

describe('raycast', () => {
  it('DDA acha o primeiro voxel na direção', () => {
    const g = new VoxelGrid();
    g.add(0, 0, -10, 'plank', 'structure');
    const hit = voxelRaycast(g, { x: 0, y: VOXEL_SIZE / 2, z: 0 }, { x: 0, y: 0, z: -1 }, 10, VOXEL_SIZE);
    expect(hit?.voxel.iz).toBe(-10);
  });

  it('DDA respeita o filtro accept', () => {
    const g = new VoxelGrid();
    const a = g.add(0, 0, -5, 'plank', 'structure')!;
    g.add(0, 0, -10, 'plank', 'structure');
    const hit = voxelRaycast(g, { x: 0, y: VOXEL_SIZE / 2, z: 0 }, { x: 0, y: 0, z: -1 }, 10, VOXEL_SIZE, (v) => v !== a);
    expect(hit?.voxel.iz).toBe(-10);
  });

  it('raycast de mundo usa a pose dada', () => {
    const g = new VoxelGrid();
    const v = g.add(0, 0, -10, 'plank', 'door:x')!;
    const hit = voxelRaycastWorld([v], { x: 0, y: VOXEL_SIZE / 2, z: 0 }, { x: 0, y: 0, z: -1 }, 10, VOXEL_SIZE, () => ({ x: 0, y: VOXEL_SIZE / 2, z: -0.5 }));
    expect(hit?.voxel).toBe(v);
    expect(hit!.dist).toBeLessThan(0.5);
  });
});

describe('greedy boxes', () => {
  it('funde uma parede cheia numa caixa só', () => {
    const g = new VoxelGrid();
    const vox = g.fillBox(0, 0, 0, 9, 4, 0, 'adobe', 'structure');
    expect(greedyBoxes(vox)).toHaveLength(1);
  });

  it('cobre todos os voxels sem sobrepor', () => {
    const g = new VoxelGrid();
    const vox = g.fillBox(0, 0, 0, 5, 5, 5, 'adobe', 'structure');
    const hole = g.get(2, 2, 2)!;
    g.remove(hole);
    const list = vox.filter((v) => v !== hole);
    const boxes = greedyBoxes(list);
    let cells = 0;
    for (const b of boxes) cells += (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) * (b.z1 - b.z0 + 1);
    expect(cells).toBe(list.length);
  });
});

describe('builder e vila', () => {
  it('box em metros grava ao menos um voxel e respeita rotação', () => {
    const g = new VoxelGrid();
    const b = new Builder(g, 0, 0, 0, 0, 1);
    b.box(1, 0, 0, 1, 0, 0, 'wood');
    expect(g.size).toBe(1);
    const v = [...g.values()][0];
    expect(v.ix).toBe(0);
    expect(v.iz).toBe(Math.round(1 / VOXEL_SIZE));
  });

  it('fonte gera 5 linhas', () => {
    const rows = textRows('SA');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveLength(7);
  });

  it('a vila constrói com todas as estruturas e tamanho razoável', () => {
    const g = buildTown();
    const present = new Set<number>();
    for (const v of g.values()) present.add(v.s);
    for (let i = 0; i < TOWN.length; i++) expect(present.has(i)).toBe(true);
    expect(g.size).toBeGreaterThan(10000);
    expect(g.size).toBeLessThan(90000);
  });

  it('cada estrutura pontuável tem um componente apoiado no chão', () => {
    const g = buildTown();
    const groundIndex = Math.round(0.18 / VOXEL_SIZE);
    for (let i = 0; i < TOWN.length; i++) {
      if (!TOWN[i].scored) continue;
      const mine = [...g.values()].filter((v) => v.s === i && v.group === 'structure');
      const comps = connectedComponents(g, mine);
      expect(comps.some((c) => isSupported(c, groundIndex)), TOWN[i].id).toBe(true);
    }
  });

  it('portas têm dobradiça encostada em estrutura', () => {
    const g = buildTown();
    const hinges = [...g.values()].filter((v) => v.mat === 'hinge');
    expect(hinges.length).toBeGreaterThan(0);
    const doorsWithNeighbor = new Set<string>();
    for (const h of hinges) {
      if (g.neighbors(h).some((n) => n.group === 'structure')) doorsWithNeighbor.add(h.group);
    }
    const doorGroups = new Set(hinges.map((h) => h.group));
    expect([...doorGroups].filter((d) => !doorsWithNeighbor.has(d))).toEqual([]);
  });

  it('correntes têm estrutura acima do primeiro elo', () => {
    const g = buildTown();
    const chains = new Map<string, number>();
    for (const v of g.values()) {
      if (groupKind(v.group) !== 'chain') continue;
      chains.set(v.group, Math.max(chains.get(v.group) ?? -Infinity, v.iy));
    }
    const bad: string[] = [];
    for (const [group, top] of chains) {
      const any = [...g.values()].find((v) => v.group === group && v.iy === top)!;
      let ok = false;
      for (let dy = 1; dy <= 6; dy++) {
        const n = g.get(any.ix, any.iy + dy, any.iz);
        if (n && n.group === 'structure') { ok = true; break; }
      }
      if (!ok) bad.push(group);
    }
    expect(bad).toEqual([]);
  });

  it('hollow remove só voxels cercados', () => {
    const g = new VoxelGrid();
    g.fillBox(0, 0, 0, 2, 2, 2, 'adobe', 'structure');
    expect(hollow(g)).toBe(1);
    expect(g.size).toBe(26);
  });
});
