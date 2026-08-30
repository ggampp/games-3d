import * as THREE from 'three';

const CACHE = new Map<string, THREE.MeshStandardMaterial>();
const TEX = new Map<string, THREE.CanvasTexture>();

function speckled(hex: string, specks: string, seed: number): THREE.CanvasTexture {
  const key = `${hex}:${specks}:${seed}`;
  const hit = TEX.get(key);
  if (hit) return hit;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i += 1) {
    const t = (seed * 17 + i * 13) % size;
    const u = (seed * 29 + i * 11) % size;
    ctx.fillStyle = i % 3 === 0 ? specks : 'rgba(255,255,255,0.12)';
    ctx.fillRect(t, u, 1 + (i % 2), 1 + (i % 2));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  TEX.set(key, texture);
  return texture;
}

export function std(
  color: string,
  opts?: {
    roughness?: number;
    metalness?: number;
    transparent?: boolean;
    opacity?: number;
    specks?: string;
    seed?: number;
    emissive?: string;
    emissiveIntensity?: number;
  },
): THREE.MeshStandardMaterial {
  const key = `${color}:${opts?.opacity ?? 1}:${opts?.specks ?? ''}:${opts?.seed ?? 0}:${opts?.roughness ?? 0.78}:${opts?.metalness ?? 0.04}:${opts?.emissive ?? ''}:${opts?.emissiveIntensity ?? 0}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.78,
    metalness: opts?.metalness ?? 0.04,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    emissive: opts?.emissive ?? '#000000',
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    map: opts?.specks ? speckled(color, opts.specks, opts.seed ?? 1) : null,
  });
  CACHE.set(key, material);
  return material;
}

export function glow(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.08,
    emissive: color,
    emissiveIntensity: 0.85,
  });
}
