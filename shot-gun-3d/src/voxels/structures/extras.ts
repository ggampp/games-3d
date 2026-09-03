import { Builder } from '../builder.ts';
import { VOXEL_SIZE as V } from '../types.ts';
import { textRows, textWidth } from '../font.ts';

/** Placa de rua em poste com o nome da vila. */
export function buildSign(b: Builder, text: string): void {
  b.post(0, 0, 0, 2.1, 0.12);
  const rows = textRows(text);
  const tw = textWidth(text) * V;
  b.box(-tw / 2 - 0.12, 1.5, 0.06, tw / 2 + 0.12, 1.98, 0.06, 'plank');
  b.ascii(rows, -tw / 2, 1.92, 0.12, { '#': 'wood' });
  b.box(-0.06, 1.98, 0, 0.06, 2.1, 0.12, 'wood');
}

/** Varal entre dois postes: corda de aço fino com panos de "hay" (leves) pendurados. */
export function buildClothesline(b: Builder, length: number): void {
  const half = length / 2;
  b.post(-half, 0, 0, 2.0, 0.12);
  b.post(half, 0, 0, 2.0, 0.12);
  b.box(-half + 0.06, 1.86, 0, half - 0.06, 1.92, 0, 'steel');
  let i = 0;
  for (let x = -half + 0.5; x < half - 0.4; x += 0.7) {
    const g = `hang:cloth-${i}`;
    const w = 0.3 + (i % 2) * 0.12;
    b.box(x - w / 2, 1.2 + (i % 3) * 0.1, 0, x + w / 2, 1.86, 0, i % 2 === 0 ? 'hay' : 'plank', g);
    // elo de ligação: chain de 1 elo sob a corda
    b.add(x, 1.8, 0, 'steel', `chain:cloth-${i}`);
    b.add(x, 1.72, 0, 'steel', `chain:cloth-${i}`);
    i += 1;
  }
}

/** Tumbleweed: bola de feno solta que o "vento" empurra. */
export function buildTumbleweed(b: Builder, r: number, id: string): void {
  const n = Math.ceil(r / V);
  const g = `loose:tumble-${id}`;
  for (let dy = -n; dy <= n; dy++) {
    for (let dz = -n; dz <= n; dz++) {
      for (let dx = -n; dx <= n; dx++) {
        const d = Math.hypot(dx, dy, dz) * V;
        if (d > r || d < r - V * 1.2) continue;
        if ((dx + dy * 3 + dz * 5) % 3 === 0) continue; // furos
        b.add(dx * V, r + dy * V, dz * V, 'hay', g);
      }
    }
  }
}

/** Cerca de perímetro em arco (segmentos retos), sem fechar tudo. */
export function buildFenceArc(b: Builder, radius: number, a0: number, a1: number): void {
  const step = 1.2;
  const len = radius * (a1 - a0);
  const n = Math.max(2, Math.round(len / step));
  let px = 0, pz = 0;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    b.post(x, z, 0, 0.9, 0.12);
    if (i > 0) {
      // ripas retas entre postes (aproximação em voxels por passos)
      const segs = Math.ceil(Math.hypot(x - px, z - pz) / V);
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const sx = px + (x - px) * t;
        const sz = pz + (z - pz) * t;
        b.add(sx, 0.33, sz, 'plank');
        b.add(sx, 0.66, sz, 'plank');
      }
    }
    px = x; pz = z;
  }
}

/**
 * Alvo de galeria: placa de madeira com miolo, grupo `target:<id>`.
 * A física o trata como corpo cinemático que sobe e desce.
 */
export function buildTarget(b: Builder, id: string): void {
  const g = `target:${id}`;
  const w = 0.6;
  const h = 0.72;
  b.box(-w / 2, 0.9, 0, w / 2, 0.9 + h, 0, 'plank', g);
  b.box(-0.18, 1.08, -V, 0.18, 1.44, -V, 'brick', g);
  b.box(-0.06, 1.2, -V * 2, 0.06, 1.32, -V * 2, 'gold', g);
  b.box(-0.06, 0.12, 0, 0.06, 0.9, 0, 'steel', g);
}
