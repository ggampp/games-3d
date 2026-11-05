// Constrói a estrutura lógica de uma fase a partir dos dados declarativos de levels.js.
import {
  DEG, add, sub, scale, len, norm, cross, lerp3, linkAngles, viewBasis, rayHitsAABB, angDist,
} from './math.js';

export const BEAM_W = 1; // largura da viga
export const BEAM_T = 0.5; // espessura (abaixo da superfície de rolagem)
export const BALL_R = 0.28;
export const PITCH_MIN = 20 * DEG;
export const PITCH_MAX = 72 * DEG;

const UP = [0, 1, 0];

class Track {
  constructor(index, pts) {
    this.index = index;
    this.pts = pts;
    this.segs = [];
    this.length = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const l = len(sub(b, a));
      const fwd = norm(sub(b, a));
      let side = norm(cross(fwd, UP));
      if (len(side) < 0.5) side = [0, 0, 1];
      const up = cross(side, fwd);
      this.segs.push({ a, b, s0: this.length, l, fwd, side, up });
      this.length += l;
    }
  }

  /** Posição na superfície, tangente, normal e lateral para a distância s ao longo da viga. */
  at(s) {
    const segs = this.segs;
    let i = 0;
    while (i < segs.length - 1 && s > segs[i].s0 + segs[i].l) i++;
    const g = segs[i];
    const t = g.l > 0 ? Math.min(Math.max((s - g.s0) / g.l, 0), 1) : 0;
    return { pos: lerp3(g.a, g.b, t), fwd: g.fwd, up: g.up, side: g.side };
  }

  /** Direção "para fora" da viga em uma das pontas (0 = início, 1 = fim). */
  outward(end) {
    return end === 0 ? scale(this.segs[0].fwd, -1) : this.segs[this.segs.length - 1].fwd;
  }
}

function boxFrom(spec) {
  if (spec.min) return { min: spec.min, max: spec.max };
  const h = scale(spec.size, 0.5);
  return { min: sub(spec.c, h), max: add(spec.c, h) };
}

/** Ponto está escondido atrás de algum oclusor na vista dada? */
export function isHidden(p, basis, occluders) {
  for (const box of occluders) if (rayHitsAABB(p, basis.d, box)) return true;
  return false;
}

const GAP_SAMPLES = [0.22, 0.36, 0.5, 0.64, 0.78];

export function buildLevel(data) {
  const tracks = data.tracks.map((t, i) => new Track(i, t.pts));
  const ports = [];
  data.tracks.forEach((t, i) => {
    const tr = tracks[i];
    [0, 1].forEach((end) => {
      const type = end === 0 ? t.start ?? 'cap' : t.end ?? 'cap';
      ports.push({
        id: ports.length,
        track: i,
        end,
        type,
        pos: end === 0 ? tr.pts[0] : tr.pts[tr.pts.length - 1],
        out: tr.outward(end),
        gap: null,
      });
    });
  });
  const portOf = (track, end) => ports[track * 2 + end];

  const occluders = (data.blocks ?? []).map(boxFrom);
  for (const p of data.pillars ?? []) {
    occluders.push({
      min: [p.x - BEAM_W / 2, p.bottom, p.z - BEAM_W / 2],
      max: [p.x + BEAM_W / 2, p.top, p.z + BEAM_W / 2],
    });
  }

  const gaps = (data.gaps ?? []).map((g, i) => {
    const a = portOf(g[0][0], g[0][1]);
    const b = portOf(g[1][0], g[1][1]);
    const gap = { id: i, a, b, length: len(sub(b.pos, a.pos)), view: null };
    a.gap = gap;
    b.gap = gap;
    return gap;
  });

  const start = ports.find((p) => p.type === 'start');
  const goal = ports.find((p) => p.type === 'goal');
  if (!start || !goal) throw new Error(`fase ${data.id}: precisa de 'start' e 'goal'`);

  // Pares de pontas abertas que podem se alinhar na tela.
  const open = ports.filter((p) => p.type === 'open' && !p.gap);
  const links = [];
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const ang = linkAngles(open[i].pos, open[j].pos);
      if (!ang || ang.pitch < PITCH_MIN || ang.pitch > PITCH_MAX) continue;
      links.push({ id: links.length, a: open[i], b: open[j], ...ang });
    }
  }

  const level = {
    data, tracks, ports, gaps, links, occluders, start, goal,
    camera: { yaw: (data.camera?.yaw ?? 30) * DEG, pitch: (data.camera?.pitch ?? 30) * DEG },
  };

  // Para cada buraco, procura a vista "central" da região em que ele fica escondido:
  // vira um ponto de encaixe para a câmera, como as ligações.
  for (const gap of gaps) gap.view = findGapView(level, gap);
  return level;
}

export function gapPoint(gap, t) {
  return add(lerp3(gap.a.pos, gap.b.pos, t), [0, BALL_R, 0]);
}

export function gapHidden(level, gap, basis) {
  return GAP_SAMPLES.every((t) => isHidden(gapPoint(gap, t), basis, level.occluders));
}

function findGapView(level, gap) {
  const ok = [];
  for (let p = PITCH_MIN; p <= PITCH_MAX + 1e-9; p += 2 * DEG) {
    for (let y = -Math.PI; y < Math.PI; y += 2 * DEG) {
      if (gapHidden(level, gap, viewBasis(y, p))) ok.push([y, p]);
    }
  }
  if (!ok.length) return null;
  // Ponto da região mais longe da borda (aprox.: o que tem mais vizinhos válidos num raio).
  let best = null;
  let bestScore = -1;
  for (const [y, p] of ok) {
    let score = 0;
    for (const [y2, p2] of ok) if (angDist(y, p, y2, p2) < 9 * DEG) score++;
    if (score > bestScore) {
      bestScore = score;
      best = { yaw: y, pitch: p };
    }
  }
  return best;
}

export function levelBounds(level) {
  const pts = [];
  for (const t of level.tracks) pts.push(...t.pts);
  for (const o of level.occluders) {
    for (const x of [o.min[0], o.max[0]]) {
      for (const y of [o.min[1], o.max[1]]) for (const z of [o.min[2], o.max[2]]) pts.push([x, y, z]);
    }
  }
  pts.push(add(level.start.pos, [0, 1.8, 0]));
  const min = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
  const max = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const center = scale(add(min, max), 0.5);
  // Raio da esfera que contém tudo (a vista gira em torno do centro), com folga de viga.
  const radius = Math.max(...pts.map((p) => len(sub(p, center)))) + BEAM_W;
  return { min, max, center, radius };
}
