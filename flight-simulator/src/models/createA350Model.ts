import * as THREE from 'three';
import { createAirliner, type AircraftRuntime, type AirlinerSpec } from './airliner';

export type { AircraftRuntime } from './airliner';
export { setGear, updateAircraftEffects } from './airliner';

function unionJackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Union Jack canvas failed');
  ctx.fillStyle = '#012169';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 90;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(512, 512);
  ctx.moveTo(512, 0);
  ctx.lineTo(0, 512);
  ctx.stroke();
  ctx.strokeStyle = '#c8102e';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(512, 512);
  ctx.moveTo(512, 0);
  ctx.lineTo(0, 512);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(216, 0, 80, 512);
  ctx.fillRect(0, 216, 512, 80);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(236, 0, 40, 512);
  ctx.fillRect(0, 236, 512, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function speedmarqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Speedmarque canvas failed');
  const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
  gradient.addColorStop(0, 'rgba(12, 35, 90, 0)');
  gradient.addColorStop(0.08, '#0b2a66');
  gradient.addColorStop(0.42, '#0b2a66');
  gradient.addColorStop(0.43, '#c8102e');
  gradient.addColorStop(0.78, '#c8102e');
  gradient.addColorStop(1, 'rgba(200, 16, 46, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.lineTo(980, 8);
  ctx.lineTo(1024, 64);
  ctx.lineTo(940, 120);
  ctx.lineTo(0, 100);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Airbus A350-1000 em pintura British Airways (branco/cinza, deriva Union Jack). */
export const A350_SPEC: AirlinerSpec = {
  name: 'A350-1000-BA',
  length: 73.79,
  wingspan: 64.75,
  fuselageRadius: 2.98,
  noseFraction: 0.11,
  tailFraction: 0.24,
  wing: {
    halfSpan: 29.8,
    rootChord: 9.6,
    tipChordRatio: 0.27,
    sweepBack: 11.8,
    dihedral: 1.9,
    rootZ: -1.2,
    rootY: -0.35,
    thickness: 0.36,
  },
  engine: { radius: 1.5, length: 5.8, x: 10.4, y: -2.15, z: 2.4, blades: 18 },
  tail: {
    finHeight: 9.6,
    finRootChord: 10.8,
    finTipChord: 3.4,
    finSweep: 6.4,
    finThickness: 0.52,
    hStabHalfSpan: 9.2,
    hStabRootChord: 4.8,
    hStabTipChord: 1.9,
    hStabSweep: 3.8,
    hStabY: 1.15,
    hStabZ: -29.6,
    z: -23.4,
  },
  gear: { noseZ: 25.5, mainZ: -3.6, mainX: 5.4, strutLength: 3.3, wheelRadius: 0.7, mainWheels: 4 },
  cabin: { startZ: -22, endZ: 28.5, windowPitch: 1.05 },
  livery: {
    upper: '#f3eee4',
    belly: '#6e747c',
    cheatline: null,
    wing: '#e7e2d6',
    engine: '#2c3036',
    fin: '#012169',
    finTexture: unionJackTexture,
    stripeTexture: speedmarqueTexture,
    stripeLength: 28,
  },
};

/**
 * Procedural Airbus A350-1000 (British Airways). Nose +Z, up +Y, span along X, metres.
 * Construído pelo builder comum `createAirliner`.
 */
export function createA350Model(): AircraftRuntime {
  return createAirliner(A350_SPEC);
}
