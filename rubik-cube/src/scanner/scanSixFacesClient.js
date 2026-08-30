/**
 * scanSixFacesClient.js
 * Cliente para reconhecimento e montagem do cubo a partir das 6 fotos dos lados.
 */

import { CubeImageScanner } from './CubeImageScanner.js';
import { validateSixFaces, normalizeGrid } from './sixFacesReconstructor.js';
import { getExampleSixFacePhotos } from './exampleSixFaceData.js';

export async function fetchVisionStatus() {
  try {
    const res = await fetch('/api/scan-status');
    if (!res.ok) return { vision: false };
    return await res.json();
  } catch {
    return { vision: false };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = src;
  });
}

export async function imageSourceToDataUrl(src, maxSize = 1024) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Analisa as 6 fotos dos lados do cubo
 * @param {Object} facePhotosMap { U: src, L: src, F: src, R: src, B: src, D: src }
 * @param {Object} rotations { U: 0, L: 0, F: 0, R: 0, B: 0, D: 0 }
 * @param {Object} options { allowExampleFixture: boolean }
 */
export async function analyzeSixFacePhotos(facePhotosMap, rotations = {}, { allowExampleFixture = false } = {}) {
  const faces = ['U', 'L', 'F', 'R', 'B', 'D'];
  const missing = faces.filter(f => !facePhotosMap[f]);

  if (missing.length > 0 && !allowExampleFixture) {
    throw new Error(`Por favor, envie as fotos de todas as 6 faces. Faltam: ${missing.join(', ')}.`);
  }

  const status = await fetchVisionStatus();

  // 1. Tentar análise via IA Vision se chave estiver configurada
  if (status.vision && !allowExampleFixture) {
    try {
      const processedImages = {};
      for (const face of faces) {
        if (facePhotosMap[face]) {
          processedImages[face] = await imageSourceToDataUrl(facePhotosMap[face]);
        }
      }

      const res = await fetch('/api/scan-six-faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: processedImages, rotations })
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.readings) {
          const validation = validateSixFaces(payload.readings);
          return {
            ...validation,
            source: 'vision',
            provider: payload.provider || status.provider || 'openrouter',
            model: payload.model || status.model || ''
          };
        }
      }
    } catch (err) {
      console.warn('Falha na requisição de visão remota, usando visão computacional local:', err);
    }
  }

  // 2. Análise por Visão Computacional Local no Navegador (CubeImageScanner)
  const scannedGrids = {};
  for (const face of faces) {
    const src = facePhotosMap[face];
    if (src) {
      const rot = rotations[face] || 0;
      const scanResult = await CubeImageScanner.scanFaceImage(src, { rotation: rot });
      scannedGrids[face] = scanResult.grid;
    }
  }

  const validation = validateSixFaces(scannedGrids);
  validation.source = allowExampleFixture ? 'example-fixture' : 'browser-cv';
  validation.provider = 'Visão Computacional no Navegador';
  return validation;
}
