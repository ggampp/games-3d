import * as THREE from 'three';
import { EARTH_RADIUS_M } from './ecef';

const DEG = Math.PI / 180;

export function sunDirection(date: Date, target = new THREE.Vector3()): THREE.Vector3 {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const epsilon = (23.439 - 0.0000004 * n) * DEG;
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const theta = gmst * 15 * DEG;
  const lon = alpha - theta;
  target.set(Math.cos(delta) * Math.cos(lon), Math.sin(delta), -Math.cos(delta) * Math.sin(lon));
  return target.normalize();
}

export function sunPosition(date: Date, target = new THREE.Vector3()): THREE.Vector3 {
  return sunDirection(date, target).multiplyScalar(EARTH_RADIUS_M * 4);
}
