import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { PROGRESS_KEY } from '../src/core/progress-store.js';

/** Shared E2E harness: real server, real game handlers, manual simulation clock. */
export async function createHarness({ defaultRunId, port = '3191' }) {
  let playwright;
  try { playwright = await import('playwright'); }
  catch { if (!process.env.PLAYWRIGHT_MODULE_DIR) throw Error('Install Playwright or set PLAYWRIGHT_MODULE_DIR.'); playwright = createRequire(path.join(process.env.PLAYWRIGHT_MODULE_DIR, 'package.json'))('playwright'); }
  const url = `http://127.0.0.1:${process.env.TEST_PORT || port}`;
  const runId = process.env.TEST_RUN_ID || defaultRunId, directory = path.resolve('artifacts/validation', runId);
  await fs.mkdir(directory, { recursive: true });
  const server = spawn(process.execPath, ['scripts/serve.js'], { env: { ...process.env, PORT: new URL(url).port }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let serverError = ''; server.stderr.on('data', data => { serverError += data.toString(); });
  const captures = [];
  const h = { url, runId, directory, captures, browser: null };
  h.snapshot = page => page.evaluate(() => window.__TRAIN_TEST_HOOKS__.snapshot());
  h.step = (page, ticks) => page.evaluate(n => window.__TRAIN_TEST_HOOKS__.step(n), ticks);
  h.ready = async page => { await page.goto(url, { waitUntil: 'networkidle' }); await page.waitForFunction(() => Boolean(window.__TRAIN_TEST_HOOKS__)); };
  h.steer = async (page, end, lane, touch) => {
    const current = Math.round((await h.snapshot(page)).targets[end] / 3.4), direction = Math.sign(lane - current);
    for (let i = 0; i < Math.abs(lane - current); i++) {
      if (touch) await page.locator(`#touch-${end}-${direction > 0 ? 'right' : 'left'}`).tap();
      else await page.keyboard.press(end === 'front' ? direction > 0 ? 'KeyD' : 'KeyA' : direction > 0 ? 'ArrowRight' : 'ArrowLeft');
    }
  };
  h.until = async (page, atM) => {
    for (let i = 0; i < 400; i++) { const s = await h.snapshot(page); if (s.dist >= atM || s.mode !== 'playing') return s; await h.step(page, Math.max(1, Math.min(120, Math.floor((atM - s.dist) / s.speed * 60)))); }
    throw Error('Route did not advance');
  };
  h.replay = async (page, commands, length, touch = false) => {
    for (const command of commands) {
      const state = await h.until(page, command.atM); assert.equal(state.mode, 'playing', state.reason);
      for (const end of ['front', 'rear']) if (command[end] !== undefined) await h.steer(page, end, command[end], touch);
    }
    await h.until(page, length + 1);
    const state = await h.snapshot(page); assert.equal(state.mode, 'levelComplete', `${state.levelId}: ${state.reason}`);
    await page.locator('#level-result-modal').waitFor({ state: 'visible' }); return h.snapshot(page);
  };
  h.capture = async (page, name) => {
    // A visible modal can still be at opacity zero in its enter animation.
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.target?.closest?.('.overlay-modal')).map(animation => animation.finished.catch(() => {}))));
    await page.screenshot({ path: path.join(directory, `${name}.png`) }); captures.push(name);
  };
  h.context = async (options = {}, fixture = null, broken = false, shop = null) => {
    const ctx = await h.browser.newContext(options);
    await ctx.addInitScript(({ fixture, broken, key, shop }) => {
      window.__TRAIN_TEST_CONFIG__ = { manualClock: true };
      if (fixture && location.hostname === '127.0.0.1' && !localStorage.getItem(key)) localStorage.setItem(key, fixture);
      if (shop && location.hostname === '127.0.0.1') for (const [k, v] of Object.entries(shop)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
      if (broken && location.hostname === '127.0.0.1') {
        localStorage.setItem('acrobatic_train_bank_points', '2000');
        localStorage.setItem('acrobatic_train_unlocked_trains', '["cyber","steam"]'); localStorage.setItem('acrobatic_train_current_train', 'steam');
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (k) { if (k === key) throw Error('denied'); return get.call(this, k); };
        Storage.prototype.setItem = function (k, v) { if (k === key) throw Error('quota'); return set.call(this, k, v); };
      }
    }, { fixture, broken, key: PROGRESS_KEY, shop });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message)); await page.route('**/api/stunt-judge', route => route.abort());
    await h.ready(page); return { ctx, page, errors };
  };
  h.start = async () => {
    let online = false;
    for (let i = 0; i < 50; i++) {
      if (server.exitCode !== null) throw Error(`Server exit: ${serverError}`);
      try { if ((await fetch(url)).ok) { online = true; break; } } catch { /* Startup only. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(online); h.browser = await playwright.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  };
  h.close = async () => { await h.browser?.close(); server.kill(); };
  return h;
}
