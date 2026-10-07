import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocket } from 'ws';
import { ROUTES } from '../tests/helpers/routes.js';
import { createHarness } from './browser-harness.js';

/** M5 E2E: two real browser clients against the real room server (real time, simulated RTT/jitter in the client link). */
process.env.ROOM_STATS = '1';
const harness = await createHarness({ defaultRunId: `m5-${Date.now()}`, port: '3194' });
const { url, runId, directory, captures, snapshot, capture, context } = harness;
const reports = [], scope = process.env.TEST_SCOPE;
const online = page => page.evaluate(() => window.__TRAIN_TEST_HOOKS__.online());
const stats = async () => (await fetch(`${url}/api/rooms/stats`)).json();
const SMALL = { viewport: { width: 640, height: 360 } };

const SOLO = { campaign: '{"schemaVersion":1}', bank: '777' };
async function player(name, network, route) {
  const { ctx, page, errors } = await context(SMALL);
  await ctx.addInitScript(({ network, route, solo }) => {
    window.__TRAIN_TEST_CONFIG__.network = network; window.__TRAIN_ONLINE_ROUTE__ = route;
    localStorage.setItem('acrobatic_train_campaign_v1', solo.campaign); localStorage.setItem('acrobatic_train_bank_points', solo.bank);
  }, { network, route, solo: SOLO });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__), null, { timeout: 120000 });
  await page.locator('#start-online-btn').click(); await page.locator('#online-name').fill(name);
  return { ctx, page, errors, name };
}
async function waitFor(page, fn, arg, timeout = 180000) { return page.waitForFunction(fn, arg, { timeout, polling: 250 }); }

/** One race: A creates the room, B joins, both ready; returns both views of the authoritative result. */
async function race({ label, levelId, network, routeA, routeB, extra }) {
  const solo = SOLO, a = await player('Ana', network, routeA), b = await player('Bia', network, routeB);
  await a.page.locator('#online-level').selectOption(levelId); await a.page.locator('#online-create-btn').click();
  await waitFor(a.page, () => document.getElementById('online-room-code').textContent.length === 5);
  const code = await a.page.locator('#online-room-code').textContent();
  await b.page.locator('#online-code').fill(code); await b.page.locator('#online-join-btn').click();
  await waitFor(a.page, () => document.querySelectorAll('#online-players li').length === 2);
  const third = await extra?.beforeReady?.(code);
  await capture(a.page, `${label}-lobby`);
  await a.page.locator('#online-ready-btn').click(); await b.page.locator('#online-ready-btn').click();
  await waitFor(a.page, () => window.__TRAIN_TEST_HOOKS__.online()?.race?.startAt > 0);
  const startA = (await online(a.page)).race, startB = (await online(b.page)).race;
  assert.equal(startA.startAt, startB.startAt); assert.equal(startA.runId, startB.runId);
  // Mid-race: opponent ghost rendered; optional local overlays must not touch the room.
  await waitFor(a.page, () => window.__TRAIN_TEST_HOOKS__.snapshot().dist > 120).catch(async error => {
    for (const p of [a, b]) console.error(p.name, JSON.stringify(await p.page.evaluate(() => { const k = window.__TRAIN_TEST_HOOKS__, s = k.snapshot(), o = k.online(); return { mode: s.mode, tick: s.tick, dist: s.dist, reason: s.reason, levelId: s.levelId, race: o?.race && { ...o.race, result: o.race.result?.reason } }; })), p.errors);
    throw error;
  });
  const ghostSeen = await waitFor(a.page, () => window.__TRAIN_TEST_HOOKS__.online().race.ghostVisible === true, null, 60000).then(() => true, () => false);
  const mid = await extra?.midRace?.(a, b);
  await capture(a.page, `${label}-racing`);
  await waitFor(a.page, () => window.__TRAIN_TEST_HOOKS__.online()?.race?.result); await waitFor(b.page, () => window.__TRAIN_TEST_HOOKS__.online()?.race?.result);
  const ra = (await online(a.page)).race, rb = (await online(b.page)).race;
  assert.deepEqual(ra.result, rb.result, 'both clients show the same authoritative result');
  await a.page.locator('#online-result-modal').waitFor({ state: 'visible' }); await capture(a.page, `${label}-result`);
  for (const p of [a, b]) {
    const s = await snapshot(p.page);
    assert.equal(await p.page.evaluate(() => localStorage.getItem('acrobatic_train_campaign_v1')), solo.campaign, 'solo save untouched');
    assert.equal(s.shop.bank, Number(solo.bank), 'online pickups never credit the shop');
    assert.deepEqual(p.errors, []);
  }
  const metrics = side => ({ lead: side.lead, inputs: side.inputs, corrections: side.corrections, maxCorrection: +side.maxCorrection.toFixed(3), distDrift: +side.distDrift.toFixed(4), crashMismatch: side.crashMismatch, maxExtrapolatedMs: Math.round(side.maxExtrapolatedMs), staleFrames: side.staleFrames, errors: side.errors });
  const result = { label, levelId, network, result: { reason: ra.result.reason, winner: ra.result.winner === (await online(a.page)).me ? 'Ana' : ra.result.winner ? 'Bia' : null, draw: ra.result.draw, players: ra.result.players.map(p => ({ name: p.name, state: p.state, endTick: p.endTick, dist: +p.dist.toFixed(2) })) },
    clients: { Ana: metrics(ra), Bia: metrics(rb) }, ghostSeen, third, mid };
  await a.page.locator('#online-menu-btn').click(); await b.page.locator('#online-menu-btn').click();
  await a.ctx.close(); await b.ctx.close();
  return result;
}

try {
  await harness.start();
  if (!scope || scope === 'race') {
    const profiles = [
      { label: 'm5-rtt50', levelId: 'level-04', network: { rttMs: 50, jitterMs: 0 }, routeA: ROUTES['level-04'], routeB: ROUTES['level-04'], expect: { reason: 'finish-tie', winner: null } },
      { label: 'm5-rtt150', levelId: 'level-06', network: { rttMs: 150, jitterMs: 25 }, routeA: ROUTES['level-06'], routeB: [], expect: { reason: 'finish', winner: 'Ana' } },
      { label: 'm5-rtt300', levelId: 'level-09', network: { rttMs: 300, jitterMs: 50 }, routeA: [], routeB: ROUTES['level-09'], expect: { reason: 'finish', winner: 'Bia' } },
    ];
    for (const profile of profiles) {
      const extra = profile.label === 'm5-rtt50' ? {
        // M5-T01: a third browser and an outdated client are refused.
        beforeReady: async code => {
          const c = await player('Caio', profile.network, []);
          await c.page.locator('#online-code').fill(code); await c.page.locator('#online-join-btn').click();
          await waitFor(c.page, () => /dois jogadores/.test(document.getElementById('online-status').textContent));
          const status = await c.page.locator('#online-status').textContent(); await c.ctx.close();
          const legacy = await new Promise(resolve => {
            const ws = new WebSocket(`${url.replace('http', 'ws')}/ws`);
            ws.on('open', () => ws.send(JSON.stringify({ v: 0, type: 'join', name: 'velho', room: code })));
            ws.on('message', data => { resolve(JSON.parse(data).code); ws.close(); });
          });
          assert.equal(legacy, 'version');
          return { thirdBrowser: status, legacyClient: legacy };
        },
        // M5-T06: pause, shop and train cycling are refused online; the room keeps running.
        midRace: async a => {
          const before = await snapshot(a.page);
          for (const key of ['KeyP', 'KeyB', 'KeyT']) await a.page.keyboard.press(key);
          await a.page.waitForTimeout(1500);
          const after = await snapshot(a.page);
          assert.equal(after.mode, 'playing'); assert.ok(after.tick > before.tick + 30, 'simulation kept running');
          assert.equal(after.currentTrainId, 'cyber'); assert.equal(await a.page.locator('#store-modal').isVisible(), false);
          return { overlaysRefused: true, ticksDuringAttempt: after.tick - before.tick };
        },
      } : undefined;
      const r = await race({ ...profile, extra });
      assert.equal(r.result.reason, profile.expect.reason, JSON.stringify(r.result)); assert.equal(r.result.winner, profile.expect.winner);
      for (const side of Object.values(r.clients)) { assert.equal(side.distDrift, 0, 'distance prediction is exact'); assert.equal(side.crashMismatch, 0); }
      reports.push({ scenario: profile.label, passed: true, ...r });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    const after = await stats(); assert.equal(after.sockets, 0, 'all sockets released'); assert.equal(after.connections, 0);
    reports.push({ scenario: 'm5-cleanup', passed: true, stats: after, note: 'Rooms in result state live for the 2-minute result TTL, then close (unit-tested).' });
  }
  await fs.writeFile(path.join(directory, 'browser-results.json'), JSON.stringify({ runId, generatedAt: new Date().toISOString(), reports,
    limitation: 'Two Chromium contexts on one machine, software GPU (~1–2 FPS render) and client-side simulated RTT/jitter (FIFO). Real networks, mobile radios and hardware input latency unverified.' }, null, 2));
  console.log(JSON.stringify({ directory, captures, reports }, null, 2));
} finally { await harness.close(); }
