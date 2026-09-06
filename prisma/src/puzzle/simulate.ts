import type { ColorMask } from './colors.ts';
import { DIR_VECTORS, DIRECTIONS, perpendiculars, reflect } from './grid.ts';
import type { Cell, Direction, Mirror, Placements, Puzzle } from './grid.ts';
import { indexOf } from './grid.ts';

/**
 * Resultado da propagação da luz. As máscaras por direção servem tanto para o
 * desenho (cada célula desenha meia-hasta de entrada e meia de saída) quanto
 * para a checagem dos alvos.
 */
export interface Simulation {
  /** Máscara que ENTRA na célula viajando na direção d: `index * 4 + d`. */
  incoming: Uint8Array;
  /** Máscara que SAI da célula viajando na direção d: `index * 4 + d`. */
  outgoing: Uint8Array;
  /** Máscara total presente na célula (mistura de tudo que chega; já filtrada num filtro). */
  atCell: Uint8Array;
  /**
   * Em quantos passos (células percorridas desde um emissor) a luz chegou pela
   * primeira vez a cada meia-hasta de entrada: `index * 4 + d`. Só serve para
   * animar o avanço do feixe; 0 = nunca chegou.
   */
  arrival: Uint16Array;
  /** Alvos acesos com exatamente a cor pedida. */
  lit: Set<number>;
  /** Alvos que recebem luz, mas na cor errada. */
  wrong: Set<number>;
}

interface Pending {
  x: number;
  y: number;
  dir: Direction;
  mask: ColorMask;
  depth: number;
}

/** Para onde a luz que entrou em `dir` sai desta célula. */
export function exitsFor(cell: Cell, dir: Direction, mirror: Mirror | undefined): Direction[] {
  if (cell.kind === 'prism') return perpendiculars(dir);
  if (mirror) return [reflect(dir, mirror)];
  return [dir];
}

/**
 * Regras da luz neste jogo:
 * - a luz segue reta em célula vazia e é refletida 90° por um espelho;
 * - paredes, emissores e alvos absorvem o feixe;
 * - um **prisma** divide o feixe que chega nas duas perpendiculares;
 * - um **filtro** só deixa passar a primária dele (o resto é absorvido);
 * - **feixes que se cruzam se misturam**: tudo que chega numa célula é somado
 *   (OR aditivo) e sai misturado em todas as direções de saída. É daí que vem
 *   laranja, roxo, verde e branco.
 *
 * As máscaras só crescem durante a propagação (o filtro aplica um AND com uma
 * constante, que preserva a monotonia), então laços na grade convergem em vez
 * de rodar para sempre — não há limite artificial de passos. A fila é
 * percorrida em largura para que `arrival` meça a distância ao emissor.
 */
export function simulate(puzzle: Puzzle, placements: Placements): Simulation {
  const size = puzzle.width * puzzle.height;
  const incoming = new Uint8Array(size * 4);
  const outgoing = new Uint8Array(size * 4);
  const atCell = new Uint8Array(size);
  const arrival = new Uint16Array(size * 4);

  const queue: Pending[] = [];
  let head = 0;

  puzzle.cells.forEach((cell, index) => {
    if (cell.kind !== 'emitter') return;
    const x = index % puzzle.width;
    const y = Math.floor(index / puzzle.width);
    atCell[index] = cell.color;
    outgoing[index * 4 + cell.dir] = cell.color;
    const v = DIR_VECTORS[cell.dir];
    queue.push({ x: x + v.dx, y: y + v.dy, dir: cell.dir, mask: cell.color, depth: 1 });
  });

  while (head < queue.length) {
    const step = queue[head++];
    const { x, y, dir, mask, depth } = step;
    if (x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) continue;

    const index = indexOf(puzzle, x, y);
    const cell = puzzle.cells[index];
    if (cell.kind === 'wall' || cell.kind === 'emitter') continue;

    const slot = index * 4 + dir;
    const before = incoming[slot];
    const merged = before | mask;
    if (merged === before) continue;
    if (before === 0) arrival[slot] = Math.min(65535, depth);
    incoming[slot] = merged;

    // Mistura de tudo que entra; o filtro corta as primárias que não deixa passar.
    let total = 0;
    for (const d of DIRECTIONS) total |= incoming[index * 4 + d];
    if (cell.kind === 'filter') total &= cell.pass;
    atCell[index] = total;
    if (cell.kind === 'target' || total === 0) continue;

    // A cor da célula pode ter crescido: reemitir TODAS as saídas com a mistura.
    const mirror = placements.get(index);
    for (const d of DIRECTIONS) {
      if (incoming[index * 4 + d] === 0) continue;
      for (const out of exitsFor(cell, d, mirror)) {
        const outSlot = index * 4 + out;
        const grew = (outgoing[outSlot] | total) !== outgoing[outSlot];
        outgoing[outSlot] |= total;
        if (!grew) continue;
        const v = DIR_VECTORS[out];
        queue.push({ x: x + v.dx, y: y + v.dy, dir: out, mask: total, depth: depth + 1 });
      }
    }
  }

  const lit = new Set<number>();
  const wrong = new Set<number>();
  puzzle.cells.forEach((cell, index) => {
    if (cell.kind !== 'target') return;
    const got = atCell[index];
    if (got === cell.want) lit.add(index);
    else if (got !== 0) wrong.add(index);
  });

  return { incoming, outgoing, atCell, arrival, lit, wrong };
}

/** Todos os alvos acesos na cor certa? */
export function isSolved(puzzle: Puzzle, sim: Simulation): boolean {
  const targets = puzzle.cells.filter((c) => c.kind === 'target').length;
  return targets > 0 && sim.lit.size === targets;
}
