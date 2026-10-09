import { expect, test } from '@playwright/test';

test('mobile entry point connects to the real local API through the Vite proxy', async ({ page, request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  await page.goto('/');
  await expect(page).toHaveTitle('바통 · 진료 동행 노트');
  await expect(page.getByText('가상 데이터', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('서비스에 연결했어요.');
  await page.goto('/login');
  await expect(page.getByRole('status')).toHaveText('서비스에 연결했어요.');
  await page.goto('/unknown-route');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
