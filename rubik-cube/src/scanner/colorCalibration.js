/**
 * colorCalibration.js
 * Leitura das cores do cubo por visão computacional clássica, sem modelo de IA.
 *
 * Cada face tem o centro fixo (U branco, R vermelho, F verde, D amarelo, L laranja,
 * B azul). Os 6 centros fotografados servem de referência de cor sob a luz real da
 * foto. As 54 peças são então distribuídas entre as 6 cores com exatamente 9 peças
 * por cor, minimizando a diferença total de cor (atribuição ótima pelo método
 * húngaro). As referências são refinadas com a média das peças atribuídas e o
 * processo se repete até estabilizar.
 */

export const COLOR_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];

// Brilho pesa menos que o matiz: fotos de faces diferentes costumam ter luz diferente.
const LIGHTNESS_WEIGHT = 0.5;
const LOCKED_COST = 1e9;

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Converte [r, g, b] (0–255) para CIELAB (iluminante D65). */
export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labDistance(a, b) {
  const dL = (a[0] - b[0]) * LIGHTNESS_WEIGHT;
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Atribuição de custo mínimo (método húngaro) numa matriz quadrada n×n.
 * Devolve `assign[row] = col`.
 */
export function solveAssignment(cost) {
  const n = cost.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const assign = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) assign[p[j] - 1] = j - 1;
  }
  return assign;
}

function meanLab(list) {
  const sum = [0, 0, 0];
  for (const lab of list) {
    sum[0] += lab[0];
    sum[1] += lab[1];
    sum[2] += lab[2];
  }
  return sum.map((s) => s / list.length);
}

/**
 * Classifica as 54 peças a partir das amostras de cor das 6 fotos.
 *
 * @param {Object} samples { U: [[r,g,b] ×9], R: [...], F, D, L, B } na ordem 0–8 de cada face
 * @param {Object} [options]
 * @param {Object} [options.locked] { U: { 3: 'R' }, ... } cores corrigidas à mão, mantidas como estão
 * @param {number} [options.maxIterations]
 * @returns {{ faces: Object, uncertain: Object }}
 *   `faces` tem a grade 3×3 de cada face; `uncertain[face][i]` marca peças cuja cor
 *   ficou perto do limite entre duas cores e merece conferência.
 */
export function calibrateFaces(samples, { locked = {}, maxIterations = 8 } = {}) {
  for (const face of COLOR_ORDER) {
    if (!Array.isArray(samples[face]) || samples[face].length !== 9) {
      throw new Error(`Faltam as amostras de cor da face ${face}.`);
    }
  }

  const stickers = [];
  for (const face of COLOR_ORDER) {
    for (let i = 0; i < 9; i++) {
      let fixed = null;
      if (i === 4) fixed = face;
      else if (locked[face] && locked[face][i]) fixed = locked[face][i];
      stickers.push({ face, index: i, lab: rgbToLab(samples[face][i]), fixed });
    }
  }

  let refs = COLOR_ORDER.map((color) => rgbToLab(samples[color][4]));
  let labels = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    const cost = stickers.map((s) => {
      const row = new Array(54);
      for (let col = 0; col < 54; col++) {
        const color = COLOR_ORDER[Math.floor(col / 9)];
        if (s.fixed) row[col] = s.fixed === color ? 0 : LOCKED_COST;
        else row[col] = labDistance(s.lab, refs[Math.floor(col / 9)]);
      }
      return row;
    });

    const assign = solveAssignment(cost);
    const next = assign.map((col) => COLOR_ORDER[Math.floor(col / 9)]);
    const stable = labels && next.every((c, i) => c === labels[i]);
    labels = next;
    if (stable) break;

    refs = COLOR_ORDER.map((color, ci) => {
      const members = stickers.filter((_, i) => labels[i] === color).map((s) => s.lab);
      // O centro continua puxando a referência para não derivar para outra cor.
      return members.length ? meanLab([...members, stickers[ci * 9 + 4].lab]) : refs[ci];
    });
  }

  const faces = {};
  const uncertain = {};
  for (const face of COLOR_ORDER) {
    faces[face] = new Array(9);
    uncertain[face] = new Array(9).fill(false);
  }

  stickers.forEach((s, i) => {
    const color = labels[i];
    faces[s.face][s.index] = color;
    if (s.fixed) return;
    const dists = refs.map((ref) => labDistance(s.lab, ref));
    const own = dists[COLOR_ORDER.indexOf(color)];
    const others = dists.filter((_, ci) => COLOR_ORDER[ci] !== color);
    const nearestOther = Math.min(...others);
    // Incerta se outra cor está quase tão perto (ou mais perto) quanto a escolhida.
    uncertain[s.face][s.index] = nearestOther < own * 1.35;
  });

  return { faces, uncertain };
}
