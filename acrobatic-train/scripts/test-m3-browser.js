import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ProgressStore } from '../src/core/progress-store.js';
import { ROUTES, OPEN_GATE_ROUTE } from '../tests/helpers/routes.js';
import { createHarness } from './browser-harness.js';

/** M3 E2E: phases 4–6 with real handlers, controls, meshes and HUD (manual clock, software GPU). */
const harness = await createHarness({ defaultRunId: `m3-${Date.now()}`, port: '3192' });
const { runId, directory, captures, snapshot, step, until, steer, replay, capture, context } = harness;
const reports = [], scope = process.env.TEST_SCOPE;
const unlocked = new ProgressStore();
for (const id of ['level-01', 'level-02', 'level-03']) unlocked.complete({ levelId: id, score: 0, timeS: 40, eventId: `fixture-${id}` });
const fixture = JSON.stringify(unlocked.data);
for (const id of ['level-04', 'level-05']) unlocked.complete({ levelId: id, score: 0, timeS: 40, eventId: `fixture-${id}` });
const throughFive = JSON.stringify(unlocked.data);
const hazards = async (page, family) => (await snapshot(page)).hazards.filter(h => !family || h.family === family);
const LENGTHS = { 'level-04': 950, 'level-05': 1100, 'level-06': 1200 };

try {
  await harness.start();
  if (!scope || scope === 'ui') for (const settings of [
    { label: 'm3-desktop', viewport: { width: 1366, height: 768 }, hasTouch: false },
    { label: 'm3-portrait', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  ]) {
    const { ctx, page, errors } = await context(settings, fixture), touch = settings.hasTouch;
    await page.locator('#start-game-btn').click();
    assert.equal(await page.locator('[data-level-id="level-04"]').isDisabled(), false);
    assert.equal(await page.locator('[data-level-id="level-05"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__TRAIN_TEST_HOOKS__.startLevel('level-05')), false);
    await page.locator('[data-level-id="level-04"]').click();
    assert.match(await page.locator('#briefing-description').textContent(), /cancela/i); await capture(page, `${settings.label}-briefing-4`);
    await page.locator('#briefing-start-btn').click();
    assert.equal((await hazards(page, 'gate')).length, 6);
    // F04-T01: the first gate is announced with its live state before the lane change.
    await until(page, 58); await page.waitForFunction(() => /^CANCELA NO CENTRO.* · (ABERTA|SINAL ATIVO)$/.test(document.getElementById('run-warning').textContent), null, { timeout: 180000 });
    await steer(page, 'front', -1, touch); await steer(page, 'rear', -1, touch);
    // F04-T03: a real pause freezes the cycle, boom angle and distance.
    if (touch) await page.locator('#pause-btn').tap(); else await page.keyboard.press('KeyP');
    const frozen = await snapshot(page); await step(page, 300); const after = await snapshot(page);
    assert.equal(after.mode, 'paused'); assert.deepEqual(after.hazards, frozen.hazards); assert.equal(after.dist, frozen.dist); assert.equal(after.timeS, frozen.timeS);
    await page.locator('#resume-btn').click();
    await until(page, 118); await page.waitForFunction(() => /FECHANDO|FECHADA/.test(document.getElementById('run-warning').textContent), null, { timeout: 180000 });
    const closing = (await hazards(page, 'gate')).find(g => g.id === 'gate-1:0');
    assert.ok(['closing', 'closed'].includes(closing.phase)); await capture(page, `${settings.label}-gate-closing`);
    const fourth = await replay(page, ROUTES['level-04'].slice(1), LENGTHS['level-04'], touch);
    assert.equal(fourth.progress.highestUnlockedLevel, 5);
    await page.locator('#level-next-btn').click(); assert.match(await page.locator('#briefing-title').textContent(), /FASE 5/);
    await page.locator('#briefing-start-btn').click(); assert.equal((await hazards(page, 'gantry')).length, 4);
    await until(page, ROUTES['level-05'][0].atM); await steer(page, 'front', 1, touch); await steer(page, 'rear', 1, touch);
    await until(page, 290); await capture(page, `${settings.label}-gantry`);
    const fifth = await replay(page, ROUTES['level-05'].slice(1), LENGTHS['level-05'], touch);
    assert.equal(fifth.progress.highestUnlockedLevel, 6);
    await page.locator('#level-next-btn').click(); assert.match(await page.locator('#briefing-title').textContent(), /FASE 6/);
    await page.locator('#briefing-start-btn').click(); assert.equal((await hazards(page, 'wagon')).length, 4);
    await until(page, 60); await steer(page, 'front', 1, touch); await steer(page, 'rear', 1, touch);
    await until(page, 128); const crossing = (await hazards(page, 'wagon')).find(w => w.id === 'wagon-1');
    assert.ok(['entering', 'blocking'].includes(crossing.phase)); assert.ok(crossing.movers[0].z > -9.5);
    await page.waitForFunction(() => /VAGÃO ⇢/.test(document.getElementById('run-warning').textContent), null, { timeout: 180000 }); await capture(page, `${settings.label}-wagon-crossing`);
    const sixth = await replay(page, ROUTES['level-06'].slice(1), LENGTHS['level-06'], touch);
    assert.equal(sixth.progress.highestUnlockedLevel, 7); assert.deepEqual(sixth.progress.achievements, []);
    // M4: phase 7 follows phase 6; phase 8 stays locked.
    assert.equal(await page.locator('#level-next-btn').isVisible(), true); await capture(page, `${settings.label}-result-6`);
    await page.locator('#level-menu-btn').click(); assert.equal(await page.locator('[data-level-id="level-07"]').isDisabled(), false);
    assert.equal(await page.locator('[data-level-id="level-08"]').isDisabled(), true);
    assert.deepEqual(errors, []);
    reports.push({ scenario: settings.label, passed: true, progression: [4, 5, 6], pauseFrozeHazards: true, pageErrors: errors }); await ctx.close();
  }
  if (!scope || scope === 'crash') {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } }, throughFive), results = [];
    for (const [id, pattern] of [['level-04', /cancela/i], ['level-05', /pórtico/i], ['level-06', /vagão/i]]) {
      assert.equal(await page.evaluate(id => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel(id); return hooks.startLevel(id); }, id), true);
      const crashed = await until(page, LENGTHS[id]); assert.equal(crashed.mode, 'crash');
      await step(page, 120); await page.locator('#gameover-modal').waitFor({ state: 'visible' });
      const reason = await page.locator('#gameover-reason').textContent(); assert.match(reason, pattern);
      results.push({ levelId: id, dist: crashed.dist, reason }); await capture(page, `m3-crash-${id}`);
    }
    await page.evaluate(() => window.__TRAIN_TEST_HOOKS__.menu());
    // F04-T05 in the real game: the open-window route crosses two open gates.
    await page.evaluate(() => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel('level-04'); hooks.startLevel('level-04'); });
    const open = await replay(page, OPEN_GATE_ROUTE, LENGTHS['level-04']);
    assert.equal(open.mode, 'levelComplete'); assert.deepEqual(errors, []);
    reports.push({ scenario: 'm3-crash-and-open-gates', passed: true, crashes: results, openGateRoute: 'levelComplete', pageErrors: errors }); await ctx.close();
  }
  if (!scope || scope === 'resources') {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } }, throughFive), samples = {};
    for (let cycle = 0; cycle < 15; cycle++) for (const id of ['level-04', 'level-05', 'level-06']) {
      await page.evaluate(id => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel(id); hooks.startLevel(id); hooks.step(240); }, id);
      const before = (await snapshot(page)).renderedFrames;
      await page.waitForFunction(n => window.__TRAIN_TEST_HOOKS__.snapshot().renderedFrames >= n + 3, before, { timeout: 180000 });
      if (cycle >= 5) (samples[id] ||= []).push((await snapshot(page)).memory);
    }
    for (const [id, values] of Object.entries(samples)) assert.ok(values.every(v => v.geometries === values[0].geometries && v.textures === values[0].textures), `${id} grows: ${JSON.stringify(values)}`);
    assert.deepEqual(errors, []); await fs.writeFile(path.join(directory, 'resources.json'), JSON.stringify(samples, null, 2));
    reports.push({ scenario: 'm3-resource-transitions', passed: true, transitions: 30, samples, pageErrors: errors }); await ctx.close();
  }
  await fs.writeFile(path.join(directory, 'browser-results.json'), JSON.stringify({ runId, generatedAt: new Date().toISOString(), reports,
    limitation: 'Software GPU (SwiftShader) and manual test clock. Human playtest, hardware FPS and screen readers unverified.' }, null, 2));
  console.log(JSON.stringify({ directory, captures, reports }, null, 2));
} finally { await harness.close(); }
