export function gapUnder(gaps, lat, s, tolerance = 0.7) {
  return gaps.some(g => Math.abs(lat - g.tz) < tolerance && s >= g.a && s <= g.b);
}
export function overlapsFootprint(ds, dl, slant, halfLength, halfWidth) {
  const ca = Math.cos(slant), sa = Math.sin(slant);
  return Math.abs(ds * ca + dl * sa) < halfLength && Math.abs(-ds * sa + dl * ca) < halfWidth;
}

export function hitsBarrier(barrier, pose, geometry) {
  if (pose.bottom >= barrier.height) return false;
  const ds = barrier.s - pose.dist, dl = barrier.lat - (pose.front + pose.rear) / 2;
  const c = Math.cos(pose.slant), s = Math.sin(pose.slant), ac = Math.abs(c), as = Math.abs(s);
  const trainL = geometry.carLength / 2, trainW = geometry.carWidth / 2, blockL = barrier.length / 2, blockW = barrier.width / 2;
  return Math.abs(ds) < trainL * ac + trainW * as + blockL && Math.abs(dl) < trainL * as + trainW * ac + blockW
    && Math.abs(ds * c + dl * s) < trainL + blockL * ac + blockW * as
    && Math.abs(-ds * s + dl * c) < trainW + blockL * as + blockW * ac;
}
export function hitsPole(pole, pose, geometry) {
  if (pose.bottom >= pole.h) return false;
  const ds = pole.s - pose.dist, dl = pole.lat - (pose.front + pose.rear) / 2, c = Math.cos(pose.slant), s = Math.sin(pose.slant);
  const x = Math.max(0, Math.abs(ds * c + dl * s) - geometry.carLength / 2);
  const z = Math.max(0, Math.abs(-ds * s + dl * c) - geometry.carWidth / 2);
  return x * x + z * z < pole.r * pole.r;
}
export function canCollect(item, pose, { carLength, carWidth, itemRadius = 0.45, bodyHeight = 3.5, diagonalMin = 1.7 }) {
  if (item.taken || Math.abs(item.s - pose.dist) > carLength) return false;
  if (item.y + itemRadius < pose.bottom || item.y - itemRadius > pose.bottom + bodyHeight) return false;
  if (item.diag && Math.abs(pose.front - pose.rear) < diagonalMin) return false;
  return overlapsFootprint(item.s - pose.dist, item.lat - (pose.front + pose.rear) / 2, pose.slant, carLength / 2 + itemRadius, carWidth / 2 + itemRadius);
}
