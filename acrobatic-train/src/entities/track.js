/** Pure path math and retention shared by renderer and replay tests. */
export function segAt(seg, u) {
  const h = seg.h0 + seg.k * u;
  if (seg.k === 0) return { x: seg.x0 + Math.cos(h) * u, z: seg.z0 + Math.sin(h) * u, h };
  return { x: seg.x0 + (Math.sin(h) - Math.sin(seg.h0)) / seg.k, z: seg.z0 - (Math.cos(h) - Math.cos(seg.h0)) / seg.k, h };
}
export function trackRetention(totalCars, carLength, spacing = 0.5, margin = 60) {
  return (totalCars - 1) * (carLength + spacing) + margin;
}
