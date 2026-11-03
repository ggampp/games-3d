/**
 * scanSixFacesClient.js
 * Monta o cubo a partir das fotos dos 6 lados usando apenas visão computacional
 * no navegador: amostragem das 9 peças de cada foto + calibração pelas cores dos
 * centros (ver colorCalibration.js). Nenhuma imagem sai do aparelho.
 */

import { CubeImageScanner } from './CubeImageScanner.js';
import { validateSixFaces } from './sixFacesReconstructor.js';
import { calibrateFaces } from './colorCalibration.js';

const FACES = ['U', 'L', 'F', 'R', 'B', 'D'];

/**
 * Lê as cores das 6 faces.
 * @param {Object} facePhotosMap { U: src, L: src, F: src, R: src, B: src, D: src }
 * @param {Object} rotations { U: 0, L: 0, ... } rotação aplicada a cada foto (graus)
 * @param {Object} [options]
 * @param {Object} [options.locked] cores corrigidas à mão, mantidas na calibração
 */
export async function analyzeSixFacePhotos(facePhotosMap, rotations = {}, { locked = {} } = {}) {
  const missing = FACES.filter((f) => !facePhotosMap[f]);
  if (missing.length > 0) {
    throw new Error(`Envie as fotos das 6 faces. Faltam: ${missing.join(', ')}.`);
  }

  const samples = {};
  for (const face of FACES) {
    const scan = await CubeImageScanner.scanFaceImage(facePhotosMap[face], {
      rotation: rotations[face] || 0
    });
    samples[face] = scan.samples;
  }

  const { faces, uncertain } = calibrateFaces(samples, { locked });
  const validation = validateSixFaces(faces);
  validation.samples = samples;
  validation.uncertain = uncertain;
  validation.source = 'browser-cv';
  validation.provider = 'Visão computacional no navegador (calibrada pelos centros)';
  return validation;
}
