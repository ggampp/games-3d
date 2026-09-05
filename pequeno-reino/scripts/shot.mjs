/** Captura telas do jogo para verificação visual: node scripts/shot.mjs [outDir] */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'artifacts/shots';
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:5188';

const browser = await chromium.launch();
const errors = [];
async function run(name, viewport, fn) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name} console: ${m.text().slice(0, 200)}`);
  });
  await page.goto(base);
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 30);
  await fn(page);
  await context.close();
}

async function place(page, n) {
  for (let i = 0; i < n; i += 1) {
    await page.keyboard.press('Digit1');
    const points = await page.evaluate(() => window.__PR_DEBUG__?.validScreenPoints() ?? []);
    const vp = page.viewportSize();
    const inside = points.filter((p) => p.x > 30 && p.y > 130 && p.x < vp.width - 30 && p.y < vp.height - 230);
    const t = inside[0] ?? points[0];
    if (!t) break;
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(150);
  }
}

await run('title', { width: 1280, height: 720 }, async (page) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, 'title.png') });
  await page.getByRole('button', { name: 'Mapa da campanha' }).click();
  await page.screenshot({ path: join(out, 'map.png') });
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Álbum de tiles' }).click();
  await page.screenshot({ path: join(out, 'album.png') });
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('button', { name: 'Opções' }).click();
  await page.screenshot({ path: join(out, 'options.png') });
});

await run('play', { width: 1280, height: 720 }, async (page) => {
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'play-start.png') });
  await place(page, 6);
  const points = await page.evaluate(() => window.__PR_DEBUG__?.validScreenPoints() ?? []);
  const t = points.find((p) => p.x > 200 && p.x < 1000 && p.y > 150 && p.y < 480) ?? points[0];
  if (t) await page.mouse.move(t.x, t.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, 'play-hover.png') });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, 'play-mid.png') });
  console.log('state', JSON.stringify(await page.evaluate(() => window.__PR_DEBUG__?.state())));
});

await run('mobile', { width: 390, height: 844 }, async (page) => {
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.waitForTimeout(400);
  await place(page, 3);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, 'mobile-play.png') });
});

await browser.close();
if (errors.length) console.log('ERRORS\n' + errors.join('\n'));
else console.log('no page errors');
