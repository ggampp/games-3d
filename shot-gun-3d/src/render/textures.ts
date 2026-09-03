import * as THREE from 'three';

const loader = new THREE.TextureLoader();

export type TexId = 'wood' | 'adobe' | 'sand' | 'steel' | 'sky' | 'brick' | 'hay';

function canvasFallback(kind: TexId): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const noise = (base: string, n: number, alpha: number, size = 3) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(20,10,4,${Math.random() * alpha})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, size, size);
    }
  };
  if (kind === 'sky') {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#8eb7d8');
    g.addColorStop(0.55, '#c5d8ea');
    g.addColorStop(1, '#efe6d2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  } else if (kind === 'wood') {
    ctx.fillStyle = '#8d5a32';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      ctx.fillStyle = y % 32 === 0 ? '#7a4a28' : '#a06a3c';
      ctx.fillRect(0, y, 128, 14);
    }
  } else if (kind === 'adobe') noise('#c8a57a', 220, 0.2, 4);
  else if (kind === 'sand') noise('#d2b48c', 400, 0.2, 2);
  else if (kind === 'brick') {
    ctx.fillStyle = '#c9b8a0';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      const off = (y / 16) % 2 === 0 ? 0 : 16;
      for (let x = -16; x < 128; x += 32) {
        ctx.fillStyle = '#a5533a';
        ctx.fillRect(x + off + 1, y + 1, 30, 14);
      }
    }
  } else if (kind === 'hay') noise('#d9b55a', 500, 0.25, 2);
  else {
    ctx.fillStyle = '#4e545c';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.03 + (y % 6) * 0.01})`;
      ctx.fillRect(0, y, 128, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function loadOrFallback(file: string, kind: TexId): THREE.Texture {
  const fallback = canvasFallback(kind);
  const url = `${import.meta.env.BASE_URL}assets/textures/${file}`;
  const tex = loader.load(
    url,
    (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
    },
    undefined,
    () => {
      tex.image = fallback.image;
      tex.needsUpdate = true;
    },
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function loadWorldTextures(): Record<TexId, THREE.Texture> {
  return {
    wood: loadOrFallback('wood.png', 'wood'),
    adobe: loadOrFallback('adobe.png', 'adobe'),
    sand: loadOrFallback('sand.png', 'sand'),
    steel: loadOrFallback('steel.png', 'steel'),
    brick: loadOrFallback('brick.png', 'brick'),
    hay: loadOrFallback('hay.png', 'hay'),
    sky: loadOrFallback('sky.jpg', 'sky'),
  };
}
