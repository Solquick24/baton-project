import { expect, test } from '@playwright/test';
import { auth, login, reset, visit } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});
test.beforeEach(async ({ request }) => reset(request));

test('B generates questions 3 → merged 2 plus AI 1 → briefing using real jobs without full leakage', async ({ page, request }) => {
  await reset(request, false); await login(page, 'b'); await page.getByTestId('questions-link').click();
  await expect(page.getByRole('heading', { name: '가족이 남긴 질문 3개' })).toBeVisible();
  await expect(page.locator('main')).toContainText('박지원');
  await page.getByTestId('merge-button').click();
  await expect(page.locator('[data-testid^=merged-question-]')).toHaveCount(3);
  await expect(page.getByTestId('ai-added-badge')).toHaveCount(1);
  await expect(page.locator('[data-testid^=basis-]')).toHaveCount(0);
  await page.getByRole('button', { name: '이 질문으로 브리핑 만들기' }).click();
  await expect(page).toHaveURL(/briefing$/); await expect(page.getByTestId('briefing-changes')).toBeVisible();
  await expect(page.getByTestId('briefing-questions').locator('li')).toHaveCount(3);
  await expect(page.locator('[data-testid^=source-button-]')).toHaveCount(0);
  await expect(page.getByTestId('briefing-prep')).toHaveCount(0);
  const data = await (await request.get(`${visit}/briefing`, { headers: await auth(request, 'b') })).json();
  expect(Object.keys(data.blocks)).toEqual(['companion']);
  expect(JSON.stringify(data)).not.toMatch(/sourceRefs|basisRefs|quote|changeReasons|scope|hidden|7.2%|가상질환|가상록소정/);
  const questions = await (await request.get(`${visit}/questions`, { headers: await auth(request, 'b') })).json();
  expect(questions.merged.blocks.companion.mergedQuestions.filter((q: any) => !q.addedByAI).map((q: any) => q.fromQuestionIds)).toEqual([['q_01', 'q_02'], ['q_03']]);
  const bounds = await page.getByTestId('briefing-questions').boundingBox(); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  const before = await (await request.get('/api/__test/ai-calls')).json();
  for (let i = 0; i < 10; i++) expect((await request.get(`${visit}/briefing`, { headers: await auth(request, 'b') })).status()).toBe(200);
  expect(await (await request.get('/api/__test/ai-calls')).json()).toEqual(before); expect(before).toMatchObject({ llm: 2, stt: 0, departmentIsolated: true });
});

test('A gets real stored full evidence and null prep, login persists, department switch stays isolated', async ({ page }) => {
  await login(page, 'a'); await page.reload(); await expect(page.getByTestId('next-visit-card')).toBeVisible();
  await page.getByTestId('questions-link').click();
  await page.getByTestId('basis-mq_03').locator('summary').click();
  await expect(page.getByTestId('basis-mq_03')).toContainText('저녁 혈압약');
  await page.getByRole('link', { name: '가족 기록', exact: false }).first().click();
  await page.getByTestId('briefing-link').click(); await expect(page.getByTestId('briefing-prep')).toContainText('기록에 없어요');
  await expect(page.getByTestId('briefing-prep')).toContainText('확인 필요');
  await page.getByText('이유와 원문 보기', { exact: true }).first().click();
  await expect(page.locator('[data-testid^=source-button-]').first()).toBeVisible();
  await page.locator('[data-testid^=source-button-]').first().locator('summary').click();
  await expect(page.locator('blockquote').first()).not.toBeEmpty();
  await page.getByRole('link', { name: '타임라인', exact: true }).click();
  await expect(page.getByTestId('timeline-card-v_im_02')).toBeVisible();
  await page.getByTestId('timeline-dept-정형외과').click(); await expect(page.getByTestId('timeline-card-v_os_01')).toBeVisible();
  await expect(page.getByTestId('timeline-card-v_im_02')).toHaveCount(0);
});

test('real question submission is stored; fixture mismatch fails rather than fake success and older merged becomes stale', async ({ page, request }) => {
  await login(page, 'b'); await page.getByTestId('questions-link').click();
  await page.getByTestId('question-input').fill('다음 진료 날짜도 다시 확인하고 싶어요.'); await page.getByTestId('question-submit').click();
  await expect(page.getByRole('heading', { name: '가족이 남긴 질문 4개' })).toBeVisible();
  await expect(page.locator('main')).toContainText('새 질문이 있어요'); await expect(page.getByTestId('question-input')).toHaveValue('');
  await page.getByTestId('merge-button').click(); await expect(page.getByRole('alert')).toContainText('정리하지 못했어요');
  const questions = await (await request.get(`${visit}/questions`, { headers: await auth(request, 'b') })).json();
  expect(questions.questionsInputVersion).toBe(4); expect(questions.merged.stale).toBe(true);
});

test('all four real accounts log in and outsiders get denied without patient content', async ({ page }) => {
  for (const account of ['patient', 'a', 'b', 'c']) { await login(page, account); await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('logout').click(); }
  await page.getByTestId('login-email').fill('outsider@baton.demo'); await page.getByTestId('login-password').fill('baton-demo-2026'); await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: '아직 내 진료 기록이 없어요' })).toBeVisible();
  await page.goto('/p/p_01'); await expect(page.locator('.state')).toContainText('불러오지 못했어요');
  await expect(page.locator('main')).not.toContainText('바토디핀');
});
