import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ProgressStore } from '../src/core/progress-store.js';
import { ROUTES } from '../tests/helpers/routes.js';
import { createHarness } from './browser-harness.js';

/** M4 E2E: full campaign 1→9, trophy, gallery, infinite separation and long composition (manual clock, software GPU). */
const harness = await createHarness({ defaultRunId: `m4-${Date.now()}`, port: '3193' });
const { runId, directory, captures, snapshot, step, until, replay, capture, context } = harness;
const reports = [], scope = process.env.TEST_SCOPE;
const LENGTHS = { 'level-01': 600, 'level-02': 750, 'level-03': 850, 'level-04': 950, 'level-05': 1100, 'level-06': 1200, 'level-07': 1300, 'level-08': 1400, 'level-09': 1500 };
const throughEight = new ProgressStore();
for (let n = 1; n <= 8; n++) throughEight.complete({ levelId: `level-0${n}`, score: 0, timeS: 40, eventId: `fixture-${n}` });
const eight = JSON.stringify(throughEight.data);
const garage = trainId => ({ acrobatic_train_bank_points: '0', acrobatic_train_unlocked_trains: JSON.stringify(['cyber', 'steam', 'class395']), acrobatic_train_current_train: trainId });
/** Counts oscillators actually started, to prove the mute path plays nothing. */
const countAudio = ctx => ctx.addInitScript(() => {
  window.__oscillators = 0;
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) { window.__oscillators += 1; return start.apply(this, args); };
});
const oscillators = page => page.evaluate(() => window.__oscillators);
const reloadAndContinue = async page => {
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__));
  await page.locator('#continue-campaign-btn').click(); await page.locator('#briefing-start-btn').click();
};

try {
  await harness.start();
  if (!scope || scope === 'campaign') {
    // M4-T02/T03/T04: new save, free train, API offline, reloads at 3 and 6, trophy, focus, mute, retry, gallery, infinite.
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } });
    await countAudio(ctx); await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__));
    await page.locator('#continue-campaign-btn').click(); await page.locator('#briefing-start-btn').click();
    const bank = (await snapshot(page)).shop.bank, path19 = [];
    for (let n = 1; n <= 9; n++) {
      const id = `level-0${n}`;
      if (n === 9) {
        await page.locator('#sound-btn').click(); assert.equal((await snapshot(page)).soundOn, false);
      }
      const before = await oscillators(page);
      const result = await replay(page, ROUTES[id], LENGTHS[id]);
      assert.equal(result.levelId, id); assert.equal(result.currentTrainId, 'cyber');
      path19.push({ id, timeS: result.timeS, score: result.score, unlocked: result.progress.highestUnlockedLevel, oscillators: await oscillators(page) - before });
      if (n < 9) {
        assert.deepEqual(result.progress.achievements, [], `no trophy after ${id}`);
        if (n === 3 || n === 6) await reloadAndContinue(page);
        else { await page.locator('#level-next-btn').click(); await page.locator('#briefing-start-btn').click(); }
      }
    }
    const final = await snapshot(page);
    assert.deepEqual(final.progress.achievements, ['campaign-9-complete']); assert.equal(Object.keys(final.progress.results).length, 9);
    assert.equal(final.shop.owned.length, 1); assert.ok(final.shop.bank >= bank, 'no purchase required, balance only grows');
    assert.equal(await page.locator('#level-result-title').textContent(), 'CAMPANHA COMPLETA!');
    assert.equal(await page.locator('#campaign-trophy').isVisible(), true); assert.equal(await page.locator('#level-next-btn').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'level-infinite-btn', 'focus lands on the first action of the final screen');
    assert.ok(path19.slice(0, 8).some(p => p.oscillators > 0), 'audio counter works while sound is on');
    assert.equal(path19[8].oscillators, 0, 'muted fanfare plays nothing');
    await capture(page, 'm4-desktop-campaign-complete');
    await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.closest('#level-result-modal') !== null));
    // Retry the final: still exactly one trophy, message says it already exists.
    await page.locator('#level-retry-btn').click(); const retried = await replay(page, ROUTES['level-09'], LENGTHS['level-09']);
    assert.deepEqual(retried.progress.achievements, ['campaign-9-complete']); assert.equal(retried.progress.results['level-09'].completions, 2);
    assert.match(await page.locator('#campaign-trophy-text').textContent(), /já conquistado/);
    await page.locator('#level-menu-btn').click();
    assert.match(await page.locator('#campaign-gallery-trophy').textContent(), /Troféu da campanha conquistado/);
    assert.equal(await page.locator('#campaign-gallery-list li').count(), 9); await capture(page, 'm4-desktop-gallery');
    // M4-T05: infinite from the final screen does not touch official progress.
    await page.evaluate(() => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.chooseLevel('level-09'); hooks.startLevel('level-09'); });
    await replay(page, ROUTES['level-09'], LENGTHS['level-09']);
    const saved = (await snapshot(page)).progress;
    await page.locator('#level-infinite-btn').click();
    const infinite = await snapshot(page); assert.equal(infinite.levelId, null); assert.equal(infinite.mode, 'playing');
    await step(page, 600); assert.deepEqual((await snapshot(page)).progress, saved);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__));
    assert.deepEqual((await snapshot(page)).progress.achievements, ['campaign-9-complete'], 'trophy persists after reload');
    assert.deepEqual(errors, []);
    reports.push({ scenario: 'm4-desktop-campaign-1-9', passed: true, levels: path19, retryKeepsOneTrophy: true, galleryItems: 9, infiniteLeavesProgress: true, mutedFinalOscillators: 0, pageErrors: errors });
    await ctx.close();
  }
  if (!scope || scope === 'touch') {
    const { ctx, page, errors } = await context({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, eight);
    await page.locator('#continue-campaign-btn').tap(); assert.match(await page.locator('#briefing-title').textContent(), /FASE 9/);
    await page.locator('#briefing-start-btn').tap();
    await until(page, 30); await capture(page, 'm4-portrait-final-start');
    const result = await replay(page, ROUTES['level-09'], LENGTHS['level-09'], true);
    assert.deepEqual(result.progress.achievements, ['campaign-9-complete']);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'level-infinite-btn');
    await capture(page, 'm4-portrait-campaign-complete'); assert.deepEqual(errors, []);
    reports.push({ scenario: 'm4-portrait-final', passed: true, pageErrors: errors }); await ctx.close();
  }
  if (!scope || scope === 'long-train') {
    // M4-T06: the 12-car Class 395 and the steam train (smoke) on the hard phases.
    const samples = {}, runs = [];
    for (const trainId of ['class395', 'steam']) {
      const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } }, eight, false, garage(trainId));
      assert.equal((await snapshot(page)).shop.selected, trainId);
      for (let cycle = 0; cycle < (trainId === 'class395' ? 12 : 6); cycle++) for (const id of ['level-07', 'level-08', 'level-09']) {
        await page.evaluate(id => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel(id); hooks.startLevel(id); hooks.step(240); }, id);
        const s = await snapshot(page);
        if (trainId === 'class395') assert.ok(s.track[0].s0 <= -11 * 9.9, `tail of 12 cars has track: ${s.track[0].s0}`);
        const before = s.renderedFrames;
        await page.waitForFunction(n => window.__TRAIN_TEST_HOOKS__.snapshot().renderedFrames >= n + 3, before, { timeout: 180000 });
        if (cycle >= 2) ((samples[trainId] ||= {})[id] ||= []).push((await snapshot(page)).memory);
      }
      for (const [id, values] of Object.entries(samples[trainId])) assert.ok(values.every(v => v.geometries === values[0].geometries && v.textures === values[0].textures), `${trainId}/${id}: ${JSON.stringify(values)}`);
      await page.evaluate(() => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel('level-09'); hooks.startLevel('level-09'); });
      const done = await replay(page, ROUTES['level-09'], LENGTHS['level-09']);
      assert.equal(done.currentTrainId, trainId); assert.equal(done.carriages, trainId === 'class395' ? 11 : 1);
      // Frame-time sample at the densest point (software GPU: documents cost, not hardware budget).
      await page.evaluate(() => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel('level-09'); hooks.startLevel('level-09'); hooks.step(60 * 9); });
      const a = await snapshot(page), t0 = Date.now(); await page.waitForTimeout(10000); const b = await snapshot(page);
      runs.push({ trainId, finalLevel: done.mode, carriages: done.carriages, softwareFps: +((b.renderedFrames - a.renderedFrames) / ((Date.now() - t0) / 1000)).toFixed(2), memory: b.memory });
      if (trainId === 'class395') await capture(page, 'm4-class395-final');
      assert.deepEqual(errors, []); await ctx.close();
    }
    await fs.writeFile(path.join(directory, 'resources.json'), JSON.stringify(samples, null, 2));
    reports.push({ scenario: 'm4-long-train-resources', passed: true, runs, pageErrors: [] });
  }
  await fs.writeFile(path.join(directory, 'browser-results.json'), JSON.stringify({ runId, generatedAt: new Date().toISOString(), reports,
    limitation: 'Software GPU (SwiftShader) and manual test clock: softwareFps documents relative cost only. Hardware frame-time budgets, human playtest and screen readers unverified.' }, null, 2));
  console.log(JSON.stringify({ directory, captures, reports }, null, 2));
} finally { await harness.close(); }
