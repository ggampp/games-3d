import { Builder } from '../builder.ts';
import { VOXEL_SIZE as V } from '../types.ts';
import { textRows, textWidth } from '../font.ts';

export const DECK_TOP = 0.18;
export const PLAZA_TOP = 0.16;

/** Pórtico do saloon: quatro pilares de adobe, viga, letreiro, portas batentes e lanternas. */
export function buildSaloon(b: Builder): void {
  const y0 = DECK_TOP;
  const top = 2.16;
  const zc = -0.24;
  for (const x of [-1.8, -0.84, 0.84, 1.8]) {
    b.box(x - 0.15, y0, zc - 0.15, x + 0.15, top - 0.12, 0.06, 'adobe');
    // chanfro no pé e capitel largo
    b.box(x - 0.21, y0, zc - 0.21, x + 0.21, y0 + 0.12, zc + 0.21, 'adobe');
    b.box(x - 0.27, top - 0.12, zc - 0.27, x + 0.27, top, zc + 0.27, 'adobe');
  }
  // viga
  b.box(-2.04, top, -0.48, 2.04, top + 0.42, 0.0, 'adobe');
  // travessa de madeira sob a viga (detalhe)
  b.box(-2.04, top - 0.06, -0.12, 2.04, top, 0.0, 'wood');
  // letreiro em pranchas na face frontal
  const rows = textRows('SALOON');
  const w = textWidth('SALOON') * V;
  b.box(-w / 2 - 0.12, top + 0.06, 0.06, w / 2 + 0.12, top + 0.42, 0.06, 'plank');
  b.ascii(rows, -w / 2, top + 0.39, 0.12, { '#': 'wood' });
  // portas batentes (dobradiça encosta no pilar interno)
  b.door(-0.54, -0.06, 0.42, 1.74, 0, -0.62, 'saloon-l');
  b.door(0.06, 0.54, 0.42, 1.74, 0, 0.62, 'saloon-r');
  // lanternas nas extremidades da viga
  b.lantern(-1.32, -0.24, top, 'saloon-0');
  b.lantern(1.32, -0.24, top, 'saloon-1');
}

/** Coreto na praça de pedra. */
export function buildGazebo(b: Builder, radius: number): void {
  const y0 = PLAZA_TOP;
  const r = radius - 0.3;
  const h = 1.6;
  for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]] as const) {
    b.post(dx, dz, y0, y0 + h, 0.18);
  }
  // guarda-corpo
  for (const side of [-r, r]) {
    b.box(-r + 0.24, y0 + 0.5, side, r - 0.24, y0 + 0.62, side, 'wood');
    b.box(side, y0 + 0.5, -r + 0.24, side, y0 + 0.62, r - 0.24, 'wood');
    for (let t = -r + 0.36; t < r - 0.3; t += 0.24) {
      b.box(t, y0, side, t, y0 + 0.5, side, 'wood');
      b.box(side, y0, t, side, y0 + 0.5, t, 'wood');
    }
  }
  // anel superior e telhado em degraus
  b.box(-r - 0.06, y0 + h, -r - 0.06, r + 0.06, y0 + h + 0.12, r + 0.06, 'wood');
  b.cone(0, 0, r + 0.12, 0.12, y0 + h + 0.12, y0 + h + 0.9, 'plank', 'structure', true);
  b.lantern(0, 0, y0 + h, 'gazebo', 2);
}

/** Casinha de madeira com porta própria. */
export function buildOuthouse(b: Builder): void {
  const w = 0.72;
  const h = 1.9;
  b.walls(-w / 2, 0, -w / 2, w / 2, h, w / 2, 0.06, 'wood');
  // vão da porta na frente (+z)
  b.carve(-0.18, 0, w / 2, 0.18, h - 0.24, w / 2);
  // meia-lua
  b.carve(-0.06, h - 0.42, w / 2, 0.06, h - 0.3, w / 2);
  b.shedRoof(-w / 2 - 0.06, w / 2 + 0.06, w / 2 + 0.06, -w / 2 - 0.06, h, h + 0.3, 'plank');
  b.door(-0.12, 0.18, 0.12, h - 0.3, w / 2 + 0.06, -0.24, 'outhouse');
}

/** Poço de pedra com sarilho. */
export function buildWell(b: Builder): void {
  b.cylinder(0, 0, 0.5, 0, 0.6, 'rock', 'structure', 0.32);
  b.post(-0.42, 0, 0.6, 1.5, 0.12);
  b.post(0.42, 0, 0.6, 1.5, 0.12);
  b.box(-0.48, 1.5, -0.06, 0.48, 1.62, 0.06, 'wood');
  b.box(-0.36, 1.05, 0, 0.36, 1.11, 0, 'steel');
  b.cone(0, 0, 0.66, 0.06, 1.62, 2.0, 'plank', 'structure', true);
  b.chain(0, 0, 1.05, 3, 'well');
  b.box(-0.09, 0.42, -0.09, 0.09, 0.6, 0.09, 'steel', 'hang:well');
}

/** Caixotes, cerca curta, banco, placa. */
export function buildYardProps(b: Builder): void {
  const crate = (x: number, z: number, y: number, s: number) => {
    b.box(x, y, z, x + s, y + s, z + s, 'wood');
    b.box(x, y + s / 2 - 0.03, z, x + s, y + s / 2 + 0.03, z + s, 'plank');
  };
  crate(0, 0, 0, 0.42);
  crate(0.54, 0.12, 0, 0.42);
  crate(0.18, 0.06, 0.42, 0.3);
  for (const x of [1.2, 1.5, 1.8, 2.1]) b.box(x, 0, 0.9, x + 0.06, 0.3, 0.9, 'wood');
  // banco
  b.post(-1.2, 0.6, 0, 0.42, 0.12);
  b.post(-0.48, 0.6, 0, 0.42, 0.12);
  b.box(-1.32, 0.42, 0.48, -0.36, 0.5, 0.72, 'plank');
  // barris soltos
  b.cylinder(-1.0, -0.6, 0.24, 0, 0.6, 'wood', 'loose:barrel-0');
  b.cylinder(-0.45, -0.66, 0.24, 0, 0.6, 'wood', 'loose:barrel-1');
  b.cylinder(-0.72, -0.63, 0.24, 0.6, 1.2, 'wood', 'loose:barrel-2');
}

/** Cacto de três braços. */
export function buildCactus(b: Builder, h: number): void {
  b.box(-0.06, 0, -0.06, 0.06, h, 0.06, 'cactus');
  b.box(0.12, h * 0.45, 0, 0.3, h * 0.45 + 0.12, 0, 'cactus');
  b.box(0.3, h * 0.45, 0, 0.3, h * 0.8, 0, 'cactus');
  b.box(-0.3, h * 0.6, 0, -0.12, h * 0.6 + 0.12, 0, 'cactus');
  b.box(-0.3, h * 0.6, 0, -0.3, h * 0.9, 0, 'cactus');
}

/** Pedra grande. */
export function buildRock(b: Builder, r: number): void {
  b.cylinder(0, 0, r, 0, r * 0.7, 'rock');
  b.cylinder(0.06, 0, r * 0.7, r * 0.7, r * 1.2, 'rock');
  b.cylinder(-0.06, 0.06, r * 0.4, r * 1.2, r * 1.5, 'rock');
}
