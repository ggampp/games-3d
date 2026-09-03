/**
 * Converte um gesto 3D (normal da face + arraste) em camada e notação Singmaster.
 * Ângulos seguem a regra da mão direita em torno do eixo +X/+Y/+Z do cubo.
 * Independente de Three.js para poder ser testado em Node.
 */

export const AXIS_LAYER_META = {
  'y:1': { face: 'U', cwSign: -1 },
  'y:-1': { face: 'D', cwSign: 1 },
  'x:1': { face: 'R', cwSign: -1 },
  'x:-1': { face: 'L', cwSign: 1 },
  'z:1': { face: 'F', cwSign: -1 },
  'z:-1': { face: 'B', cwSign: 1 },
  'x:0': { face: 'M', cwSign: 1 },
  'y:0': { face: 'E', cwSign: 1 },
  'z:0': { face: 'S', cwSign: -1 }
};

export function snapToCubeAxis(x, y, z) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);

  if (ax >= ay && ax >= az) {
    return { axis: 'x', sign: x >= 0 ? 1 : -1 };
  }
  if (ay >= ax && ay >= az) {
    return { axis: 'y', sign: y >= 0 ? 1 : -1 };
  }
  return { axis: 'z', sign: z >= 0 ? 1 : -1 };
}

export function layerFromCoord(value) {
  if (value > 0.4) return 1;
  if (value < -0.4) return -1;
  return 0;
}

/**
 * Escolhe o eixo e a camada a partir da normal da adesivo, da peça e da direção do arraste no mundo.
 */
export function resolveDragLayer(faceNx, faceNy, faceNz, cubieX, cubieY, cubieZ, dragX, dragY, dragZ) {
  const nd = faceNx * dragX + faceNy * dragY + faceNz * dragZ;
  const tx = dragX - faceNx * nd;
  const ty = dragY - faceNy * nd;
  const tz = dragZ - faceNz * nd;
  const tLen = Math.hypot(tx, ty, tz);
  if (tLen < 1e-8) return null;

  const rx = faceNy * tz - faceNz * ty;
  const ry = faceNz * tx - faceNx * tz;
  const rz = faceNx * ty - faceNy * tx;
  if (Math.hypot(rx, ry, rz) < 1e-8) return null;

  const snapped = snapToCubeAxis(rx, ry, rz);
  const along = snapped.axis === 'x' ? cubieX : snapped.axis === 'y' ? cubieY : cubieZ;
  return {
    axis: snapped.axis,
    layer: layerFromCoord(along)
  };
}

export function shortestSnapAngle(angle) {
  const quarter = Math.PI / 2;
  return Math.round(angle / quarter) * quarter;
}

/**
 * Converte o ângulo RH acumulado no pivot em um movimento Singmaster (U, U', U2, …).
 */
export function notationFromAngle(axis, layer, angle) {
  const meta = AXIS_LAYER_META[`${axis}:${layer}`];
  if (!meta) return null;

  const rhQuarters = Math.round(angle / (Math.PI / 2));
  if (rhQuarters === 0) return null;

  const cwQuarters = rhQuarters * (meta.cwSign > 0 ? 1 : -1);
  const q = ((cwQuarters % 4) + 4) % 4;
  if (q === 0) return null;
  if (q === 1) return meta.face;
  if (q === 2) return `${meta.face}2`;
  return `${meta.face}'`;
}
