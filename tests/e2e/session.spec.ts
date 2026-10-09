import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});

async function login(page: Page, account: string) {
  await page.goto('/login');
  await page.getByTestId('login-email').waitFor();
  if (await page.getByTestId('onboarding-skip').isVisible()) await page.getByTestId('onboarding-skip').click();
  await page.getByTestId('login-email').fill(`${account}@baton.demo`);
  await page.getByTestId('login-password').fill('baton-demo-2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
}
async function auth(api: APIRequestContext, account: string) {
  const response = await api.post('/api/auth/login', { data: { email: `${account}@baton.demo`, password: 'baton-demo-2026' } });
  expect(response.status()).toBe(200);
  return { Authorization: `Bearer ${(await response.json()).accessToken}` };
}
test.beforeEach(async ({ request }) => {
  expect((await request.post('/api/__test/reset', { data: {} })).status()).toBe(200);
});

test('real login sends Bearer JWT; logout clears session; another account gets fresh permitted blocks', async ({ page, request }) => {
  await login(page, 'a');
  await expect(page.getByTestId('alert-card')).toContainText('1건');
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('baton.session')!));
  expect(Object.keys(session.user)).toEqual(['id', 'name']);
  expect(JSON.parse(Buffer.from(session.accessToken.split('.')[1], 'base64url').toString())).not.toHaveProperty('scope');
  const response = await request.get('/api/patients/p_01/home?dept=내과', { headers: { Authorization: `Bearer ${session.accessToken}` } });
  expect(response.status()).toBe(200);
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.getByTestId('logout').click(); await expect(page).toHaveURL(/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('baton.session'))).toBeNull();
  await login(page, 'c');
  await expect(page.getByTestId('alert-card')).toHaveCount(0);
  await expect(page.getByTestId('questions-link')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('바토디핀');
});

test('invalid real JWT clears the session and private screen on 401', async ({ page }) => {
  await login(page, 'a');
  await page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem('baton.session')!);
    session.accessToken += 'invalid'; sessionStorage.setItem('baton.session', JSON.stringify(session));
  });
  await page.reload(); await expect(page).toHaveURL(/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('baton.session'))).toBeNull();
  await expect(page.locator('main')).not.toContainText('바토디핀');
});

test('a late unauthorized response from the previous account cannot clear the new session', async ({ page }) => {
  await login(page, 'a');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let aborted = false;
  page.on('requestfailed', request => { if (request.url().includes('/timeline?')) aborted = true; });
  await page.route('**/api/patients/**/timeline?*', async route => {
    await held;
    try { await route.fulfill({ status: 401, json: { error: { message: '이전 세션이 만료됐어요.' } } }); }
    catch { /* request was aborted by session/page change */ }
  });
  const started = page.waitForRequest(r => r.url().includes('/timeline?'));
  await page.getByRole('link', { name: '타임라인', exact: true }).click(); await started;
  await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('logout').click();
  await login(page, 'c');
  release();
  await expect.poll(() => aborted).toBe(true);
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('baton.session')!).user.id)).toBe('u_c');
  await expect(page.locator('main')).not.toContainText('바토디핀');
});

test('visit change removes unsaved input and late state from the previous visit', async ({ page }) => {
  await login(page, 'b'); await page.getByTestId('questions-link').click();
  await page.getByTestId('question-input').fill('이전 진료의 입력');
  await page.evaluate(() => {
    history.pushState(null, '', '/p/p_01/visits/v_os_01/questions');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/v_os_01\/questions$/);
  await expect(page.getByTestId('question-input')).toHaveValue('');
  await expect(page.locator('main')).not.toContainText('어지럼증');
});

test('patient change hides old content and cancels in-flight reads before the next response', async ({ page }) => {
  await login(page, 'a');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/patients/p_missing/home*', async route => {
    await held;
    try { await route.continue(); } catch { /* navigation aborted this request */ }
  });
  const started = page.waitForRequest(r => r.url().includes('/p_missing/home'));
  await page.evaluate(() => { history.pushState(null, '', '/p/p_missing'); dispatchEvent(new PopStateEvent('popstate')); });
  await started;
  await expect(page.locator('main')).not.toContainText('바토디핀');
  await page.getByRole('link', { name: '나', exact: true }).click();
  release();
  await expect(page.getByRole('heading', { name: '아직 내 진료 기록이 없어요' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '찾을 수 없어요' })).toHaveCount(0);
});

test('focus invalidates loaded blocks after an external scope change without AI calls', async ({ page, request }) => {
  await login(page, 'b');
  await expect(page.locator('main')).toContainText('바토디핀');
  const initial = await (await request.get('/api/__test/ai-calls')).json();
  expect((await request.put('/api/patients/p_01/members/u_b/scope', {
    headers: await auth(request, 'patient'), data: { scope: 'schedule' },
  })).status()).toBe(200);
  const refreshed = page.waitForResponse(r => r.url().includes('/patients/p_01/home'));
  await page.evaluate(() => dispatchEvent(new Event('focus')));
  const data = await (await refreshed).json();
  expect(Object.keys(data.nextVisit)).toEqual(['meta']);
  for (const item of data.recent) expect(Object.keys(item.record.blocks)).toEqual(['schedule']);
  await expect(page.getByTestId('questions-link')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('바토디핀');
  expect(await (await request.get('/api/__test/ai-calls')).json()).toEqual(initial);
});

test('screen exit stops a pending job poll, and failed question submission retains its input', async ({ page }) => {
  await login(page, 'b'); await page.getByTestId('questions-link').click();
  let reads = 0;
  await page.route('**/api/jobs/*', async route => {
    reads++;
    const response = await route.fetch();
    const job = await response.json();
    await route.fulfill({ json: { ...job, status: 'running', resultState: null, resultVersion: null } });
  });
  await page.getByTestId('merge-button').click();
  await expect.poll(() => reads).toBeGreaterThan(0);
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.getByTestId('logout').click(); await expect(page).toHaveURL(/login$/);
  const stopped = reads;
  await page.waitForTimeout(2200);
  expect(reads).toBe(stopped);
  await login(page, 'b'); await page.getByTestId('questions-link').click();
  await page.route('**/api/patients/p_01/visits/v_im_03/questions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 503, json: { error: { message: '잠시 후 다시 시도해 주세요.' } } });
  });
  await page.getByTestId('question-input').fill('저장하지 못한 질문'); await page.getByTestId('question-submit').click();
  await expect(page.getByRole('alert')).toContainText('잠시 후');
  await expect(page.getByTestId('question-input')).toHaveValue('저장하지 못한 질문');
});

test('non-JSON server failure has a useful retry message instead of a JSON parser error', async ({ page }) => {
  await login(page, 'b');
  await page.route('**/api/patients/**/timeline?*', route => route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad gateway' }));
  await page.getByRole('link', { name: '타임라인', exact: true }).click();
  await expect(page.locator('.state')).toContainText('다시 시도해 주세요');
  await expect(page.locator('.state')).not.toContainText('JSON');
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible();
});

test('storage disabled still allows login and logout using the in-memory session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Storage unavailable'); } });
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Storage unavailable'); } });
    Object.defineProperty(Storage.prototype, 'removeItem', { value() { throw new Error('Storage unavailable'); } });
  });
  await login(page, 'b'); await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.getByTestId('logout').click(); await expect(page).toHaveURL(/login$/);
});
