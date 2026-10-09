import { expect, test } from '@playwright/test';
import { auth, login, reset } from './helpers';
test.beforeEach(async ({ request }) => reset(request));

test('core scope management uses real PUT and refreshes the next guardian read with AI zero', async ({ page, context, request }) => {
  await login(page, 'patient');
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.getByTestId('sharing-member-u_b').click();
  const guardian = await context.browser()!.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const b = await guardian.newPage(); await login(b, 'b');
    const initial = await (await request.get('/api/__test/ai-calls')).json();
    for (const scope of ['schedule', 'full', 'companion']) {
      await page.getByTestId(`scope-${scope}`).check(); await page.getByTestId('scope-save').click();
      await expect(page.getByRole('status')).toContainText('저장했어요');
      const response = b.waitForResponse(r => /\/home(?:\?|$)/.test(r.url()));
      await b.evaluate(() => dispatchEvent(new Event('focus')));
      const data = await (await response).json();
      expect(Object.keys(data.recent[0].record.blocks)).toEqual(scope === 'schedule' ? ['schedule'] : scope === 'full' ? ['schedule', 'companion', 'full'] : ['schedule', 'companion']);
      if (scope === 'schedule') { await expect(b.getByTestId('questions-link')).toHaveCount(0); await expect(b.locator('main')).not.toContainText('바토디핀'); }
      else await expect(b.getByTestId('questions-link')).toBeVisible();
      if (scope !== 'full') expect(JSON.stringify(data)).not.toMatch(/sourceRefs|transcript|diagnosis|labResults|medReasons|answers|hidden|scope|가상질환|7.2%/);
    }
    await expect(page.getByTestId('share-log')).toContainText('범위 변경');
    expect(await (await request.get('/api/__test/ai-calls')).json()).toEqual(initial);
    const bHeaders = await auth(request, 'b'); const aHeaders = await auth(request, 'a');
    for (const headers of [bHeaders, aHeaders]) expect((await request.put('/api/patients/p_01/members/u_b/scope', { headers, data: { scope: 'full' } })).status()).toBe(403);
  } finally { await guardian.close(); }
});

test('ordinary full guardian gets no scope management, and C gets only schedule UI and API keys', async ({ page, request }) => {
  await login(page, 'a'); await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByTestId('sharing-member-u_b')).toHaveCount(0);
  await page.getByTestId('logout').click(); await login(page, 'c');
  await expect(page.getByTestId('questions-link')).toHaveCount(0);
  await expect(page.getByTestId('alert-card')).toHaveCount(0);
  await page.getByRole('link', { name: '타임라인', exact: true }).click();
  await expect(page.getByTestId('timeline-card-v_im_02')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('바토디핀');
  const data = await (await request.get('/api/patients/p_01/home?dept=내과', { headers: await auth(request, 'c') })).json();
  expect(Object.keys(data.nextVisit)).toEqual(['meta']); expect(data).not.toHaveProperty('openAlertCount');
});

test('a scope change in another tab immediately discards old blocks without transferring scope data', async ({ page, context }) => {
  await login(page, 'patient'); await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('sharing-member-u_b').click();
  const b = await context.newPage(); await login(b, 'b'); await expect(b.locator('main')).toContainText('바토디핀');
  await page.getByTestId('scope-schedule').check();
  const refreshed = b.waitForResponse(r => /\/home(?:\?|$)/.test(r.url()));
  await page.getByTestId('scope-save').click();
  expect(Object.keys((await (await refreshed).json()).nextVisit)).toEqual(['meta']);
  await expect(b.getByTestId('questions-link')).toHaveCount(0); await expect(b.locator('main')).not.toContainText('바토디핀');
  const broadcast = await b.evaluate(() => localStorage.getItem('baton.permissions-revision'));
  expect(broadcast).toMatch(/^[0-9a-f-]{36}$/); expect(broadcast).not.toMatch(/schedule|u_b|p_01/);
});
