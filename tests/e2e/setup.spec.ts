import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});

test('mobile entry point connects to the real local API through the Vite proxy', async ({ page, request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  await page.goto('/');
  await expect(page).toHaveTitle('바통 · 진료 동행 노트');
  await expect(page.getByText('가상 데이터', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await expect(page.getByTestId('quick-login-b')).toBeEnabled();
  await expect(page.getByTestId('quick-login-b')).toBeVisible();
  await page.getByTestId('quick-login-b').click();
  await expect(page.getByTestId('login-email')).toHaveValue('b@baton.demo');
  await expect(page.getByTestId('login-password')).not.toHaveValue('');
  await page.goto('/unknown-route');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
