import { test, expect, type Page } from '@playwright/test';

async function remember(page: Page, days = 0) {
  await page.addInitScript(({ days }) => {
    if (!localStorage.getItem('baton.onboarding')) localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now() - 1000, lastVisitedAt: Date.now() - days * 86400000 }));
  }, { days });
}
async function login(page: Page, account = 'b') {
  await page.getByTestId('login-email').fill(`${account}@baton.demo`);
  await page.getByTestId('login-password').fill('baton-demo-2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
}

test('first visit: swipe, back, keyboard, completion and no product mutations', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') mutations.push(request.url()); });
  await page.goto('/login');
  const dialog = page.getByTestId('onboarding-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: '동행하는 가족이 바뀌어도, 진료 이야기는 이어져요.' })).toBeFocused();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.getByTestId('onboarding-slide').evaluate(el => el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 1, target: el, clientX: 310, clientY: 220 })] })));
  await page.getByTestId('onboarding-slide').evaluate(el => el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [new Touch({ identifier: 1, target: el, clientX: 90, clientY: 230 })] })));
  await expect(dialog).toContainText('무엇을 물어볼지 먼저 봐요.');
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('onboarding-next').click();
  await expect(dialog).toContainText('기록으로 남겨요.');
  await page.getByTestId('onboarding-next').click();
  await expect(dialog).toContainText('자동으로 공유되지 않아요.');
  await dialog.screenshot({ path: '/tmp/baton-onboarding-final.png' });
  await page.getByTestId('onboarding-start').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('login-email')).toBeVisible();
  await page.reload();
  await expect(dialog).toHaveCount(0);
  expect(mutations).toEqual([]);
});

test('skip is remembered; login and settings can replay with focus restored', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('onboarding-skip').click();
  await page.reload();
  await expect(page.getByTestId('onboarding-dialog')).toHaveCount(0);
  await page.getByTestId('onboarding-reopen').click();
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('onboarding-reopen')).toBeFocused();
  await login(page, 'c');
  await expect(page.getByTestId('briefing-link')).toHaveCount(0);
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.getByTestId('onboarding-reopen').click();
  await expect(page.getByTestId('onboarding-dialog')).not.toContainText('원문');
  await page.getByTestId('onboarding-skip').click();
  await expect(page.getByTestId('onboarding-reopen')).toBeFocused();
  await expect(page.getByTestId('sharing-member-u_a')).toHaveCount(0);
});

test('long absence offers a nonblocking reminder; ordinary return does not', async ({ page }) => {
  await remember(page, 31);
  await page.goto('/login');
  await expect(page.getByTestId('onboarding-dialog')).toHaveCount(0);
  const reminder = page.getByRole('complementary', { name: '사용법 안내' });
  await expect(reminder).toBeVisible();
  await expect(page.getByTestId('login-email')).toBeVisible();
  await reminder.getByTestId('onboarding-reopen').click();
  await page.getByTestId('onboarding-skip').click();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await expect(reminder).toHaveCount(0);
  await expect(page.getByTestId('onboarding-dialog')).toHaveCount(0);
});

test('blocked storage and malformed history still allow onboarding to finish', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
  });
  await page.goto('/login');
  await page.getByRole('button', { name: '4단계: 진료가 끝나면' }).click();
  await page.getByTestId('onboarding-start').click();
  await expect(page.getByTestId('login-email')).toBeVisible();
  await page.getByTestId('onboarding-reopen').click();
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await page.getByTestId('onboarding-skip').click();
});

test('invalid saved history opens the first step', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', '{broken'));
  await page.goto('/login');
  await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
  await expect(page.getByTestId('onboarding-dialog').getByRole('heading')).toContainText('진료 이야기는 이어져요.');
});

for (const viewport of [{ width: 375, height: 667 }, { width: 844, height: 390 }]) {
  test(`large text, contrast, reduced motion and reachable controls at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('baton.display', JSON.stringify({ font: 'extra-large', contrast: true })));
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'extra-large');
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'true');
    for (let step = 0; step < 4; step++) {
      const dialog = page.getByTestId('onboarding-dialog');
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      for (const button of await dialog.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(48);
        expect(box!.width).toBeGreaterThanOrEqual(48);
      }
      const action = page.getByTestId(step === 3 ? 'onboarding-start' : 'onboarding-next');
      const box = await action.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await action.click();
    }
    await expect(page.getByTestId('onboarding-dialog')).toHaveCount(0);
  });
}
