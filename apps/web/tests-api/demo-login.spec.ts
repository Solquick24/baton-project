import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { buildApp } from '../../api/src/app.js';
import { openDatabase } from '../../api/src/adapters/sqlite/database.js';
import { readConfig } from '../../api/src/shared/config.js';
import { seedDatabase } from '../../../scripts/seed.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});

let app: Awaited<ReturnType<typeof buildApp>>;
const db = openDatabase(':memory:');
test.beforeAll(async () => {
  const config = readConfig({ NODE_ENV: 'test', JWT_SECRET: randomBytes(32).toString('hex'), LLM_MODE: 'fixture', STT_MODE: 'fixture', SQLITE_PATH: ':memory:' });
  await seedDatabase(db, { fixturesDir: config.fixturesDir, pregenerate: true });
  app = await buildApp({ config, db });
  await app.listen({ host: '127.0.0.1', port: 3103 });
});
test.afterAll(async () => { await app?.close(); db.close(); });

test('개발용 빠른 선택은 가상 비밀번호만 제공하고 캐시하지 않는다', async ({ request }) => {
  const response = await request.get('/__demo/accounts');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(Object.keys(await response.json())).toEqual(['demoPassword']);
});
for (const [account, userId, owner] of [['patient', 'u_patient', '내 기록'], ['a', 'u_a', '박하늘'], ['b', 'u_b', '박하늘'], ['c', 'u_c', '박하늘']] as const) {
  test(`${account} 빠른 선택 뒤 기존 API 로그인으로 가족 기록에 진입한다`, async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId(`quick-login-${account}`).click();
    await expect(page.getByTestId('login-email')).toHaveValue(`${account}@baton.demo`);
    const response = page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST');
    await page.getByTestId('login-submit').click();
    const login = await response;
    expect(login.status()).toBe(200);
    const data = await login.json();
    expect(data.user.id).toBe(userId);
    expect(data.accessToken.split('.')).toHaveLength(3);
    await expect(page.getByTestId('next-visit-card')).toBeVisible();
    await expect(page.getByRole('link', { name: '나', exact: true })).toHaveCount(0);
    await expect(page.locator('.owners').getByRole('link', { name: owner, exact: true })).toBeVisible();
    if (account === 'c') {
      await expect(page.getByTestId('briefing-link')).toHaveCount(0);
      await expect(page.getByTestId('questions-link')).toHaveCount(0);
      await expect(page.getByTestId('alert-card')).toHaveCount(0);
    }
  });
}

test('가상 계정 안내가 실패해도 일반 로그인 폼은 사용할 수 있다', async ({ page }) => {
  await page.route('**/__demo/accounts', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/login');
  await expect(page.getByRole('status')).toContainText('가상 계정을 불러오지 못했어요');
  await expect(page.getByTestId('quick-login-b')).toBeDisabled();
  await expect(page.getByTestId('login-email')).toBeEnabled();
  await expect(page.getByTestId('login-submit')).toBeEnabled();
  await page.unroute('**/__demo/accounts');
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByTestId('quick-login-b')).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
});
