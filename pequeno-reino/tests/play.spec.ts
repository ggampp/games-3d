import { expect, test, type Page } from '@playwright/test';

type DebugState = {
  phaseId: number;
  status: string;
  hand: string[];
  deck: number;
  mapSize: number;
  questsDone: boolean;
  score: number;
  coins: number;
};

async function state(page: Page): Promise<DebugState | null> {
  return page.evaluate(() => window.__PR_DEBUG__?.state() ?? null);
}

async function placeOnce(page: Page): Promise<void> {
  // Só hexes cujo ponto de tela cai de fato no canvas (fora de HUD, dicas e toasts).
  const points = await page.evaluate(() =>
    (window.__PR_DEBUG__?.validScreenPoints() ?? []).filter((p) => {
      const hit = document.elementFromPoint(p.x, p.y);
      return hit?.id === 'game-canvas' || hit?.id === 'ui-root' || hit?.classList.contains('screen');
    }),
  );
  const target = points[0];
  expect(target, 'nenhum hex válido projetado na tela').toBeTruthy();
  await page.mouse.click(target!.x, target!.y);
}

test.beforeEach(async ({ page }) => {
  // Limpa o save só na primeira carga do teste; recarregar a página mantém o progresso.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('pr-test-clean')) {
      localStorage.clear();
      sessionStorage.setItem('pr-test-clean', '1');
    }
  });
});

test('joga a Primavera inteira: tutorial, missões, encerrar fase, estrela e desbloqueio', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.locator('#screen-play')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);

  // tutorial da fase 1 aparece
  await expect(page.locator('#hint')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#hint-text')).toContainText('Escolha uma carta');

  let guard = 0;
  while (guard < 40) {
    const current = await state(page);
    expect(current).not.toBeNull();
    if (current!.status !== 'playing' || current!.questsDone) break;
    await page.keyboard.press('Digit1');
    await placeOnce(page);
    guard += 1;
  }

  const done = await state(page);
  expect(done!.questsDone).toBe(true);
  expect(done!.status).toBe('playing');
  await expect(page.locator('#toast')).toContainText('Missões cumpridas');

  // desfazer e refazer uma jogada mantém a fase jogável
  const beforeUndo = (await state(page))!.mapSize;
  await page.keyboard.press('Digit1');
  await placeOnce(page);
  expect((await state(page))!.mapSize).toBe(beforeUndo + 1);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  expect((await state(page))!.mapSize).toBe(beforeUndo);

  await page.getByRole('button', { name: 'Encerrar a fase' }).click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#modal-stars')).toContainText('★');
  await expect(page.locator('#modal-unlock')).toContainText('Engenho');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pequeno-reino-save-v1') ?? '{}'));
  expect(saved.completedPhases).toContain(1);
  expect(saved.stars['1']).toBeGreaterThanOrEqual(1);
  expect(saved.unlockedTiles).toContain('engenho');
  expect(saved.maxUnlockedPhase).toBe(2);

  await page.getByRole('button', { name: 'Próxima fase' }).click();
  await expect(page.locator('#phase-title')).toHaveText('Verão na Mata');
  expect(pageErrors).toEqual([]);
});

test('continuar restaura a sessão salva com a mesma mão', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jogar' }).click();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await page.keyboard.press('Digit2');
  await placeOnce(page);
  const before = await state(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tela inicial' }).click();
  await expect(page.locator('#screen-title')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Continuar' }).click();
  const after = await state(page);
  expect(after!.hand).toEqual(before!.hand);
  expect(after!.mapSize).toBe(before!.mapSize);
  expect(after!.deck).toBe(before!.deck);
});
