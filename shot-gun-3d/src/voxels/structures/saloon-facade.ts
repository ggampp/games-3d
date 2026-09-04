import { Builder } from '../builder.ts';
import { VOXEL_SIZE as V } from '../types.ts';
import { textRows, textWidth } from '../font.ts';

/**
 * Saloon principal de 2 andares na Main Street:
 * - Otimizado para alto desempenho e fidelidade estética;
 * - Paredes vazadas de 1 voxel de espessura;
 * - Varanda dupla com sacada e corrimãos de madeira;
 * - Vigas de teto sob as lanternas;
 * - Letreiro central 'SALOON'.
 */
export function buildMainStreetSaloon(b: Builder): void {
  const w = 4.0;       // largura (x de -2.0 a 2.0)
  const d = 3.2;       // profundidade (z de -1.1 a 2.1)
  const h1 = 2.40;     // piso superior
  const h2 = 3.68;     // telhado
  const hFront = 4.32; // topo do letreiro boomtown
  const porchZ = -2.0; // limite da varanda frontal
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -1.1;
  const z1 = d - 1.1;

  // 1. VARANDA TÉRREA E SACADA SUPERIOR
  b.box(x0 - 0.1, 0, porchZ, x1 + 0.1, 0.04, z0, 'plank');

  // Postes mestres
  for (const px of [x0 + 0.2, -0.55, 0.55, x1 - 0.2]) {
    b.post(px, porchZ + 0.08, 0.04, h1, 0.1, 'wood');
    b.post(px, porchZ + 0.08, h1 + 0.06, h2, 0.08, 'wood');
  }

  // Piso da sacada do 2º andar
  b.box(x0 - 0.1, h1, porchZ, x1 + 0.1, h1 + 0.04, z0, 'plank');
  b.box(x0 - 0.1, h1 - 0.06, porchZ + 0.04, x1 + 0.1, h1, porchZ + 0.1, 'wood');

  // Beiral sobre a sacada
  b.shedRoof(x0 - 0.16, x1 + 0.16, z0, porchZ - 0.08, h2 + 0.2, h2 + 0.04, 'plank');

  // Corrimão da sacada
  b.box(x0 - 0.1, h1 + 0.64, porchZ + 0.04, x1 + 0.1, h1 + 0.7, porchZ + 0.08, 'wood');
  b.box(x0 - 0.1, h1 + 0.64, porchZ, x0 - 0.06, h1 + 0.7, z0, 'wood');
  b.box(x1 + 0.06, h1 + 0.64, porchZ, x1 + 0.1, h1 + 0.7, z0, 'wood');

  // Corrimão da varanda térrea e degrau frontal
  b.box(x0 - 0.1, 0.6, porchZ + 0.04, -0.65, 0.66, porchZ + 0.08, 'wood');
  b.box(0.65, 0.6, porchZ + 0.04, x1 + 0.1, 0.66, porchZ + 0.08, 'wood');
  b.box(-0.6, 0, porchZ - 0.16, 0.6, 0.04, porchZ, 'plank');

  // 2. PAREDES DE MADEIRA (1 voxel de espessura)
  b.box(x0, 0, z0, x1, h2, z0 + 0.04, 'wood');
  b.box(x0, 0, z0, x0 + 0.04, h2, z1, 'wood');
  b.box(x1 - 0.04, 0, z0, x1, h2, z1, 'wood');
  b.box(x0, 0, z1 - 0.04, x1, h2, z1, 'wood');

  // Porta térrea central
  b.carve(-0.5, 0.04, z0 - 0.02, 0.5, 2.08, z0 + 0.06);
  b.box(-0.62, 0, z0 - 0.02, -0.5, 2.16, z0 + 0.06, 'wood');
  b.box(0.5, 0, z0 - 0.02, 0.62, 2.16, z0 + 0.06, 'wood');
  b.box(-0.62, 2.08, z0 - 0.02, 0.62, 2.16, z0 + 0.06, 'wood');
  b.door(-0.42, -0.04, 0.4, 1.68, z0 + 0.02, -0.5, 'saloon-l', 0.04, 'plank');
  b.door(0.04, 0.42, 0.4, 1.68, z0 + 0.02, 0.5, 'saloon-r', 0.04, 'plank');

  // Janelas térreas
  for (const wx of [-1.25, 1.25]) {
    b.carve(wx - 0.35, 0.76, z0 - 0.02, wx + 0.35, 1.76, z0 + 0.06);
    b.box(wx - 0.35, 0.76, z0, wx + 0.35, 1.76, z0 + 0.04, 'glass');
    b.box(wx - 0.35, 1.24, z0 - 0.01, wx + 0.35, 1.30, z0 + 0.05, 'wood');
  }

  // Porta e janelas do 2º andar
  b.carve(-0.32, h1 + 0.06, z0 - 0.02, 0.32, h1 + 1.92, z0 + 0.06);
  b.box(-0.4, h1 + 0.06, z0 - 0.02, -0.32, h1 + 1.98, z0 + 0.06, 'wood');
  b.box(0.32, h1 + 0.06, z0 - 0.02, 0.4, h1 + 1.98, z0 + 0.06, 'wood');
  b.door(-0.28, 0.28, h1 + 0.12, h1 + 1.84, z0 + 0.02, -0.32, 'saloon-upper-door', 0.04, 'plank');

  for (const wx of [-1.15, 1.15]) {
    b.carve(wx - 0.28, h1 + 0.56, z0 - 0.02, wx + 0.28, h1 + 1.6, z0 + 0.06);
    b.box(wx - 0.28, h1 + 0.56, z0, wx + 0.28, h1 + 1.6, z0 + 0.04, 'glass');
  }

  // 3. LETREIRO 'SALOON'
  b.box(x0 - 0.06, h2, z0 - 0.02, x1 + 0.06, hFront, z0 + 0.04, 'plank');
  b.box(x0 - 0.1, hFront - 0.06, z0 - 0.04, x1 + 0.1, hFront + 0.04, z0 + 0.06, 'wood');

  const title = 'SALOON';
  const rows = textRows(title);
  const tw = textWidth(title) * V;
  b.box(-tw / 2 - 0.12, h2 + 0.2, z0 - 0.04, tw / 2 + 0.12, h2 + 0.72, z0 - 0.01, 'wood');
  b.ascii(rows, -tw / 2, h2 + 0.66, z0 - 0.06, { '#': 'gold' });

  // 4. VIGAS DE TETO E LANTERNAS
  b.box(x0, h1 - 0.08, 0.44, x1, h1, 0.56, 'wood');
  b.box(x0, h1 - 0.08, 1.34, x1, h1, 1.46, 'wood');
  b.lantern(-0.35, 0.5, h1 - 0.08, 'saloon-0', 2);
  b.lantern(0.45, 1.4, h1 - 0.08, 'saloon-1', 2);

  // 5. INTERIOR ESSENCIAL
  b.box(-1.3, 0.04, -0.2, -0.95, 0.88, 1.5, 'wood');
  b.box(-1.34, 0.88, -0.24, -0.9, 0.94, 1.54, 'plank');
  b.box(-0.88, 0.08, -0.2, -0.84, 0.14, 1.5, 'bronze');

  // Prateleira de garrafas
  b.box(x0 + 0.04, 0.04, 0.0, x0 + 0.18, 1.7, 1.3, 'wood');
  for (let bz = 0.2; bz < 1.2; bz += 0.36) {
    b.box(x0 + 0.1, 0.88, bz, x0 + 0.14, 1.04, bz + 0.04, 'glass');
    b.box(x0 + 0.06, 0.88, bz + 0.1, x0 + 0.1, 1.02, bz + 0.14, 'gold');
  }

  // Mesa de pôquer
  b.post(0.7, 0.3, 0.04, 0.68, 0.1, 'wood');
  b.box(0.45, 0.68, 0.05, 0.95, 0.74, 0.55, 'wood');
  b.box(0.66, 0.74, 0.26, 0.74, 0.8, 0.34, 'gold');

  // Piano
  const px0 = x0 + 0.25;
  const pz0 = z1 - 0.55;
  b.box(px0, 0.04, pz0, px0 + 0.7, 1.04, pz0 + 0.3, 'wood');
  b.box(px0 + 0.05, 0.56, pz0 - 0.1, px0 + 0.65, 0.62, pz0, 'plank');
}
