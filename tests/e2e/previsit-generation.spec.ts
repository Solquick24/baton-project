import { expect, test } from '@playwright/test';

test('question merge and briefing buttons generate, poll and display stored fixture results through the real API', async ({ page, request }) => {
  expect((await request.post('/api/__test/reset', { data: { pregenerate: false } })).status()).toBe(200);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login');
  await page.getByTestId('login-email').fill('b@baton.demo');
  await page.getByTestId('login-password').fill('baton-demo-2026');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('questions-link').click();
  await expect(page.getByRole('heading', { name: '한눈에 보는 질문' })).toHaveCount(0);

  const mergedJob = page.waitForResponse(response => response.url().endsWith('/questions/merge') && response.request().method() === 'POST');
  await page.getByTestId('merge-button').click();
  const mergeResponse = await mergedJob;
  expect(mergeResponse.status()).toBe(202);
  const mergeId = (await mergeResponse.json()).jobId;
  await expect(page.getByRole('heading', { name: '한눈에 보는 질문' })).toBeVisible();
  await expect(page.locator('[data-testid^="merged-question-"]')).not.toHaveCount(0);
  await expect(page.getByText('저장된 결과', { exact: true })).toBeVisible();
  await expect(page.getByTestId('job-status')).toHaveCount(0);

  const briefingJob = page.waitForResponse(response => response.url().endsWith('/briefing') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '이 질문으로 브리핑 만들기' }).click();
  const briefingResponse = await briefingJob;
  expect(briefingResponse.status()).toBe(202);
  const briefingId = (await briefingResponse.json()).jobId;
  await expect(page).toHaveURL(/v_im_03\/briefing$/);
  await expect(page.getByTestId('briefing-changes')).toBeVisible();
  await expect(page.getByTestId('briefing-questions').locator('li')).not.toHaveCount(0);
  await expect(page.getByText('저장된 결과', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);

  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('baton.session')!));
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  for (const jobId of [mergeId, briefingId]) {
    const response = await request.get(`/api/jobs/${jobId}`, { headers });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'succeeded', mode: 'fixture', resultState: 'ready', errorCode: null });
  }
  for (const section of ['questions', 'briefing']) {
    const response = await request.get(`/api/patients/p_01/visits/v_im_03/${section}`, { headers });
    expect(response.status()).toBe(200);
    const result = await response.json();
    const saved = section === 'questions' ? result.merged : result;
    expect(saved).toMatchObject({ mode: 'fixture', stale: false });
    // B's companion response omits full-only state and evidence, even for ready results.
    expect(Object.keys(saved)).not.toContain('state');
    expect(Object.keys(saved.blocks)).not.toContain('full');
  }
  expect(await (await request.get('/api/__test/ai-calls')).json()).toEqual({ llm: 2, stt: 0, departmentIsolated: true });
});
