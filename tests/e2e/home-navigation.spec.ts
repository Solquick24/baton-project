import { expect, test } from '@playwright/test';
import { auth, login, reset } from './helpers';

test.beforeEach(async ({ request }) => reset(request));

test('unprepared briefing leads to questions without generating during navigation', async ({ page, request }, info) => {
  await reset(request, false);
  await login(page, 'b');
  const home = await (await request.get('/api/patients/p_01/home', { headers: await auth(request, 'b') })).json();
  expect(home.nextVisit.briefingReady).toBe(false);
  await expect(page.getByTestId('briefing-link')).toHaveCount(0);
  await expect(page.getByTestId('prepare-briefing-link')).toHaveText('가족 질문으로 진료 준비하기');
  await expect(page.getByTestId('record-link')).toBeVisible();
  await page.screenshot({ path: info.outputPath('home-unprepared.png'), fullPage: true });
  await page.getByTestId('prepare-briefing-link').click();
  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.getByTestId('merge-button')).toBeVisible();
  expect(await (await request.get('/api/__test/ai-calls')).json()).toMatchObject({ llm: 0, stt: 0 });
});

test('ready home identifies the owner once, shows briefing and keeps history expandable', async ({ page }, info) => {
  await login(page, 'b');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('박하늘님의 기록');
  await expect(page.locator('.owners')).toHaveCount(0);
  await expect(page.locator('main').getByText('박하늘님의 기록', { exact: true })).toHaveCount(1);
  await expect(page.getByTestId('briefing-link')).toBeVisible();
  await page.screenshot({ path: info.outputPath('home-ready.png'), fullPage: true });
  const history = page.getByTestId('recent-visit-v_im_02');
  await expect(history.getByText('바토디핀정 5mg', { exact: true })).not.toBeVisible();
  await history.getByText('진료 기록 펼치기', { exact: true }).click();
  await expect(history.getByText('바토디핀정 5mg', { exact: true })).toBeVisible();
  await expect(history.getByText('원문 보기', { exact: true })).toHaveCount(0);
  await page.getByTestId('briefing-link').click();
  await expect(page.getByTestId('briefing-changes')).toBeVisible();
  const box = await page.getByTestId('briefing-questions').boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
});

test('schedule response has no preparation or record actions and navigation calls no AI', async ({ page, request }, info) => {
  await login(page, 'c');
  for (const id of ['briefing-link', 'prepare-briefing-link', 'record-link', 'questions-link', 'alert-card']) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  await expect(page.locator('main')).not.toContainText('바토디핀정');
  const home = await (await request.get('/api/patients/p_01/home', { headers: await auth(request, 'c') })).json();
  expect(Object.keys(home.nextVisit)).toEqual(['meta']);
  await page.screenshot({ path: info.outputPath('home-schedule.png'), fullPage: true });
  await page.getByRole('link', { name: '타임라인', exact: true }).click();
  await page.getByRole('link', { name: '홈', exact: true }).click();
  expect(await (await request.get('/api/__test/ai-calls')).json()).toMatchObject({ llm: 0, stt: 0 });
});

test('not found and unsupported patient routes return to that patient home', async ({ page }) => {
  await login(page, 'b');
  await page.goto('/p/p_01/visits/missing/briefing');
  await expect(page.locator('.state')).toContainText('찾을 수 없어요');
  await expect(page.locator('.state').getByText('찾을 수 없어요', { exact: true })).toHaveCount(1);
  await expect(page.locator('.state').getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/p/p_01');
  await page.locator('.state').getByRole('link', { name: '홈으로' }).click();
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
  await page.goto('/p/p_01/unsupported');
  await page.getByRole('link', { name: '홈으로', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/p_01$/);
});

test('multiple record choices remain available and settings retains current patient context', async ({ page }) => {
  await page.route('**/api/me/patients', async route => {
    const response = await route.fetch();
    const value = await response.json();
    value.linked.push({ patientId: 'p_virtual', name: '가상 환자' });
    await route.fulfill({ response, json: value });
  });
  await login(page, 'b');
  await expect(page.locator('.owners').getByRole('link', { name: '박하늘' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.owners').getByRole('link', { name: '가상 환자' })).toHaveAttribute('href', '/p/p_virtual');
  await page.locator('.owners').getByRole('link', { name: '가상 환자' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가상 환자님의 기록');
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('설정');
  await expect(page.getByRole('link', { name: '바통', exact: true })).toHaveAttribute('href', '/p/p_virtual');
  await expect(page.getByRole('link', { name: '홈', exact: true })).toHaveAttribute('href', '/p/p_virtual');
});

test('small viewport, largest font and high contrast keep navigation operable', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem('baton.display', JSON.stringify({ font: 'extra-large', contrast: true })));
  await login(page, 'b');
  const brand = page.getByRole('link', { name: '바통', exact: true });
  const bounds = await brand.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(48);
  expect(bounds!.width).toBeGreaterThanOrEqual(48);
  await brand.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('timeline-dept-내과')).toBeFocused();
  expect(await page.getByTestId('timeline-dept-내과').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('home-large-contrast.png'), fullPage: true });
  const last = page.getByTestId('recent-visit-v_im_01').getByText('진료 기록 펼치기', { exact: true });
  await last.focus();
  const end = await last.boundingBox(); const nav = await page.locator('.bottom-nav').boundingBox();
  expect(end!.y + end!.height).toBeLessThanOrEqual(nav!.y);
});

test('empty schedule and empty history explain the state without unavailable actions', async ({ page }) => {
  await page.route('**/api/patients/p_01/home', async route => {
    const response = await route.fetch(); const value = await response.json();
    value.nextVisit = null; value.recent = []; value.depts = []; value.openAlertCount = 0;
    await route.fulfill({ response, json: value });
  });
  await page.goto('/login');
  await page.getByTestId('quick-login-b').click(); await page.getByTestId('login-submit').click();
  await expect(page.getByText('예정된 진료가 없어요.', { exact: true })).toBeVisible();
  await expect(page.getByText('아직 공유된 진료 기록이 없어요.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('briefing-link')).toHaveCount(0);
  await expect(page.getByTestId('questions-link')).toHaveCount(0);
});
