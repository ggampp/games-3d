import * as THREE from 'three';
import { createAirliner, type AircraftRuntime, type AirlinerSpec } from './airliner';

/** Deriva "Skywatch": azul-marinho com chevron âmbar. */
function skywatchFinTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Fin canvas failed');
  ctx.fillStyle = '#1f3a5f';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#e8b86d';
  ctx.beginPath();
  ctx.moveTo(60, 512);
  ctx.lineTo(240, 512);
  ctx.lineTo(470, 90);
  ctx.lineTo(330, 90);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7ec8c8';
  ctx.beginPath();
  ctx.moveTo(250, 512);
  ctx.lineTo(330, 512);
  ctx.lineTo(512, 180);
  ctx.lineTo(512, 90);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Faixa lateral: âmbar sobre azul-petróleo, afinando para trás. */
function skywatchStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Stripe canvas failed');
  ctx.fillStyle = '#7ec8c8';
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(900, 30);
  ctx.lineTo(1024, 64);
  ctx.lineTo(900, 100);
  ctx.lineTo(0, 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8b86d';
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(880, 44);
  ctx.lineTo(960, 64);
  ctx.lineTo(880, 84);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Airbus A320neo em pintura fictícia "Skywatch" (branco, barriga azul-marinho, faixa âmbar). */
export const A320_SPEC: AirlinerSpec = {
  name: 'A320neo-Skywatch',
  length: 37.57,
  wingspan: 35.8,
  fuselageRadius: 1.98,
  noseFraction: 0.1,
  tailFraction: 0.26,
  wing: {
    halfSpan: 16.3,
    rootChord: 6.1,
    tipChordRatio: 0.28,
    sweepBack: 5.9,
    dihedral: 1.3,
    rootZ: -0.6,
    rootY: -0.55,
    thickness: 0.28,
  },
  engine: { radius: 1.05, length: 3.7, x: 5.75, y: -1.75, z: 1.5, blades: 16 },
  tail: {
    finHeight: 5.9,
    finRootChord: 6.6,
    finTipChord: 2.2,
    finSweep: 3.9,
    finThickness: 0.38,
    hStabHalfSpan: 6.2,
    hStabRootChord: 3.2,
    hStabTipChord: 1.2,
    hStabSweep: 2.5,
    hStabY: 0.55,
    hStabZ: -15.3,
    z: -11.6,
  },
  gear: { noseZ: 12.5, mainZ: -1.6, mainX: 3.8, strutLength: 2.2, wheelRadius: 0.55, mainWheels: 2 },
  cabin: { startZ: -11.5, endZ: 14, windowPitch: 0.85 },
  livery: {
    upper: '#f4f1ea',
    belly: '#1f3a5f',
    cheatline: '#e8b86d',
    wing: '#e4e0d6',
    engine: '#1f3a5f',
    fin: '#1f3a5f',
    finTexture: skywatchFinTexture,
    stripeTexture: skywatchStripeTexture,
    stripeLength: 17,
  },
};

export function createA320Model(): AircraftRuntime {
  return createAirliner(A320_SPEC);
}
