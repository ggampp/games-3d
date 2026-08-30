import * as THREE from 'three';
import { headingToQuaternion, latLonAltToVector } from '../geo/ecef';

function planeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Globe icon canvas failed');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#18e36a';
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(118, 110);
  ctx.lineTo(64, 88);
  ctx.lineTo(10, 110);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#06351a';
  ctx.lineWidth = 4;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGlobeAircraftIcon(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(280_000, 280_000),
    new THREE.MeshBasicMaterial({
      map: planeTexture(),
      transparent: true,
      depthTest: true,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.name = 'globe-aircraft';
  return mesh;
}

export function placeGlobeAircraftIcon(
  mesh: THREE.Mesh,
  lat: number,
  lon: number,
  heading: number,
): void {
  latLonAltToVector(lat, lon, 90_000, mesh.position);
  headingToQuaternion(lat, lon, heading, 0, 0, mesh.quaternion);
}
