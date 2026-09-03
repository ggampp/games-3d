import { Builder } from '../builder.ts';
import { VOXEL_SIZE as V } from '../types.ts';
import { textRows, textWidth } from '../font.ts';

/** Estábulo aberto na frente com fardos de feno soltos. */
export function buildStable(b: Builder): void {
  const w = 3.0;
  const d = 2.4;
  const h = 1.9;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, -d / 2]] as const) {
    b.post(x, z, 0, h + 0.3, 0.18);
  }
  // fundo e laterais em tábuas
  b.box(-w / 2, 0, -d / 2, w / 2, h, -d / 2, 'plank');
  b.box(-w / 2, 0, -d / 2, -w / 2, h, d / 2, 'plank');
  b.box(w / 2, 0, -d / 2, w / 2, h, d / 2, 'plank');
  // baias
  b.box(0, 0, -d / 2, 0, 0.9, 0.3, 'wood');
  b.shedRoof(-w / 2 - 0.18, w / 2 + 0.18, d / 2 + 0.24, -d / 2 - 0.18, h, h + 0.6, 'plank');
  // fardos de feno soltos, empilhados
  const bale = (x: number, y: number, z: number, i: number) => {
    b.box(x - 0.24, y, z - 0.18, x + 0.24, y + 0.3, z + 0.18, 'hay', `loose:hay-${i}`);
  };
  bale(-0.9, 0, -0.6, 0);
  bale(-0.9, 0, -0.18, 1);
  bale(-0.9, 0.3, -0.39, 2);
  bale(0.9, 0, -0.6, 3);
  bale(0.9, 0.3, -0.6, 4);
  bale(0.9, 0, 0.0, 5);
  bale(-0.3, 0, 0.72, 6);
  // cocho
  b.box(0.36, 0, 0.6, 1.2, 0.3, 0.9, 'wood');
  b.carve(0.42, 0.12, 0.66, 1.14, 0.3, 0.84);
}

/** Loja geral com varanda e letreiro pendurado em duas correntes. */
export function buildStore(b: Builder): void {
  const w = 3.0;
  const d = 2.4;
  const h = 2.2;
  b.box(-w / 2 - 0.36, 0.06, d / 2, w / 2 + 0.36, 0.12, d / 2 + 1.2, 'plank');
  b.walls(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.06, 'wood');
  // vitrine
  b.carve(0.36, 0.72, d / 2, 1.2, 1.8, d / 2);
  b.box(0.36, 0.72, d / 2, 1.2, 1.8, d / 2, 'glass');
  b.box(0.78, 0.72, d / 2, 0.78, 1.8, d / 2, 'wood');
  b.carve(-1.0, 0.12, d / 2, -0.4, 1.9, d / 2);
  b.door(-0.94, -0.46, 0.18, 1.86, d / 2, -1.0, 'store', 0.06, 'plank');
  // fachada falsa alta
  b.box(-w / 2 - 0.06, h, d / 2 - 0.06, w / 2 + 0.06, h + 0.9, d / 2, 'plank');
  b.box(-w / 2 - 0.06, h + 0.9, d / 2 - 0.12, w / 2 + 0.06, h + 0.96, d / 2 + 0.06, 'wood');
  b.box(-w / 2, h, -d / 2, w / 2, h + 0.06, d / 2, 'plank');
  // varanda
  const pz = d / 2 + 1.2;
  for (const x of [-w / 2 - 0.18, -0.5, 0.5, w / 2 + 0.18]) b.post(x, pz, 0.12, h - 0.06, 0.12);
  b.box(-w / 2 - 0.3, h - 0.06, d / 2, w / 2 + 0.3, h + 0.06, pz + 0.12, 'plank');
  // letreiro pendurado
  const rows = textRows('STORE');
  const tw = textWidth('STORE') * V;
  const y0 = b.chain(-tw / 2 - 0.06, pz - 0.36, h - 0.06, 2, 'store-a');
  b.chain(tw / 2 + 0.06, pz - 0.36, h - 0.06, 2, 'store-b');
  const g = 'hang:store';
  b.box(-tw / 2 - 0.12, y0 - 0.48, pz - 0.36, tw / 2 + 0.12, y0, pz - 0.36, 'plank', g);
  b.ascii(rows, -tw / 2, y0 - 0.06, pz - 0.42, { '#': 'wood' }, g);
  // prateleiras e caixotes
  b.box(-w / 2 + 0.06, 0.6, -d / 2 + 0.06, -w / 2 + 0.36, 0.66, d / 2 - 0.3, 'plank');
  b.box(-w / 2 + 0.06, 1.2, -d / 2 + 0.06, -w / 2 + 0.36, 1.26, d / 2 - 0.3, 'plank');
  b.cylinder(0.9, -0.6, 0.24, 0.12, 0.66, 'wood', 'loose:store-barrel');
}

/** Cadeia de adobe com barras de aço. */
export function buildJail(b: Builder): void {
  const w = 2.1;
  const d = 2.1;
  const h = 2.2;
  b.walls(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.06, 'adobe');
  for (const side of [-1, 1]) {
    const x = side * w / 2;
    b.carve(x, 1.0, -0.3, x, 1.7, 0.3);
    for (const z of [-0.24, -0.12, 0, 0.12, 0.24]) b.box(x, 1.0, z, x, 1.7, z, 'steel');
  }
  b.carve(-0.3, 0.06, d / 2, 0.3, 1.9, d / 2);
  b.door(-0.24, 0.24, 0.12, 1.86, d / 2, -0.36, 'jail', 0.06, 'steel');
  b.box(-w / 2 - 0.12, h, -d / 2 - 0.12, w / 2 + 0.12, h + 0.06, d / 2 + 0.12, 'wood');
  b.walls(-w / 2, h + 0.06, -d / 2, w / 2, h + 0.36, d / 2, 0.06, 'adobe');
  const rows = textRows('JAIL');
  const tw = textWidth('JAIL') * V;
  b.ascii(rows, -tw / 2, h + 0.36, d / 2 + 0.06, { '#': 'steel' });
  // cela com beliche
  b.box(-w / 2 + 0.18, 0.5, -d / 2 + 0.18, -0.3, 0.56, -d / 2 + 0.72, 'plank');
  b.box(-w / 2 + 0.18, 1.1, -d / 2 + 0.18, -0.3, 1.16, -d / 2 + 0.72, 'plank');
}

/** Torre de vigia com escada e plataforma. */
export function buildWatchtower(b: Builder): void {
  const h = 3.6;
  const half = 0.6;
  for (const [x, z] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
    b.post(x, z, 0, h + 0.9, 0.18);
  }
  for (const y of [1.2, 2.4]) {
    b.box(-half, y, -half, half, y + 0.06, -half, 'wood');
    b.box(-half, y, half, half, y + 0.06, half, 'wood');
    b.box(-half, y, -half, -half, y + 0.06, half, 'wood');
    b.box(half, y, -half, half, y + 0.06, half, 'wood');
  }
  b.box(-half - 0.24, h, -half - 0.24, half + 0.24, h + 0.12, half + 0.24, 'plank');
  b.carve(-0.24, h, -0.24, 0.24, h + 0.12, 0.24);
  // guarda-corpo
  b.box(-half - 0.24, h + 0.12, -half - 0.24, half + 0.24, h + 0.66, -half - 0.24, 'wood');
  b.box(-half - 0.24, h + 0.12, half + 0.24, half + 0.24, h + 0.66, half + 0.24, 'wood');
  b.box(-half - 0.24, h + 0.12, -half - 0.24, -half - 0.24, h + 0.66, half + 0.24, 'wood');
  b.box(half + 0.24, h + 0.12, -half - 0.24, half + 0.24, h + 0.66, half + 0.24, 'wood');
  b.carve(-half - 0.18, h + 0.18, -half - 0.24, half + 0.18, h + 0.6, -half - 0.24);
  b.carve(-half - 0.18, h + 0.18, half + 0.24, half + 0.18, h + 0.6, half + 0.24);
  b.carve(-half - 0.24, h + 0.18, -half - 0.18, -half - 0.24, h + 0.6, half + 0.18);
  b.carve(half + 0.24, h + 0.18, -half - 0.18, half + 0.24, h + 0.6, half + 0.18);
  b.cone(0, 0, half + 0.36, 0.06, h + 0.9, h + 1.5, 'plank', 'structure', true);
  // escada interna (degraus de 1 voxel a cada 0,24 m — o jogador sobe com autostep)
  for (let y = 0.24; y < h; y += 0.24) {
    b.box(-0.18, y, 0, 0.18, y + 0.06, 0, 'wood');
  }
  b.box(-0.24, 0, 0, -0.24, h, 0, 'wood');
  b.box(0.24, 0, 0, 0.24, h, 0, 'wood');
}

/** Trilhos fixos e um vagão solto em cima. */
export function buildRailsAndWagon(b: Builder, length: number): void {
  const half = length / 2;
  for (const z of [-0.3, 0.3]) b.box(-half, 0, z, half, 0.06, z, 'steel');
  for (let x = -half; x <= half; x += 0.36) b.box(x, 0, -0.42, x, 0.06, 0.42, 'wood');
  const g = 'loose:wagon';
  // caixa do vagão
  b.box(-0.6, 0.24, -0.36, 0.6, 0.3, 0.36, 'steel', g);
  b.walls(-0.6, 0.3, -0.36, 0.6, 0.78, 0.36, 0.06, 'steel', g);
  b.box(-0.54, 0.54, -0.3, 0.54, 0.6, 0.3, 'rock', g); // carga de minério
  for (const x of [-0.36, 0.36]) {
    for (const z of [-0.42, 0.42]) {
      b.cylinder(x, z, 0.12, 0.06, 0.24, 'steel', g);
    }
  }
  b.box(-0.36, 0.12, -0.42, 0.36, 0.18, 0.42, 'steel', g);
}

/** Trecho de cerca de madeira (postes + duas ripas) ao longo de X. */
export function buildFence(b: Builder, length: number): void {
  const half = length / 2;
  for (let x = -half; x <= half + 0.01; x += 1.2) b.post(x, 0, 0, 0.9, 0.12);
  b.box(-half, 0.3, 0, half, 0.36, 0, 'plank');
  b.box(-half, 0.66, 0, half, 0.72, 0, 'plank');
}
