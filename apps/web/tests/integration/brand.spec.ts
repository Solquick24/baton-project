import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const screenshot = (name: string) => fileURLToPath(new URL(`../../output/brand-preview/${name}`, import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});

async function checkImagesAndLayout(page: Page) {
  for (const image of await page.locator('.baton-icon, .baton-mascot').all()) {
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveAttribute('alt', '');
    await expect(image).toHaveAttribute('aria-hidden', 'true');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const layout of [
  { name: 'mobile', width: 390, height: 844, large: false },
  { name: 'large-contrast', width: 375, height: 844, large: true },
  { name: 'landscape', width: 844, height: 390, large: false },
]) {
  test(`A1 brand and contextual poses remain readable: ${layout.name}`, async ({ page, request }) => {
    expect((await request.post('/api/__test/reset', { data: {} })).status()).toBe(200);
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if (layout.large) await page.addInitScript(() => localStorage.setItem('baton.display', JSON.stringify({ font: 'extra-large', contrast: true })));
    await page.goto('/login');
    await expect(page.locator('.baton-mascot')).toHaveAttribute('src', '/brand/a4-welcome.webp');
    await checkImagesAndLayout(page);
    if (layout.name === 'mobile') {
      const manifest = await (await request.get('/manifest.webmanifest')).json();
      for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
      for (const size of [64, 180]) expect((await request.get(`/brand/a1-icon-${size}.png`)).status()).toBe(200);
      await page.screenshot({ path: screenshot('login.png'), fullPage: true });
    }
    await page.getByTestId('login-email').fill('b@baton.demo');
    await page.getByTestId('login-password').fill('baton-demo-2026');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('next-visit-card')).toBeVisible();
    await expect(page.getByRole('link', { name: '바통', exact: true })).toBeVisible();
    await expect(page.locator('.baton-mascot')).toHaveAttribute('src', '/brand/a2-prepare.webp');
    await checkImagesAndLayout(page);
    if (layout.name === 'mobile') await page.screenshot({ path: screenshot('home.png'), fullPage: true });
    await page.getByTestId('briefing-link').click();
    await expect(page.getByTestId('briefing-questions').locator('li')).toHaveCount(3);
    await expect(page.locator('.baton-mascot')).toHaveAttribute('src', '/brand/a3-handoff.webp');
    await checkImagesAndLayout(page);
    if (layout.name === 'mobile') {
      const questions = await page.getByTestId('briefing-questions').boundingBox();
      expect(questions!.y + questions!.height).toBeLessThanOrEqual(layout.height);
    }
    await page.screenshot({ path: screenshot(`briefing-${layout.name}.png`), fullPage: true });
    await page.getByRole('link', { name: '가족 질문 다시 보기' }).click();
    await expect(page.getByTestId('question-input')).toBeVisible();
    await checkImagesAndLayout(page);
    expect((await (await request.get('/api/__test/ai-calls')).json()).llm).toBe(0);
  });
}
