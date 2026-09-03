import * as THREE from 'three';
import { Drone, type DroneType } from './drone';
import { terrainHeight } from '../world/terrain';

export function waveComposition(wave: number): DroneType[] {
  const list: DroneType[] = [];
  if (wave === 1) return ['PATROL', 'PATROL', 'PATROL'];
  if (wave === 2) return ['PATROL', 'PATROL', 'PATROL', 'EVADER', 'EVADER'];
  const n = Math.min(12, 3 + (wave - 1) * 2);
  for (let i = 0; i < n; i++) {
    const r = (i * 7 + wave * 3) % 10;
    list.push(r < 3 ? 'PATROL' : r < 7 ? 'EVADER' : 'AGGRESSOR');
  }
  if (wave % 4 === 0) list[0] = 'BOSS';
  return list;
}

export function spawnWave(wave: number, playerPos: THREE.Vector3, playerFwd: THREE.Vector3): Drone[] {
  const types = waveComposition(wave);
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
