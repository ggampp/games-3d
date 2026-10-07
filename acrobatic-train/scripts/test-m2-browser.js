import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { ProgressStore, PROGRESS_KEY } from '../src/core/progress-store.js';
import { ROUTES, AIR_ROUTE, ZERO_SCORE_ROUTE } from '../tests/helpers/routes.js';
let playwright;
try { playwright = await import('playwright'); }
catch { if (!process.env.PLAYWRIGHT_MODULE_DIR) throw Error('Install Playwright or set PLAYWRIGHT_MODULE_DIR.'); playwright = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, 'package.json'))('playwright'); }
const port = process.env.TEST_PORT || '3191', url = `http://127.0.0.1:${port}`;
const runId = process.env.TEST_RUN_ID || `m2-${Date.now()}`, directory = path.resolve('artifacts/validation', runId);
await fs.mkdir(directory, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.js'], { env: { ...process.env, PORT: port }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let serverError = ''; server.stderr.on('data', data => { serverError += data.toString(); });
const reports = [], captures = []; let browser;
const snapshot = page => page.evaluate(() => window.__TRAIN_TEST_HOOKS__.snapshot());
const step = (page, ticks) => page.evaluate(n => window.__TRAIN_TEST_HOOKS__.step(n), ticks);
async function ready(page) { await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__)); }
async function steer(page, end, lane, touch) {
  const current = Math.round((await snapshot(page)).targets[end] / 3.4), direction = Math.sign(lane - current);
  for (let i = 0; i < Math.abs(lane - current); i++) {
    if (touch) await page.locator(`#touch-${end}-${direction > 0 ? 'right' : 'left'}`).tap();
    else await page.keyboard.press(end === 'front' ? direction > 0 ? 'KeyD' : 'KeyA' : direction > 0 ? 'ArrowRight' : 'ArrowLeft');
  }
}
async function until(page, atM) {
  for (let i = 0; i < 400; i++) { const s = await snapshot(page); if (s.dist >= atM || s.mode !== 'playing') return s; await step(page, Math.max(1, Math.min(120, Math.floor((atM - s.dist) / s.speed * 60)))); }
  throw Error('Route did not advance');
}
async function replay(page, commands, length, touch = false) {
  for (const command of commands) {
    const state = await until(page, command.atM); assert.equal(state.mode, 'playing', state.reason);
    for (const end of ['front', 'rear']) if (command[end] !== undefined) await steer(page, end, command[end], touch);
  }
  await until(page, length + 1);
  const state = await snapshot(page); assert.equal(state.mode, 'levelComplete', `${state.levelId}: ${state.reason}`);
  await page.locator('#level-result-modal').waitFor({ state: 'visible' }); return snapshot(page);
}
async function capture(page, name) {
  // A visible modal can still be at opacity zero in its enter animation.
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.target?.closest?.('.overlay-modal')).map(animation => animation.finished.catch(() => {}))));
  await page.screenshot({ path: path.join(directory, `${name}.png`) }); captures.push(name);
}
async function context(options = {}, fixture = null, broken = false) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(({ fixture, broken, key }) => {
    window.__TRAIN_TEST_CONFIG__ = { manualClock: true };
    if (fixture && location.hostname === '127.0.0.1' && !localStorage.getItem(key)) localStorage.setItem(key, fixture);
    if (broken && location.hostname === '127.0.0.1') {
      localStorage.setItem('acrobatic_train_bank_points', '2000');
      localStorage.setItem('acrobatic_train_unlocked_trains', '["cyber","steam"]'); localStorage.setItem('acrobatic_train_current_train', 'steam');
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { if (k === key) throw Error('denied'); return get.call(this, k); };
      Storage.prototype.setItem = function (k, v) { if (k === key) throw Error('quota'); return set.call(this, k, v); };
    }
  }, { fixture, broken, key: PROGRESS_KEY });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message)); await page.route('**/api/stunt-judge', route => route.abort());
  await ready(page); return { ctx, page, errors };
}
const unlocked = new ProgressStore();
unlocked.complete({ levelId: 'level-01', score: 0, timeS: 40, eventId: 'fixture-1' });
unlocked.complete({ levelId: 'level-02', score: 0, timeS: 40, eventId: 'fixture-2' });
const fixture = JSON.stringify(unlocked.data);
try {
  let online = false;
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw Error(`Server exit: ${serverError}`);
    try { if ((await fetch(url)).ok) { online = true; break; } } catch { /* Startup only. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(online); browser = await playwright.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (!process.env.TEST_SCOPE || process.env.TEST_SCOPE === 'ui') for (const settings of [
    { label: 'desktop', viewport: { width: 1366, height: 768 }, hasTouch: false },
    { label: 'portrait', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    { label: 'landscape', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  ]) {
    const { ctx, page, errors } = await context(settings);
    await page.locator('#menu-store-btn').click(); await page.locator('.store-action-btn.buy[data-id="steam"]').click(); await page.locator('#store-close-btn').click();
    assert.equal((await snapshot(page)).shop.bank, 0);
    await page.locator('#start-game-btn').click();
    assert.equal(await page.locator('[data-level-id="level-02"]').isDisabled(), true);
    assert.equal(await page.locator('[data-level-id="level-04"]').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__TRAIN_TEST_HOOKS__.startLevel('level-03')), false);
    await capture(page, `${settings.label}-map`);
    await page.locator('[data-level-id="level-01"]').click(); await capture(page, `${settings.label}-briefing`);
    await page.locator('#briefing-start-btn').click();
    await until(page, 60); await steer(page, 'front', -1, settings.hasTouch); await steer(page, 'rear', -1, settings.hasTouch);
    await step(page, 20); assert.deepEqual((await snapshot(page)).ends, { front: -3.4, rear: -3.4 });
    await page.waitForFunction(() => document.getElementById('run-warning').textContent.includes('OBRAS'));
    if (settings.hasTouch) await page.locator('#pause-btn').tap(); else await page.keyboard.press('KeyP');
    const paused = await snapshot(page); await page.locator('#pause-store-btn').click(); await page.locator('#store-close-btn').click();
    await step(page, 60); assert.equal((await snapshot(page)).mode, 'paused'); assert.equal((await snapshot(page)).dist, paused.dist);
    await page.locator('#resume-btn').click(); await capture(page, `${settings.label}-playing`);
    const first = await replay(page, ROUTES['level-01'].slice(1), 600, settings.hasTouch);
    assert.equal(first.progress.highestUnlockedLevel, 2); await capture(page, `${settings.label}-result`);
    const balance = first.shop.bank;
    await page.locator('#level-retry-btn').click(); assert.equal((await snapshot(page)).score, 0); assert.equal((await snapshot(page)).shop.bank, balance);
    await page.evaluate(() => window.__TRAIN_TEST_HOOKS__.crash()); await step(page, 108); await page.locator('#gameover-modal').waitFor({ state: 'visible' });
    assert.equal((await snapshot(page)).progress.highestUnlockedLevel, 2);
    await page.locator('#over-menu-btn').click(); await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__));
    assert.equal((await snapshot(page)).shop.bank, balance); assert.ok((await snapshot(page)).shop.owned.includes('steam'));
    await page.locator('#continue-campaign-btn').click(); assert.match(await page.locator('#briefing-title').textContent(), /FASE 2/);
    await page.locator('#briefing-start-btn').click(); await replay(page, ROUTES['level-02'], 750, settings.hasTouch);
    await page.locator('#level-next-btn').click(); assert.match(await page.locator('#briefing-title').textContent(), /FASE 3/);
    await page.locator('#briefing-start-btn').click(); const third = await replay(page, ROUTES['level-03'], 850, settings.hasTouch);
    assert.equal(third.metrics.aerialItems, 0); assert.equal(third.metrics.stuntsLanded, 0); assert.equal(third.progress.highestUnlockedLevel, 4);
    assert.deepEqual(third.progress.achievements, []); assert.equal(await page.locator('#level-next-btn').isVisible(), false);
    await page.locator('#level-menu-btn').click(); assert.equal(await page.locator('[data-level-id="level-04"]').isDisabled(), true);
    await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.closest('#campaign-map-modal') !== null));
    assert.deepEqual(errors, []); reports.push({ scenario: settings.label, passed: true, progression: [1, 2, 3], pageErrors: errors }); await ctx.close();
  }
  if (!process.env.TEST_SCOPE || ['air', 'extended'].includes(process.env.TEST_SCOPE)) {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 }, recordVideo: { dir: path.join(directory, 'video'), size: { width: 960, height: 540 } } }, fixture);
    await page.locator('#continue-campaign-btn').click(); await page.locator('#briefing-start-btn').click();
    await until(page, 133); assert.ok((await snapshot(page)).jump.on); await capture(page, 'aerial-backflip');
    const result = await replay(page, AIR_ROUTE, 850);
    assert.ok(result.metrics.aerialItems >= 1); assert.ok(result.metrics.stuntsLanded >= 3);
    await capture(page, 'aerial-result'); assert.deepEqual(errors, []);
    reports.push({ scenario: 'aerial', passed: true, metrics: result.metrics, pageErrors: errors });
    await ctx.close();
    const video = await page.video()?.path(); if (video) await fs.copyFile(video, path.join(directory, 'aerial.webm'));
  }
  if (!process.env.TEST_SCOPE || ['storage', 'extended'].includes(process.env.TEST_SCOPE)) {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } }, null, true);
    await page.locator('#continue-campaign-btn').click(); await page.locator('#briefing-start-btn').click();
    const result = await replay(page, ROUTES['level-01'], 600);
    assert.equal(result.progress.highestUnlockedLevel, 2); assert.equal(result.progress.storageError, true);
    assert.match(await page.locator('#level-result-modal .campaign-save-status').textContent(), /sessão/);
    assert.ok(result.shop.owned.includes('steam')); assert.ok(result.shop.bank >= 2000);
    await capture(page, 'storage-failure'); assert.deepEqual(errors, []);
    reports.push({ scenario: 'storage-failure', passed: true, pageErrors: errors }); await ctx.close();
  }
  if (!process.env.TEST_SCOPE || ['zero-score', 'extended'].includes(process.env.TEST_SCOPE)) {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } });
    await page.locator('#continue-campaign-btn').click(); await page.locator('#briefing-start-btn').click();
    const result = await replay(page, ZERO_SCORE_ROUTE, 600);
    assert.equal(result.score, 0); assert.equal(result.shop.bank, 50); assert.equal(result.metrics.items, 0); assert.equal(result.progress.highestUnlockedLevel, 2);
    assert.deepEqual(errors, []); await capture(page, 'zero-score-result');
    reports.push({ scenario: 'zero-score', passed: true, score: 0, bank: 50, unlocked: 2, pageErrors: errors }); await ctx.close();
  }
  if (!process.env.TEST_SCOPE || ['resources', 'extended'].includes(process.env.TEST_SCOPE)) {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } }, fixture);
    const samples = {};
    for (let cycle = 0; cycle < 15; cycle++) for (const id of ['level-01', 'level-02', 'level-03']) {
      await page.evaluate(id => { const hooks = window.__TRAIN_TEST_HOOKS__; hooks.openMap(); hooks.chooseLevel(id); hooks.startLevel(id); hooks.step(1); }, id);
      const before = (await snapshot(page)).renderedFrames;
      await page.waitForFunction(n => window.__TRAIN_TEST_HOOKS__.snapshot().renderedFrames >= n + 3, before);
      if (cycle >= 5) (samples[id] ||= []).push((await snapshot(page)).memory);
    }
    for (const [id, values] of Object.entries(samples)) assert.ok(values.every(v => v.geometries === values[0].geometries && v.textures === values[0].textures), `${id} grows: ${JSON.stringify(values)}`);
    assert.deepEqual(errors, []); await fs.writeFile(path.join(directory, 'resources.json'), JSON.stringify(samples, null, 2));
    reports.push({ scenario: 'resource-transitions', passed: true, transitions: 30, samples, pageErrors: errors }); await ctx.close();
  }
  if (!process.env.TEST_SCOPE || process.env.TEST_SCOPE === 'regression') {
    const { ctx, page, errors } = await context({ viewport: { width: 1366, height: 768 } });
    await page.locator('#continue-campaign-btn').click(); await page.locator('#briefing-start-btn').click();
    await page.unroute('**/api/stunt-judge'); let arrived, release;
    const requested = new Promise(resolve => { arrived = resolve; });
    await page.route('**/api/stunt-judge', async route => { arrived(); await new Promise(resolve => { release = resolve; }); try { await route.fulfill({ json: { title: 'LATE', bonus: 100 } }); } catch { /* Aborted by production cleanup. */ } });
    await page.evaluate(() => { window.__TRAIN_TEST_HOOKS__.judge(); }); await requested;
    const before = await snapshot(page);
    await page.evaluate(() => { window.__TRAIN_TEST_HOOKS__.menu(); window.__TRAIN_TEST_HOOKS__.startLevel('level-01'); });
    release(); await page.waitForTimeout(150);
    assert.equal((await snapshot(page)).score, 0); assert.equal((await snapshot(page)).shop.bank, before.shop.bank);
    await page.unroute('**/api/stunt-judge'); await page.route('**/api/stunt-judge', route => route.abort());
    await page.evaluate(() => window.__TRAIN_TEST_HOOKS__.menu()); await page.locator('#start-infinite-btn').click();
    const saved = (await snapshot(page)).progress;
    const result = await page.evaluate(() => {
      const hooks = window.__TRAIN_TEST_HOOKS__, lanes = [-3.4, 0, 3.4];
      const press = code => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); };
      for (let i = 0; i < 4000; i++) {
        const s = hooks.snapshot(); if (s.mode !== 'playing' || s.dist > 650) break;
        const upcoming = s.gaps.filter(g => g.b > s.dist - 5 && g.a < s.dist + s.speed * 0.8 + 8), current = s.targets.front;
        if (upcoming.some(g => g.tz === current)) {
          const target = lanes.filter(lane => !upcoming.some(g => g.tz === lane)).sort((a, b) => Math.abs(a - current) - Math.abs(b - current))[0];
          if (target !== undefined) for (let shift = 0; shift < Math.round(Math.abs(target - current) / 3.4); shift++) { press(target > current ? 'KeyD' : 'KeyA'); press(target > current ? 'ArrowRight' : 'ArrowLeft'); }
        }
        hooks.step(1);
      }
      return hooks.snapshot();
    });
    assert.ok(result.dist > 600, `${result.reason} at ${result.dist}`); assert.equal(result.mode, 'playing'); assert.equal(result.levelId, null);
    assert.deepEqual(result.progress, saved); assert.deepEqual(errors, []);
    reports.push({ scenario: 'M1-regression', passed: true, staleBonusRejected: true, infiniteDistance: result.dist, progressUnchanged: true, pageErrors: errors }); await ctx.close();
  }
  await fs.writeFile(path.join(directory, 'browser-results.json'), JSON.stringify({ runId, generatedAt: new Date().toISOString(), reports }, null, 2));
  const artifactPaths = captures.map(state => `artifacts/validation/${runId}/${state}.png`);
  try { await fs.access(path.join(directory, 'aerial.webm')); artifactPaths.push(`artifacts/validation/${runId}/aerial.webm`); } catch { /* No motion capture in this scope. */ }
  if (captures.length) await fs.writeFile('artifacts/evidence.json', JSON.stringify({ version: 1, runId,
    captures: captures.map(state => ({ mode: state.startsWith('portrait') ? 'mobile' : state.startsWith('landscape') ? 'mobile-landscape' : 'desktop', state, report: `artifacts/validation/${runId}/browser-results.json` })),
    artifacts: artifactPaths, limitation: 'Functional tests with software GPU and accelerated/manual test clock. Human playtest and hardware FPS unverified.' }, null, 2));
  console.log(JSON.stringify({ directory, reports }, null, 2));
} finally { await browser?.close(); server.kill(); }
