import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import { buildLevel } from '../src/core/level.js';
import { ViewController } from '../src/core/view.js';
import { Ball } from '../src/core/ball.js';
import { DEG, linkAngles, screenDist, viewBasis, rayHitsAABB } from '../src/core/math.js';

test('linkAngles alinha os dois pontos na tela', () => {
  const a = [4, 3, 0];
  const b = [4, 0, 3];
  const ang = linkAngles(a, b);
  assert.ok(Math.abs(ang.pitch - 45 * DEG) < 1e-9);
  assert.ok(screenDist(a, b, viewBasis(ang.yaw, ang.pitch)) < 1e-9);
  assert.ok(screenDist(a, b, viewBasis(ang.yaw + 0.1, ang.pitch)) > 0.1);
});

test('rayHitsAABB', () => {
  const box = { min: [-1, -1, 4], max: [1, 1, 6] };
  assert.equal(rayHitsAABB([0, 0, 0], [0, 0, 1], box), true);
  assert.equal(rayHitsAABB([0, 0, 0], [0, 0, -1], box), false);
  assert.equal(rayHitsAABB([3, 0, 0], [0, 0, 1], box), false);
});

/** Busca em largura no grafo de pontas: trilho, ligações e vãos. */
function solve(level) {
  const edges = new Map(level.ports.map((p) => [p.id, []]));
  for (const p of level.ports) edges.get(p.id).push({ to: level.ports[p.track * 2 + (1 - p.end)], via: 'track' });
  for (const l of level.links) {
    edges.get(l.a.id).push({ to: l.b, via: l });
    edges.get(l.b.id).push({ to: l.a, via: l });
  }
  for (const g of level.gaps) {
    edges.get(g.a.id).push({ to: g.b, via: g });
    edges.get(g.b.id).push({ to: g.a, via: g });
  }
  // Estado = (ponta, chegou pelo trilho?) — depois de atravessar um trilho é preciso pular.
  const key = (p, t) => `${p.id}:${t}`;
  const prev = new Map([[key(level.start, false), null]]);
  const queue = [[level.start, false]];
  while (queue.length) {
    const [p, viaTrack] = queue.shift();
    if (p === level.goal) {
      const steps = [];
      let k = key(p, viaTrack);
      while (prev.get(k)) {
        const { from, edge } = prev.get(k);
        steps.unshift({ from: from[0], ...edge });
        k = key(...from);
      }
      return steps;
    }
    const options = [...edges.get(p.id)];
    // Batente ou lampião: a bola volta pelo mesmo trilho até a outra ponta.
    if (viaTrack && (p.type === 'cap' || p.type === 'start')) {
      const back = level.ports[p.track * 2 + (1 - p.end)];
      const k = key(back, true);
      if (!prev.has(k)) {
        prev.set(k, { from: [p, viaTrack], edge: { to: back, via: 'track' } });
        queue.push([back, true]);
      }
    }
    for (const e of options) {
      const isTrack = e.via === 'track';
      if (isTrack === viaTrack) continue; // alterna: trilho, salto, trilho...
      const k = key(e.to, isTrack);
      if (prev.has(k)) continue;
      prev.set(k, { from: [p, viaTrack], edge: e });
      queue.push([e.to, isTrack]);
    }
  }
  return null;
}

function simulate(level, chooseView, seconds = 40) {
  const view = new ViewController(level);
  const ball = new Ball(level);
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    chooseView(view, ball);
    ball.update(dt, view);
    if (ball.state === 'ready') ball.release();
    if (ball.state === 'won') return { won: true, falls: ball.falls, time: t };
    if (ball.falls > 0) return { won: false, falls: ball.falls, time: t };
  }
  return { won: false, falls: ball.falls, time: seconds };
}

for (const data of LEVELS) {
  test(`fase ${data.id} "${data.name}": tem solução e o oráculo a executa`, () => {
    const level = buildLevel(data);
    const steps = solve(level);
    assert.ok(steps, 'sem caminho do lampião até o pino');
    const jumps = steps.filter((s) => s.via !== 'track');
    for (const j of jumps) {
      if (j.via.a && j.via.yaw === undefined) assert.ok(j.via.view, `vão ${j.via.id} nunca fica escondido`);
    }
    // Oráculo: olha para a próxima ponta à frente da bola e ajusta a vista para o salto dela.
    const res = simulate(level, (view, ball) => {
      if (ball.state !== 'rolling') return;
      const port = level.ports[ball.track * 2 + (ball.dir > 0 ? 1 : 0)];
      const j = jumps.find((s) => s.from === port);
      if (!j) return;
      const v = j.via.yaw !== undefined ? j.via : j.via.view;
      view.set(v.yaw, v.pitch);
    });
    assert.ok(res.won, `oráculo não venceu (quedas: ${res.falls}, t=${res.time.toFixed(1)}s)`);
  });

  test(`fase ${data.id}: a vista inicial sozinha não resolve`, () => {
    const level = buildLevel(data);
    const res = simulate(level, () => {});
    assert.equal(res.won, false);
  });
}

test('vista gruda no encaixe e ligação ativa', () => {
  const level = buildLevel(LEVELS[0]);
  const view = new ViewController(level);
  const link = level.links[0];
  view.rawYaw = link.yaw + 2 * DEG;
  view.rawPitch = link.pitch - 1 * DEG;
  for (let i = 0; i < 120; i++) view.update(1 / 60);
  assert.ok(view.isLinkActive(link));
  view.rotate(20 * DEG, 0);
  for (let i = 0; i < 120; i++) view.update(1 / 60);
  assert.equal(view.isLinkActive(link), false);
});
