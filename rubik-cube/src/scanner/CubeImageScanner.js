/**
 * CubeImageScanner.js
 * Módulo de processamento de imagem, amostragem de pixels e classificação de cores
 * para escaneamento de fotos dos 6 lados do Cubo Mágico 3x3 no navegador.
 */

export class CubeImageScanner {
  /**
   * Converte valores RGB (0-255) para o espaço de cor HSV (h: 0-360, s: 0-1, v: 0-1)
   */
  static rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    let h = 0;
    const s = max === 0 ? 0 : diff / max;
    const v = max;

    if (diff !== 0) {
      if (max === r) {
        h = ((g - b) / diff) % 6;
      } else if (max === g) {
        h = (b - r) / diff + 2;
      } else {
        h = (r - g) / diff + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return { h, s, v };
  }

  /**
   * Classifica uma cor RGB/HSV em uma das 6 cores padrão WCA:
   * U (Branco), D (Amarelo), F (Verde), B (Azul), R (Vermelho), L (Laranja)
   */
  static classifyColor(r, g, b) {
    const { h, s, v } = this.rgbToHsv(r, g, b);

    // 1. Branco (U): Baixa saturação e brilho relativamente alto
    if (s < 0.22 && v > 0.40) {
      return 'U';
    }

    // 2. Amarelo (D): Matiz entre 42° e 72°, saturação média a alta
    if (h >= 42 && h <= 72 && s >= 0.22 && v >= 0.40) {
      return 'D';
    }

    // 3. Verde (F): Matiz entre 75° e 165°
    if (h > 72 && h <= 165 && s >= 0.22) {
      return 'F';
    }

    // 4. Azul (B): Matiz entre 168° e 265°
    if (h > 165 && h <= 265 && s >= 0.22) {
      return 'B';
    }

    // 5. Laranja (L): Matiz entre 12° e 42°
    if (h >= 12 && h < 42 && s >= 0.30) {
      return 'L';
    }

    // 6. Vermelho (R): Matiz < 12° ou >= 345°
    if ((h < 12 || h >= 345) && s >= 0.25) {
      return 'R';
    }

    // Fallback por distância Euclidiana RGB contra as cores de referência
    const references = {
      U: [245, 245, 245],
      D: [250, 204, 21],
      F: [22, 163, 74],
      B: [37, 99, 235],
      R: [220, 38, 38],
      L: [234, 88, 12]
    };

    let closestFace = 'U';
    let minDistance = Infinity;

    for (const [face, [refR, refG, refB]] of Object.entries(references)) {
      const dr = r - refR;
      const dg = g - refG;
      const db = b - refB;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDistance) {
        minDistance = dist;
        closestFace = face;
      }
    }

    return closestFace;
  }

  /**
   * Carrega uma imagem a partir de src se for string
   */
  static loadImage(srcOrImg) {
    if (typeof srcOrImg === 'string') {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        img.src = srcOrImg;
      });
    }
    return Promise.resolve(srcOrImg);
  }

  /**
   * Extrai a grade 3x3 de cores de uma imagem com rotação opcional
   * @param {HTMLImageElement|HTMLCanvasElement} source
   * @param {Object} options { cropBox, rotation }
   * @returns {Array<{face: string, rgb: string, hex: string, label: string}>}
   */
  static extractGridDetails(source, options = {}) {
    const { cropBox = null, rotation = 0 } = options;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let srcW = source.videoWidth || source.naturalWidth || source.width || 400;
    let srcH = source.videoHeight || source.naturalHeight || source.height || 400;

    const rot = ((rotation % 360) + 360) % 360;
    const isQuarterTurn = rot === 90 || rot === 270;

    canvas.width = isQuarterTurn ? srcH : srcW;
    canvas.height = isQuarterTurn ? srcW : srcH;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(source, -srcW / 2, -srcH / 2);
    ctx.restore();

    const width = canvas.width;
    const height = canvas.height;

    const minDim = Math.min(width, height);
    const box = cropBox || {
      x: (width - minDim * 0.76) / 2,
      y: (height - minDim * 0.76) / 2,
      width: minDim * 0.76,
      height: minDim * 0.76
    };

    const cellWidth = box.width / 3;
    const cellHeight = box.height / 3;
    const details = [];

    const labels = {
      U: 'Branco',
      D: 'Amarelo',
      F: 'Verde',
      B: 'Azul',
      R: 'Vermelho',
      L: 'Laranja'
    };

    // Amostra 3 linhas x 3 colunas
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const centerX = box.x + col * cellWidth + cellWidth / 2;
        const centerY = box.y + row * cellHeight + cellHeight / 2;
        const sampleRadius = Math.max(2, Math.min(cellWidth, cellHeight) * 0.22);

        const imgData = ctx.getImageData(
          Math.max(0, Math.round(centerX - sampleRadius)),
          Math.max(0, Math.round(centerY - sampleRadius)),
          Math.max(1, Math.round(sampleRadius * 2)),
          Math.max(1, Math.round(sampleRadius * 2))
        );

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        const totalPixels = imgData.data.length / 4;

        for (let i = 0; i < imgData.data.length; i += 4) {
          sumR += imgData.data[i];
          sumG += imgData.data[i + 1];
          sumB += imgData.data[i + 2];
        }

        const avgR = Math.round(sumR / totalPixels);
        const avgG = Math.round(sumG / totalPixels);
        const avgB = Math.round(sumB / totalPixels);

        const face = this.classifyColor(avgR, avgG, avgB);
        details.push({
          face,
          label: labels[face] || face,
          rgb: `rgb(${avgR}, ${avgG}, ${avgB})`
        });
      }
    }

    return details;
  }

  /**
   * Extrai os 9 códigos de cores de uma face
   */
  static extractGridColors(source, options = {}) {
    return this.extractGridDetails(source, options).map(d => d.face);
  }

  /**
   * Processa de forma assíncrona uma foto dada como Image, File ou Data URL
   */
  static async scanFaceImage(sourceOrSrc, options = {}) {
    const img = await this.loadImage(sourceOrSrc);
    const details = this.extractGridDetails(img, options);
    return {
      grid: details.map(d => d.face),
      details
    };
  }
}
