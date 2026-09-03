import { Builder } from '../builder.ts';
import { VOXEL_SIZE as V } from '../types.ts';
import { textRows, textWidth } from '../font.ts';

/** Caixa d'água sobre quatro pernas finas: tire duas do mesmo lado e o tanque tomba. */
export function buildWaterTower(b: Builder): void {
  const legH = 3.2;
  const half = 0.72;
  for (const [x, z] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
    b.post(x, z, 0, legH, 0.18);
  }
  // travamentos em X
  for (const y of [1.0, 2.1]) {
    b.box(-half, y, -half, half, y + 0.12, -half, 'wood');
    b.box(-half, y, half, half, y + 0.12, half, 'wood');
    b.box(-half, y, -half, -half, y + 0.12, half, 'wood');
    b.box(half, y, -half, half, y + 0.12, half, 'wood');
  }
  // plataforma
  b.box(-half - 0.18, legH, -half - 0.18, half + 0.18, legH + 0.12, half + 0.18, 'plank');
  // tanque (parede de tábuas com cintas de aço) cheio de "água" de vidro
  const r = 0.96;
  const tankY0 = legH + 0.12;
  const tankH = 1.5;
  b.cylinder(0, 0, r, tankY0, tankY0 + 0.06, 'plank');
  b.cylinder(0, 0, r, tankY0 + 0.06, tankY0 + tankH, 'plank', 'structure', r - 0.12);
  b.cylinder(0, 0, r - 0.12, tankY0 + tankH - 0.3, tankY0 + tankH - 0.24, 'glass');
  for (const y of [tankY0 + 0.24, tankY0 + 0.72, tankY0 + 1.2]) {
    b.cylinder(0, 0, r + 0.06, y, y + 0.06, 'steel', 'structure', r);
  }
  // telhado cônico
  b.cone(0, 0, r + 0.12, 0.06, tankY0 + tankH, tankY0 + tankH + 0.66, 'plank');
  // escada de mão numa perna
  for (let y = 0.24; y < legH; y += 0.24) {
    b.box(half + 0.12, y, -0.12, half + 0.12, y + 0.06, 0.12, 'wood');
  }
  b.box(half + 0.12, 0, -0.12, half + 0.12, legH, -0.12, 'wood');
  b.box(half + 0.12, 0, 0.12, half + 0.12, legH, 0.12, 'wood');
}

/** Capela de adobe com campanário, sino de bronze em corrente e vitrais. */
export function buildChapel(b: Builder): void {
  const w = 2.4;
  const d = 3.6;
  const h = 2.6;
  b.walls(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.06, 'adobe');
  // vitrais laterais (vidro com moldura de madeira)
  for (const z of [-1.0, 0, 1.0]) {
    for (const x of [-w / 2, w / 2]) {
      b.carve(x, 1.0, z - 0.18, x + (x < 0 ? 0.06 : -0.06), 2.0, z + 0.18);
      b.box(x, 1.0, z - 0.24, x + (x < 0 ? 0.06 : -0.06), 2.0, z - 0.24, 'wood');
      b.box(x, 1.0, z + 0.24, x + (x < 0 ? 0.06 : -0.06), 2.0, z + 0.24, 'wood');
      b.box(x, 1.0, z - 0.18, x + (x < 0 ? 0.06 : -0.06), 2.0, z + 0.18, 'glass');
      b.box(x, 1.5, z - 0.18, x + (x < 0 ? 0.06 : -0.06), 1.56, z + 0.18, 'wood');
    }
  }
  // porta dupla na frente (+z)
  b.carve(-0.42, 0.12, d / 2, 0.42, 2.0, d / 2 - 0.06);
  b.door(-0.36, -0.06, 0.18, 1.98, d / 2, -0.48, 'chapel-l', 0.12, 'wood');
  b.door(0.06, 0.36, 0.18, 1.98, d / 2, 0.48, 'chapel-r', 0.12, 'wood');
  // telhado de duas águas
  b.gableRoof(-w / 2 - 0.18, w / 2 + 0.18, 0, d / 2 + 0.18, h, 0.9, 'plank');
  // empena frontal e traseira em adobe (fecha o triângulo)
  for (let i = 0; i < 15; i++) {
    const y = h + i * V;
    const half = (w / 2 + 0.06) * (1 - i / 15);
    b.box(-half, y, d / 2 - 0.06, half, y + V, d / 2, 'adobe');
    b.box(-half, y, -d / 2, half, y + V, -d / 2 + 0.06, 'adobe');
  }
  // campanário sobre a frente
  const tw = 0.84;
  const tz = d / 2 - 0.6;
  const ty0 = h + 0.9;
  const ty1 = ty0 + 2.0;
  b.walls(-tw / 2, h - 0.12, tz - tw / 2, tw / 2, ty0, tz + tw / 2, 0.06, 'adobe');
  b.walls(-tw / 2, ty0, tz - tw / 2, tw / 2, ty1, tz + tw / 2, 0.06, 'adobe');
  // arcos abertos
  b.carve(-0.18, ty0 + 0.3, tz - tw / 2, 0.18, ty1 - 0.36, tz - tw / 2 + 0.06);
  b.carve(-0.18, ty0 + 0.3, tz + tw / 2 - 0.06, 0.18, ty1 - 0.36, tz + tw / 2);
  b.carve(-tw / 2, ty0 + 0.3, tz - 0.18, -tw / 2 + 0.06, ty1 - 0.36, tz + 0.18);
  b.carve(tw / 2 - 0.06, ty0 + 0.3, tz - 0.18, tw / 2, ty1 - 0.36, tz + 0.18);
  // travessa do sino
  b.box(-tw / 2 + 0.12, ty1 - 0.36, tz, tw / 2 - 0.12, ty1 - 0.24, tz, 'wood');
  b.cone(0, tz, tw / 2 + 0.12, 0.06, ty1, ty1 + 0.72, 'plank', 'structure', true);
  // cruz
  b.box(0, ty1 + 0.72, tz, 0, ty1 + 1.14, tz, 'steel');
  b.box(-0.12, ty1 + 0.96, tz, 0.12, ty1 + 1.02, tz, 'steel');
  // sino: corrente curta + corpo de bronze com badalo de aço
  const yEnd = b.chain(0, tz, ty1 - 0.36, 1, 'bell');
  const g = 'hang:bell';
  b.box(-0.06, yEnd - 0.12, tz - 0.06, 0.06, yEnd, tz + 0.06, 'bronze', g);
  b.box(-0.12, yEnd - 0.3, tz - 0.12, 0.12, yEnd - 0.12, tz + 0.12, 'bronze', g);
  b.box(-0.18, yEnd - 0.42, tz - 0.18, 0.18, yEnd - 0.3, tz + 0.18, 'bronze', g);
  b.box(0, yEnd - 0.48, tz, 0, yEnd - 0.42, tz, 'steel', g);
  // bancos internos
  for (const z of [-1.2, -0.6, 0, 0.6]) {
    b.box(-0.84, 0.12, z, -0.24, 0.42, z + 0.06, 'plank');
    b.box(0.24, 0.12, z, 0.84, 0.42, z + 0.06, 'plank');
  }
}

/** Moinho de vento: torre de madeira e roda em junta motorizada. */
export function buildWindmill(b: Builder): void {
  const h = 3.6;
  const base = 0.9;
  const top = 0.36;
  // pernas inclinadas em degraus
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const steps = Math.round(h / 0.12);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = base + (top - base) * t;
      b.box(sx * r - 0.06, i * 0.12, sz * r - 0.06, sx * r + 0.06, i * 0.12 + 0.12, sz * r + 0.06, 'wood');
    }
  }
  for (const y of [0.9, 1.8, 2.7]) {
    const t = y / h;
    const r = base + (top - base) * t;
    b.box(-r, y, -r, r, y + 0.06, -r, 'wood');
    b.box(-r, y, r, r, y + 0.06, r, 'wood');
    b.box(-r, y, -r, -r, y + 0.06, r, 'wood');
    b.box(r, y, -r, r, y + 0.06, r, 'wood');
  }
  // cabeça
  b.walls(-0.42, h, -0.42, 0.42, h + 0.72, 0.42, 0.06, 'plank');
  b.box(-0.42, h, -0.42, 0.42, h + 0.06, 0.42, 'plank');
  b.cone(0, 0, 0.54, 0.06, h + 0.72, h + 1.08, 'plank', 'structure', true);
  // eixo de aço saindo para +z; a roda é `spin:` e o eixo está dentro dela
  b.box(0, h + 0.36, 0.42, 0, h + 0.42, 0.54, 'steel');
  const g = 'spin:windmill';
  const zc = 0.66;
  const yc = h + 0.39;
  b.box(-0.06, yc - 0.06, zc - 0.06, 0.06, yc + 0.06, zc + 0.06, 'steel', g);
  b.add(0, yc, 0.6, 'steel', g); // voxel de eixo encostado na cabeça
  const len = 1.5;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let s = 0.12; s <= len; s += V) {
      b.add(dx * s, yc + dy * s, zc, 'wood', g);
      if (s > 0.36) {
        const px = -dy;
        const py = dx;
        for (let k = 1; k <= 3; k++) {
          b.add(dx * s + px * k * V, yc + dy * s + py * k * V, zc + V, 'plank', g);
        }
      }
    }
  }
}

/** Banco de tijolo com cofre de aço e ouro dentro. */
export function buildBank(b: Builder): void {
  const w = 3.0;
  const d = 2.4;
  const h = 2.4;
  b.walls(-w / 2, 0, -d / 2, w / 2, h, d / 2, 0.06, 'brick');
  // janelas com barras
  for (const x of [-0.9, 0.9]) {
    b.carve(x - 0.24, 1.0, d / 2 - 0.06, x + 0.24, 1.7, d / 2);
    for (const bx of [x - 0.12, x, x + 0.12]) b.box(bx, 1.0, d / 2, bx, 1.7, d / 2, 'steel');
  }
  b.carve(-0.3, 0.12, d / 2 - 0.06, 0.3, 1.9, d / 2);
  b.door(-0.24, 0.24, 0.18, 1.86, d / 2, -0.36, 'bank', 0.12, 'wood');
  // platibanda alta com letreiro
  b.box(-w / 2 - 0.06, h, d / 2, w / 2 + 0.06, h + 0.72, d / 2, 'brick');
  b.box(-w / 2, h, -d / 2, w / 2, h + 0.12, d / 2, 'plank');
  const rows = textRows('BANK');
  const tw = textWidth('BANK') * V;
  b.ascii(rows, -tw / 2, h + 0.6, d / 2 + 0.06, { '#': 'gold' });
  // cofre de aço com ouro dentro
  const vx = -0.6;
  const vz = -0.6;
  b.box(vx - 0.42, 0.12, vz - 0.42, vx + 0.42, 1.08, vz + 0.42, 'steel');
  b.carve(vx - 0.3, 0.24, vz - 0.3, vx + 0.3, 0.96, vz + 0.3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      b.box(vx - 0.24 + i * 0.18, 0.24 + j * 0.12, vz - 0.24, vx - 0.12 + i * 0.18, 0.36 + j * 0.12, vz + 0.24, 'gold');
    }
  }
  // balcão
  b.box(0.3, 0.12, -0.3, 1.2, 0.9, -0.24, 'wood');
  b.box(0.24, 0.9, -0.36, 1.26, 0.96, -0.18, 'plank');
}
