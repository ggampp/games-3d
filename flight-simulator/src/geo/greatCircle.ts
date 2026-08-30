import { DEG } from './ecef';

export type LatLon = { lat: number; lon: number };

export function interpolateGreatCircle(
  origin: LatLon,
  dest: LatLon,
  t: number,
): LatLon {
  const φ1 = origin.lat * DEG;
  const λ1 = origin.lon * DEG;
  const φ2 = dest.lat * DEG;
  const λ2 = dest.lon * DEG;
  const Δ = 2 * Math.asin(
    Math.sqrt(
      Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
    ),
  );
  if (Δ < 1e-8) return { lat: origin.lat, lon: origin.lon };

  const a = Math.sin((1 - t) * Δ) / Math.sin(Δ);
  const b = Math.sin(t * Δ) / Math.sin(Δ);
  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);
  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG,
    lon: Math.atan2(y, x) / DEG,
  };
}

export function sampleGreatCircle(origin: LatLon, dest: LatLon, count = 256): LatLon[] {
  const points: LatLon[] = [];
  const n = Math.max(2, count);
  for (let i = 0; i < n; i += 1) {
    points.push(interpolateGreatCircle(origin, dest, i / (n - 1)));
  }
  return points;
}
