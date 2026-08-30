/**
 * exampleSixFaceData.js
 * Dados e gerador de fotos de exemplo para as 6 faces do Cubo Mágico Real:
 * U (Topo), L (Esquerda), F (Frente), R (Direita), B (Trás), D (Base).
 */

import { CubeState } from '../cube/CubeState.js';

// Gera um estado de cubo embaralhado 100% legal e solucionável para o fixture de exemplo
function createScrambledFixture() {
  const cube = new CubeState();
  const scrambleMoves = ['R', 'U', "R'", 'F', 'D', "L'", 'B2', 'U2', 'R', "D'", 'F2', 'L'];
  for (const m of scrambleMoves) cube.applyMove(m);
  return {
    U: [...cube.faces.U],
    L: [...cube.faces.L],
    F: [...cube.faces.F],
    R: [...cube.faces.R],
    B: [...cube.faces.B],
    D: [...cube.faces.D]
  };
}

export const EXAMPLE_SIX_FACES_GRIDS = createScrambledFixture();

export const COLOR_HEX_MAP = {
  U: '#f8fafc',
  D: '#eab308',
  F: '#16a34a',
  B: '#2563eb',
  R: '#dc2626',
  L: '#ea580c'
};

/**
 * Gera um Data URL de imagem realista de face 3x3 de cubo mágico para testes visuais
 */
export function generateFacePhotoDataUrl(faceName, grid) {
  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Fundo mesa / superfície suave
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, '#1e293b');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Moldura do cubo de plástico preto arredondado
  const margin = 28;
  const cubeSize = size - margin * 2;
  const rad = 14;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(margin, margin, cubeSize, cubeSize, rad);
  ctx.fill();
  ctx.restore();

  // Desenha os 9 stickers
  const gap = 6;
  const cellSize = (cubeSize - gap * 4) / 3;
  const cellRad = 6;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const colorKey = grid[idx] || faceName;
      const hex = COLOR_HEX_MAP[colorKey] || '#ffffff';

      const x = margin + gap + c * (cellSize + gap);
      const y = margin + gap + r * (cellSize + gap);

      // Gradiente suave para dar aspecto de sticker plástico brilhante
      const stickerGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
      stickerGrad.addColorStop(0, hex);
      stickerGrad.addColorStop(1, adjustBrightness(hex, -18));

      ctx.save();
      ctx.fillStyle = stickerGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, cellRad);
      ctx.fill();

      // Brilho sutil no topo do sticker
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, cellSize - 4, (cellSize - 4) * 0.45, [4, 4, 2, 2]);
      ctx.fill();

      // Borda sutil
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Label discreto da face no canto
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`Face ${faceName}`, 12, size - 10);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function adjustBrightness(hex, percent) {
  let num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Retorna as 6 fotos de exemplo em Data URL
 */
export function getExampleSixFacePhotos() {
  const photos = {};
  for (const face of ['U', 'L', 'F', 'R', 'B', 'D']) {
    photos[face] = generateFacePhotoDataUrl(face, EXAMPLE_SIX_FACES_GRIDS[face]);
  }
  return photos;
}
