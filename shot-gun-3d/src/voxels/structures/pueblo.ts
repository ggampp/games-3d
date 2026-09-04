import { Builder } from '../builder.ts';

/**
 * Prédio principal Pueblo / Adobe no estilo da imagem de referência:
 * - Otimizado com estrutura vazada e proporções ajustadas;
 * - Fachada voltada para -Z (rot = 1 posiciona de frente para a rua a leste);
 * - Vigas roliças salientes (vigas pueblo);
 * - Calçada de madeira com postes abertos e piso superior;
 * - Dobradiça da porta posicionada exatamente no batente estrutural.
 */
export function buildPuebloHotel(b: Builder): void {
  const w = 3.6;
  const d = 3.2;
  const h1 = 2.40;
  const h2 = 3.52;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const bwZ = z0 - 1.1;

  // 1. CALÇADA ELEVADA DE MADEIRA (POSTES + PISO VAZADO)
  b.box(x0, 0.24, bwZ, x1, 0.28, z0, 'plank');
  for (const px of [x0 + 0.1, 0, x1 - 0.1]) {
    b.post(px, bwZ + 0.08, 0, 0.24, 0.1, 'wood');
    b.post(px, bwZ + 0.08, 0.28, 0.88, 0.08, 'wood');
  }
  b.box(x0, 0.8, bwZ + 0.04, x1, 0.86, bwZ + 0.08, 'wood');
  b.box(x0, 0, bwZ - 0.16, x1, 0.12, bwZ, 'plank');

  // 2. PAREDES DE ADOBE (1 voxel de espessura)
  b.box(x0, 0, z0, x1, h1, z0 + 0.04, 'adobe');
  b.box(x0, 0, z1 - 0.04, x1, h1, z1, 'adobe');
  b.box(x0, 0, z0, x0 + 0.04, h1, z1, 'adobe');
  b.box(x1 - 0.04, 0, z0, x1, h1, z1, 'adobe');

  // Porta frontal em z = z0
  b.carve(-0.4, 0.28, z0 - 0.02, 0.4, 2.08, z0 + 0.06);
  b.box(-0.52, 0.24, z0 - 0.02, -0.4, 2.16, z0 + 0.06, 'wood');
  b.box(0.4, 0.24, z0 - 0.02, 0.52, 2.16, z0 + 0.06, 'wood');
  b.box(-0.52, 2.08, z0 - 0.02, 0.52, 2.16, z0 + 0.06, 'wood');
  b.door(-0.32, 0.32, 0.34, 2.0, z0 + 0.02, -0.4, 'pueblo-door', 0.04, 'plank');

  // Janelas frontais
  for (const wx of [-1.15, 1.15]) {
    b.carve(wx - 0.28, 0.84, z0 - 0.02, wx + 0.28, 1.68, z0 + 0.06);
    b.box(wx - 0.28, 0.84, z0, wx + 0.28, 1.68, z0 + 0.04, 'glass');
    b.box(wx - 0.36, 1.68, z0 - 0.06, wx + 0.36, 1.76, z0 + 0.08, 'wood');
  }

  // 3. VIGAS ROLIÇAS SALIENTES (PROJETADAS NA FACHADA)
  for (let vx = x0 + 0.36; vx <= x1 - 0.36; vx += 0.54) {
    b.box(vx - 0.04, h1 - 0.12, z0 - 0.26, vx + 0.04, h1 - 0.04, z0 + 0.1, 'wood');
  }

  // 4. SEGUNDO ANDAR ESCALONADO
  const x2_0 = x0 + 0.35;
  const x2_1 = x1 - 0.35;
  const z2_0 = z0 + 0.3;
  const z2_1 = z1;

  b.box(x2_0, h1, z2_0, x2_1, h2, z2_0 + 0.04, 'adobe');
  b.box(x2_0, h1, z2_1 - 0.04, x2_1, h2, z2_1, 'adobe');
  b.box(x2_0, h1, z2_0, x2_0 + 0.04, h2, z2_1, 'adobe');
  b.box(x2_1 - 0.04, h1, z2_0, x2_1, h2, z2_1, 'adobe');

  // Janelas do 2º andar
  for (const wx of [-0.65, 0.65]) {
    b.carve(wx - 0.22, h1 + 0.6, z2_0 - 0.02, wx + 0.22, h1 + 1.36, z2_0 + 0.06);
    b.box(wx - 0.22, h1 + 0.6, z2_0, wx + 0.22, h1 + 1.36, z2_0 + 0.04, 'glass');
    b.box(wx - 0.28, h1 + 1.36, z2_0 - 0.06, wx + 0.28, h1 + 1.44, z2_0 + 0.08, 'wood');
  }

  // Vigas do 2º andar
  for (let vx = x2_0 + 0.36; vx <= x2_1 - 0.36; vx += 0.54) {
    b.box(vx - 0.04, h2 - 0.12, z2_0 - 0.22, vx + 0.04, h2 - 0.04, z2_0 + 0.08, 'wood');
  }

  // Parapeito com merlões
  b.box(x2_0, h2, z2_0, x2_1, h2 + 0.16, z2_0 + 0.04, 'adobe');
  for (let px = x2_0 + 0.2; px <= x2_1 - 0.2; px += 0.54) {
    b.box(px - 0.08, h2 + 0.16, z2_0, px + 0.08, h2 + 0.32, z2_0 + 0.04, 'adobe');
  }
}

/**
 * Cantina Pueblo:
 */
export function buildPuebloOutpost(b: Builder): void {
  const w = 3.2;
  const d = 2.8;
  const h = 2.64;
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const bwZ = z0 - 1.1;

  // Calçada de madeira elevada
  b.box(x0, 0.24, bwZ, x1, 0.28, z0, 'plank');
  for (const px of [x0 + 0.1, 0, x1 - 0.1]) {
    b.post(px, bwZ + 0.08, 0, 0.24, 0.1, 'wood');
    b.post(px, bwZ + 0.08, 0.28, 0.88, 0.08, 'wood');
  }
  b.box(x0, 0.8, bwZ + 0.04, x1, 0.86, bwZ + 0.08, 'wood');

  // Paredes de adobe
  b.box(x0, 0, z0, x1, h, z0 + 0.04, 'adobe');
  b.box(x0, 0, z1 - 0.04, x1, h, z1, 'adobe');
  b.box(x0, 0, z0, x0 + 0.04, h, z1, 'adobe');
  b.box(x1 - 0.04, 0, z0, x1, h, z1, 'adobe');

  // Porta
  b.carve(-0.36, 0.28, z0 - 0.02, 0.36, 2.0, z0 + 0.06);
  b.box(-0.48, 0.24, z0 - 0.02, -0.36, 2.08, z0 + 0.06, 'wood');
  b.box(0.36, 0.24, z0 - 0.02, 0.48, 2.08, z0 + 0.06, 'wood');
  b.box(-0.48, 2.0, z0 - 0.02, 0.48, 2.08, z0 + 0.06, 'wood');
  b.door(-0.28, 0.28, 0.34, 1.92, z0 + 0.02, -0.36, 'pueblo-outpost-door', 0.04, 'plank');

  // Janelas
  for (const wx of [-0.95, 0.95]) {
    b.carve(wx - 0.24, 0.84, z0 - 0.02, wx + 0.24, 1.6, z0 + 0.06);
    b.box(wx - 0.24, 0.84, z0, wx + 0.24, 1.6, z0 + 0.04, 'glass');
    b.box(wx - 0.32, 1.6, z0 - 0.06, wx + 0.32, 1.68, z0 + 0.08, 'wood');
  }

  // Vigas roliças salientes
  for (let vx = x0 + 0.36; vx <= x1 - 0.36; vx += 0.54) {
    b.box(vx - 0.04, h - 0.12, z0 - 0.22, vx + 0.04, h - 0.04, z0 + 0.08, 'wood');
  }

  // Parapeito
  b.box(x0, h, z0, x1, h + 0.16, z0 + 0.04, 'adobe');
}
