import * as THREE from 'three';
import { fbm, ridged, smoothstep, clamp } from '../util/noise';

export const WORLD_SIZE = 20000; // metres
export const RUNWAY_LENGTH = 3000;
export const RUNWAY_WIDTH = 46;
/** Runway 36 runs along -Z (north). Threshold 36 is at +Z (south end). */
export const RUNWAY_Z0 = 1500;   // south threshold (z)
export const RUNWAY_Z1 = -1500;  // north end (z)

// Low-level corridor axis: from (-2000,-3200) westwards to (-8200,-3200)
export const CORRIDOR_Z = -3200;
export const CORRIDOR_X0 = -2000;
export const CORRIDOR_X1 = -8200;

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

/** Analytic terrain height (metres) at world x,z. Used by the mesh, the flight model, drones and course placement. */
export function terrainHeight(x: number, z: number): number {
  const s = 1 / 3400;
  const base = fbm(x * s + 3.1, z * s - 1.7, 5) * 0.5 + 0.5;          // 0..1 soft hills
  const rid = ridged(x * s * 0.55 + 9.2, z * s * 0.55 + 4.4, 4);      // 0..1 ridges
  const distC = Math.hypot(x, z);
  const far = smoothstep(4500, 10000, distC);                           // mountains rise far from the field
  let h = base * 260 + rid * rid * 900 * far + base * 380 * far;
  // soft dunes/hills nearer the field
  h += (fbm(x / 900 + 2, z / 900 + 5, 3) * 0.5 + 0.5) * 60 * (1 - far);
  // lake basin (east, darker, flat)
  const lake = 1 - smoothstep(1000, 2100, Math.hypot(x - 5200, z + 1800));
  h = h * (1 - lake * 0.92) - lake * 12;
  // airfield flat zone
  const fieldR = 1 - smoothstep(600, 2600, Math.max(Math.abs(x) * 1.15, Math.abs(z) - 1200));
  h *= 1 - fieldR;
  // corridor valley (low-level course)
  const dc = distToSegment(x, z, CORRIDOR_X0 + 400, CORRIDOR_Z, CORRIDOR_X1 - 400, CORRIDOR_Z);
  const valley = 1 - smoothstep(180, 900, dc);
  h = h * (1 - valley * 0.85) + valley * 30;
  // approach path south of the runway kept clear
  const app = 1 - smoothstep(300, 1400, Math.abs(x)) ;
  const southApp = app * smoothstep(1200, 2000, z) * (1 - smoothstep(6000, 9000, z));
  h *= 1 - southApp * 0.9;
  return h;
}

export function terrainNormal(x: number, z: number, out = new THREE.Vector3()) {
  const e = 4;
  const hL = terrainHeight(x - e, z), hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e), hU = terrainHeight(x, z + e);
  return out.set(hL - hR, 2 * e, hD - hU).normalize();
}

export function isLake(x: number, z: number) { return Math.hypot(x - 5200, z + 1800) < 1500; }

export function buildTerrain(): THREE.Mesh {
  const seg = 320;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const cLow = new THREE.Color(0x1a2230), cMid = new THREE.Color(0x232c34), cHigh = new THREE.Color(0x3a3f44), cSnow = new THREE.Color(0x5a626c), cLake = new THREE.Color(0x070b14);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const t = clamp(h / 1200, 0, 1);
    if (isLake(x, z) && h < 2) c.copy(cLake);
    else if (t < 0.25) c.copy(cLow).lerp(cMid, t / 0.25);
    else if (t < 0.7) c.copy(cMid).lerp(cHigh, (t - 0.25) / 0.45);
    else c.copy(cHigh).lerp(cSnow, (t - 0.7) / 0.3);
    // slope shading
    const n = terrainNormal(x, z);
    const slope = 1 - n.y;
    c.multiplyScalar(1 - slope * 0.6);
    // subtle noise variation
    c.multiplyScalar(0.85 + fbm(x / 250, z / 250, 2) * 0.25);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
  // Subtle height fog painted into the fragment: valleys get a violet haze.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n float hf = 1.0 - smoothstep(-20.0, 180.0, vH);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.10,0.07,0.16), hf * 0.35);');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Lake surface */
export function buildLake(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(1500, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.15, metalness: 0.6 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(5200, -1, -1800);
  return m;
}
