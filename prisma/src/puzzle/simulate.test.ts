import { describe, expect, it } from 'vitest';
import { BLUE, RED, YELLOW, mixAll, recipeOf } from './colors.ts';
import { DOWN, LEFT, RIGHT, UP, indexOf, perpendiculars, reflect } from './grid.ts';
import type { Cell, Mirror, Placements, Puzzle } from './grid.ts';
import { isSolved, simulate } from './simulate.ts';

/**
 * Tabuleiro em texto: `#` parede, `v > < ^` emissores (vermelho, amarelo,
 * azul, azul), `a`/`b` alvos, `P` prisma, `r`/`y`/`u` filtros que só deixam
 * passar vermelho / amarelo / azul.
 */
function board(rows: string[], want: Record<string, number> = {}): Puzzle {
  const height = rows.length;
  const width = rows[0].length;
  const cells: Cell[] = [];
  for (const row of rows) {
    for (const ch of row) {
      switch (ch) {
        case '#': cells.push({ kind: 'wall' }); break;
        case 'v': cells.push({ kind: 'emitter', color: RED, dir: DOWN }); break;
        case '>': cells.push({ kind: 'emitter', color: YELLOW, dir: RIGHT }); break;
        case '<': cells.push({ kind: 'emitter', color: BLUE, dir: LEFT }); break;
        case '^': cells.push({ kind: 'emitter', color: BLUE, dir: UP }); break;
        case 'a': cells.push({ kind: 'target', want: want.a ?? RED }); break;
        case 'b': cells.push({ kind: 'target', want: want.b ?? YELLOW }); break;
        case 'P': cells.push({ kind: 'prism' }); break;
        case 'r': cells.push({ kind: 'filter', pass: RED }); break;
        case 'y': cells.push({ kind: 'filter', pass: YELLOW }); break;
        case 'u': cells.push({ kind: 'filter', pass: BLUE }); break;
        default: cells.push({ kind: 'empty' });
      }
    }
  }
  return {
    width, height, cells, mirrorBudget: 9, par: 9,
    solution: new Map(), seed: 1, difficulty: 'teste',
  };
}

function placements(puzzle: Puzzle, entries: [number, number, Mirror][]): Placements {
  const map: Placements = new Map();
  for (const [x, y, mirror] of entries) map.set(indexOf(puzzle, x, y), mirror);
  return map;
}

describe('cores', () => {
  it('mistura as primárias de forma aditiva', () => {
    expect(mixAll([RED, YELLOW])).toBe(3);
    expect(mixAll([RED, BLUE])).toBe(5);
    expect(mixAll([YELLOW, BLUE])).toBe(6);
    expect(mixAll([RED, YELLOW, BLUE])).toBe(7);
    expect(mixAll([RED, RED])).toBe(RED);
  });

  it('descreve a receita da cor', () => {
    expect(recipeOf(RED)).toBe('vermelho');
    expect(recipeOf(5)).toBe('vermelho + azul');
    expect(recipeOf(7)).toBe('vermelho + amarelo + azul');
  });
});

describe('espelhos', () => {
  it('"/" e "\\" refletem 90° para lados opostos', () => {
    expect(reflect(RIGHT, 'slash')).toBe(UP);
    expect(reflect(RIGHT, 'backslash')).toBe(DOWN);
    expect(reflect(DOWN, 'slash')).toBe(LEFT);
    expect(reflect(DOWN, 'backslash')).toBe(RIGHT);
  });

  it('refletir duas vezes volta à direção original', () => {
    for (const mirror of ['slash', 'backslash'] as Mirror[]) {
      for (const dir of [UP, RIGHT, DOWN, LEFT] as const) {
        const there = reflect(dir, mirror);
        expect(reflect(there, mirror)).toBe(dir);
      }
    }
  });
});

describe('propagação da luz', () => {
  it('segue reta e acende o alvo da cor certa', () => {
    const puzzle = board([
      '>...a',
      '.....',
    ]);
    const sim = simulate(puzzle, new Map());
    expect(sim.lit.size).toBe(0); // o alvo pede vermelho, chegou amarelo
    expect(sim.wrong.size).toBe(1);

    const yellowTarget = board(['>...b', '.....']);
    const sim2 = simulate(yellowTarget, new Map());
    expect(sim2.lit.size).toBe(1);
    expect(isSolved(yellowTarget, sim2)).toBe(true);
  });

  it('a parede bloqueia o feixe', () => {
    const puzzle = board(['>.#.b']);
    const sim = simulate(puzzle, new Map());
    expect(sim.lit.size).toBe(0);
    expect(sim.atCell[indexOf(puzzle, 4, 0)]).toBe(0);
  });

  it('o espelho desvia o feixe até o alvo', () => {
    const puzzle = board([
      '>....',
      '.....',
      '..b..',
    ]);
    // "\" na coluna 2 manda o feixe que vai para a direita para baixo.
    const sim = simulate(puzzle, placements(puzzle, [[2, 0, 'backslash']]));
    expect(sim.lit.size).toBe(1);
  });

  it('feixes que se cruzam seguem misturados', () => {
    // Amarelo indo para a direita cruza com vermelho indo para baixo.
    const puzzle = board([
      '..v..',
      '>...a',
      '..b..',
    ], { a: 3, b: 3 });
    const sim = simulate(puzzle, new Map());
    const crossing = indexOf(puzzle, 2, 1);
    expect(sim.atCell[crossing]).toBe(3);
    // Depois do cruzamento, os dois ramos carregam laranja.
    expect(sim.lit.size).toBe(2);
  });

  it('a mistura não vaza para trás do cruzamento', () => {
    const puzzle = board([
      '..v..',
      '>...a',
      '.....',
    ], { a: 3 });
    const sim = simulate(puzzle, new Map());
    // Antes do cruzamento o feixe amarelo continua amarelo.
    expect(sim.atCell[indexOf(puzzle, 1, 1)]).toBe(YELLOW);
    expect(sim.atCell[indexOf(puzzle, 2, 0)]).toBe(RED);
  });

  it('um caminho longo de espelhos leva a luz até o canto oposto', () => {
    const puzzle = board([
      '>....',
      '.....',
      '....b',
    ]);
    // Zigue-zague: direita → baixo → direita → baixo.
    const path = placements(puzzle, [
      [2, 0, 'backslash'], [2, 1, 'backslash'],
      [4, 1, 'backslash'],
    ]);
    const sim = simulate(puzzle, path);
    expect(sim.lit.size).toBe(1);
  });

  it('termina e é estável mesmo com o tabuleiro cheio de espelhos', () => {
    const puzzle = board([
      '>....',
      '.....',
      '<....',
      '.....',
    ]);
    for (let seed = 1; seed <= 40; seed++) {
      let a = seed;
      const random = (): number => {
        a = (a * 1664525 + 1013904223) >>> 0;
        return a / 4294967296;
      };
      const dense: Placements = new Map();
      puzzle.cells.forEach((cell, index) => {
        if (cell.kind === 'empty' && random() < 0.75) {
          dense.set(index, random() < 0.5 ? 'slash' : 'backslash');
        }
      });
      // Roda duas vezes: o ponto fixo tem de dar exatamente o mesmo resultado.
      const first = simulate(puzzle, dense);
      const second = simulate(puzzle, dense);
      expect([...second.atCell]).toEqual([...first.atCell]);
    }
  });

  it('emissores e alvos absorvem a luz que chega', () => {
    const puzzle = board(['>..b..a']);
    const sim = simulate(puzzle, new Map());
    // O alvo amarelo em x=3 absorve: nada chega ao alvo seguinte.
    expect(sim.atCell[indexOf(puzzle, 6, 0)]).toBe(0);
    expect(sim.lit.size).toBe(1);
  });

  it('registra a distância de chegada ao emissor (para animar o avanço)', () => {
    const puzzle = board(['>....']);
    const sim = simulate(puzzle, new Map());
    expect(sim.arrival[indexOf(puzzle, 1, 0) * 4 + RIGHT]).toBe(1);
    expect(sim.arrival[indexOf(puzzle, 4, 0) * 4 + RIGHT]).toBe(4);
    expect(sim.arrival[indexOf(puzzle, 4, 0) * 4 + LEFT]).toBe(0);
  });
});

describe('prisma divisor', () => {
  it('as perpendiculares de cada direção são os dois lados', () => {
    expect(perpendiculars(RIGHT).sort()).toEqual([UP, DOWN].sort());
    expect(perpendiculars(DOWN).sort()).toEqual([LEFT, RIGHT].sort());
  });

  it('divide o feixe em duas perpendiculares e não deixa nada seguir reto', () => {
    const puzzle = board([
      '..b..',
      '>.P.b',
      '..b..',
    ]);
    const sim = simulate(puzzle, new Map());
    const prism = indexOf(puzzle, 2, 1);
    expect(sim.atCell[prism]).toBe(YELLOW);
    expect(sim.outgoing[prism * 4 + UP]).toBe(YELLOW);
    expect(sim.outgoing[prism * 4 + DOWN]).toBe(YELLOW);
    expect(sim.outgoing[prism * 4 + RIGHT]).toBe(0);
    // Acendem os alvos de cima e de baixo; o da frente fica no escuro.
    expect(sim.lit.has(indexOf(puzzle, 2, 0))).toBe(true);
    expect(sim.lit.has(indexOf(puzzle, 2, 2))).toBe(true);
    expect(sim.atCell[indexOf(puzzle, 4, 1)]).toBe(0);
  });

  it('dois feixes que entram no prisma saem misturados nos dois ramos', () => {
    // Amarelo pela esquerda e vermelho por cima: o prisma devolve laranja
    // para os lados e para cima/baixo, onde há alvos laranja.
    const puzzle = board([
      '..v..',
      '>.P.a',
      '..b..',
    ], { a: 3, b: 3 });
    const sim = simulate(puzzle, new Map());
    expect(sim.atCell[indexOf(puzzle, 2, 1)]).toBe(3);
    expect(sim.lit.size).toBe(2);
  });

  it('não é possível pôr espelho num prisma', () => {
    const puzzle = board(['>.P.b']);
    // Um espelho "no" prisma é ignorado pela simulação (isPlaceable já o veta na UI).
    const sim = simulate(puzzle, placements(puzzle, [[2, 0, 'backslash']]));
    expect(sim.outgoing[indexOf(puzzle, 2, 0) * 4 + DOWN]).toBe(YELLOW);
    expect(sim.outgoing[indexOf(puzzle, 2, 0) * 4 + UP]).toBe(YELLOW);
    expect(sim.lit.size).toBe(0);
  });

  it('converge com prismas em laço (as máscaras só crescem)', () => {
    // Dois prismas que trocam luz entre si num quadrado de espelhos.
    const puzzle = board([
      '>P..P',
      '.....',
      '.P..P',
    ]);
    const loop = placements(puzzle, [[2, 1, 'slash'], [3, 1, 'backslash']]);
    const first = simulate(puzzle, loop);
    const second = simulate(puzzle, loop);
    expect([...second.atCell]).toEqual([...first.atCell]);
    expect(first.atCell[indexOf(puzzle, 1, 0)]).toBe(YELLOW);
  });
});

describe('filtro de cor', () => {
  it('deixa passar só a primária dele e absorve o resto', () => {
    const yes = board(['>.y.b']);
    expect(simulate(yes, new Map()).lit.size).toBe(1);

    const no = board(['>.r.b']);
    const sim = simulate(no, new Map());
    expect(sim.lit.size).toBe(0);
    expect(sim.atCell[indexOf(no, 2, 0)]).toBe(0);
    expect(sim.atCell[indexOf(no, 4, 0)]).toBe(0);
    // A meia-hasta de entrada ainda registra o amarelo que bateu no filtro.
    expect(sim.incoming[indexOf(no, 2, 0) * 4 + RIGHT]).toBe(YELLOW);
  });

  it('separa uma mistura: laranja vira vermelho depois do filtro vermelho', () => {
    const puzzle = board([
      '..v....',
      '>...r.a',
      '.......',
    ]);
    const sim = simulate(puzzle, new Map());
    expect(sim.atCell[indexOf(puzzle, 3, 1)]).toBe(3);
    expect(sim.atCell[indexOf(puzzle, 4, 1)]).toBe(RED);
    expect(sim.lit.has(indexOf(puzzle, 6, 1))).toBe(true);
  });

  it('o filtro não reflete: a luz segue na mesma direção', () => {
    const puzzle = board([
      '..b..',
      '>.y.b',
    ]);
    const sim = simulate(puzzle, new Map());
    expect(sim.lit.has(indexOf(puzzle, 4, 1))).toBe(true);
    expect(sim.atCell[indexOf(puzzle, 2, 0)]).toBe(0);
  });

  it('é estável com filtros e prismas espalhados num tabuleiro denso', () => {
    const puzzle = board([
      '>.y.P.',
      '..P.r.',
      '<.u...',
      '..P..a',
    ]);
    for (let seed = 1; seed <= 30; seed++) {
      let a = seed;
      const random = (): number => {
        a = (a * 1664525 + 1013904223) >>> 0;
        return a / 4294967296;
      };
      const dense: Placements = new Map();
      puzzle.cells.forEach((cell, index) => {
        if (cell.kind === 'empty' && random() < 0.6) {
          dense.set(index, random() < 0.5 ? 'slash' : 'backslash');
        }
      });
      const first = simulate(puzzle, dense);
      const second = simulate(puzzle, dense);
      expect([...second.atCell]).toEqual([...first.atCell]);
      // Um filtro nunca carrega cor que não deixe passar.
      puzzle.cells.forEach((cell, index) => {
        if (cell.kind === 'filter') expect(first.atCell[index] & ~cell.pass).toBe(0);
      });
    }
  });
});
