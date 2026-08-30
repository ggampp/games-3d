import * as THREE from 'three';

function continentBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  rotation = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Earth canvas failed');

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, '#cfe6f4');
  ocean.addColorStop(0.12, '#0b4f86');
  ocean.addColorStop(0.5, '#083a68');
  ocean.addColorStop(0.88, '#0b4f86');
  ocean.addColorStop(1, '#cfe6f4');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const land = '#3d6b3a';
  const desert = '#b39a63';
  const ice = '#eef3f7';
  const lon = (deg: number) => ((deg + 180) / 360) * width;
  const lat = (deg: number) => ((90 - deg) / 180) * height;

  continentBlob(ctx, lon(-58), lat(-12), 170, 210, land, 0.35);
  continentBlob(ctx, lon(-70), lat(-38), 90, 140, land, 0.5);
  continentBlob(ctx, lon(-100), lat(45), 280, 120, land, -0.2);
  continentBlob(ctx, lon(-104), lat(24), 90, 60, desert, 0.1);
  continentBlob(ctx, lon(20), lat(8), 180, 230, land, 0.15);
  continentBlob(ctx, lon(10), lat(22), 90, 70, desert, 0);
  continentBlob(ctx, lon(15), lat(52), 140, 70, land, -0.1);
  continentBlob(ctx, lon(90), lat(55), 260, 90, land, 0.05);
  continentBlob(ctx, lon(80), lat(22), 160, 90, desert, 0.1);
  continentBlob(ctx, lon(135), lat(-25), 140, 90, desert, 0.4);
  continentBlob(ctx, lon(175), lat(-42), 40, 70, land, 0.6);
  ctx.fillStyle = ice;
  ctx.fillRect(0, 0, width, 70);
  ctx.fillRect(0, height - 80, width, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
