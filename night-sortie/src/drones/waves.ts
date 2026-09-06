import * as THREE from 'three';
import { Drone, type DroneType } from './drone';
import { terrainHeight } from '../world/terrain';

/**
 * Wave composition. Early waves teach one type at a time; aggressors ramp in from wave 3 and
 * their share grows with the wave number; a BOSS leads every fourth wave (two of them from wave 12).
 */
export function waveComposition(wave: number): DroneType[] {
  if (wave === 1) return ['PATROL', 'PATROL', 'PATROL'];
  if (wave === 2) return ['PATROL', 'PATROL', 'PATROL', 'EVADER'];
  if (wave === 3) return ['PATROL', 'PATROL', 'EVADER', 'EVADER', 'AGGRESSOR'];
  const n = Math.min(10, 4 + (wave - 3));
  const aggShare = Math.min(0.45, 0.12 + (wave - 3) * 0.06);
  const list: DroneType[] = [];
  for (let i = 0; i < n; i++) {
    const r = ((i * 7 + wave * 3) % 10) / 10;
    list.push(r < aggShare ? 'AGGRESSOR' : r < aggShare + 0.4 ? 'EVADER' : 'PATROL');
  }
  if (wave % 4 === 0) { list[0] = 'BOSS'; if (wave >= 12) list[1] = 'BOSS'; }
  return list;
}

/** Spawn a list of drones spread across the player's front hemisphere. */
export function spawnTypes(types: DroneType[], playerPos: THREE.Vector3, playerFwd: THREE.Vector3): Drone[] {
  const drones: Drone[] = [];
  types.forEach((type, i) => {
    const ang = (i / types.length) * Math.PI * 1.4 - Math.PI * 0.7; // spread across the front hemisphere
    const dist = 2200 + Math.random() * 1800 + (type === 'BOSS' ? 1500 : 0);
    const dir = playerFwd.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    const p = playerPos.clone().addScaledVector(dir, dist);
    p.y = Math.max(terrainHeight(p.x, p.z) + 250, 350 + Math.random() * 700);
    const center = p.clone(); center.y = Math.max(terrainHeight(p.x, p.z) + 300, 500 + Math.random() * 500);
    const heading = Math.random() * Math.PI * 2;
    drones.push(new Drone(type, p, heading, center));
  });
  return drones;
}

export function spawnWave(wave: number, playerPos: THREE.Vector3, playerFwd: THREE.Vector3): Drone[] {
  return spawnTypes(waveComposition(wave), playerPos, playerFwd);
}
