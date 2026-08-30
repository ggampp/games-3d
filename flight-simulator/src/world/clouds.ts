import * as THREE from 'three';
import { EARTH_RADIUS_M } from '../geo/ecef';

function cloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cloud canvas failed');
  ctx.clearRect(0, 0, 1024, 512);
  for (let i = 0; i < 180; i += 1) {
    const x = Math.random() * 1024;
    const y = 40 + Math.random() * 432;
    const r = 18 + Math.random() * 70;
    const alpha = 0.08 + Math.random() * 0.22;
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, r);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCloudLayer(): THREE.Mesh {
  const material = new THREE.MeshLambertMaterial({
    map: cloudTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_M + 9000, 64, 48), material);
  mesh.name = 'clouds';
  return mesh;
}
