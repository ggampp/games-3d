import * as THREE from 'three';

export const EARTH_RADIUS_M = 6_371_008.8;
export const DEG = Math.PI / 180;

const east = new THREE.Vector3();
const north = new THREE.Vector3();
const up = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const basis = new THREE.Matrix4();

export function latLonAltToVector(
  latDeg: number,
  lonDeg: number,
  altM: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const r = EARTH_RADIUS_M + altM;
  const cosLat = Math.cos(lat);
  // Z is negated so lon matches Three.js SphereGeometry UVs (Greenwich at +X, 90°E at −Z).
  target.set(r * cosLat * Math.cos(lon), r * Math.sin(lat), -r * cosLat * Math.sin(lon));
  return target;
}

export function geodeticUp(latDeg: number, lonDeg: number, target = new THREE.Vector3()): THREE.Vector3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const cosLat = Math.cos(lat);
  target.set(cosLat * Math.cos(lon), Math.sin(lat), -cosLat * Math.sin(lon));
  return target;
}

export function geodeticEast(lonDeg: number, target = new THREE.Vector3()): THREE.Vector3 {
  const lon = lonDeg * DEG;
  target.set(-Math.sin(lon), 0, -Math.cos(lon));
  return target;
}

export function geodeticNorth(latDeg: number, lonDeg: number, target = new THREE.Vector3()): THREE.Vector3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  target.set(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
  return target;
}

export function headingToQuaternion(
  latDeg: number,
  lonDeg: number,
  headingDeg: number,
  pitchDeg = 2,
  rollDeg = 0,
  target = new THREE.Quaternion(),
): THREE.Quaternion {
  geodeticUp(latDeg, lonDeg, up);
  geodeticEast(lonDeg, east);
  geodeticNorth(latDeg, lonDeg, north);

  const heading = headingDeg * DEG;
  forward.copy(north).multiplyScalar(Math.cos(heading)).addScaledVector(east, Math.sin(heading));

  const pitch = pitchDeg * DEG;
  forward.multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
  right.copy(up).cross(forward).normalize();
  up.copy(forward).cross(right).normalize();

  if (rollDeg !== 0) {
    const roll = rollDeg * DEG;
    const rolledRight = right.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll));
    const rolledUp = up.clone().multiplyScalar(Math.cos(roll)).addScaledVector(right, -Math.sin(roll));
    right.copy(rolledRight).normalize();
    up.copy(rolledUp).normalize();
  }

  basis.makeBasis(right, up, forward);
  return target.setFromRotationMatrix(basis).normalize();
}

export function initialBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δλ = (lon2 - lon1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δφ = (lat2 - lat1) * DEG;
  const Δλ = (lon2 - lon1) * DEG;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ponto de destino (lat/lon em graus) a `distanceM` metros seguindo `bearingDeg` a partir de lat/lon. */
export function destinationPoint(
  latDeg: number,
  lonDeg: number,
  bearingDeg: number,
  distanceM: number,
): { lat: number; lon: number } {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = bearingDeg * DEG;
  const φ1 = latDeg * DEG;
  const λ1 = lonDeg * DEG;
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  let lon = λ2 / DEG;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lat: φ2 / DEG, lon };
}
