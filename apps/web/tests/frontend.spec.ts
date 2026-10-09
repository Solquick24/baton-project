import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});

async function login(page: Page, account: string) {
  await page.goto('/login'); await page.getByTestId(`quick-login-${account}`).click(); await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
}
async function apiLogin(api: APIRequestContext, account: string) {
  const res = await api.post('/api/auth/login', { data: { email: `${account}@baton.demo`, password: 'baton-demo-2026' } });
  expect(res.status()).toBe(200);
  return { Authorization: `Bearer ${(await res.json()).accessToken}` };
}
test('잘못된 로그인은 폼에서 오류를 표시한다', async ({ page }) => {
  await page.goto('/login'); await page.getByTestId('login-email').fill('b@baton.demo'); await page.getByTestId('login-password').fill('incorrect'); await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert')).toContainText('이메일 또는 비밀번호'); await expect(page).toHaveURL(/login$/);
});
test('B가 변경 두 개와 질문 세 개를 첫 화면에서 읽는다', async ({ page }) => {
  await login(page, 'b'); await expect(page.getByTestId('alert-card')).toHaveCount(0);
  await page.getByTestId('briefing-link').click();
  await expect(page.getByText('한빛가상병원 · 동행 박지후', { exact: false })).toBeVisible();
  await expect(page.getByTestId('briefing-changes')).toContainText('바토디핀정');
  await expect(page.locator('[data-testid^="change-"]')).toHaveCount(2);
  await expect(page.getByTestId('briefing-questions').locator('li')).toHaveCount(3);
  await page.screenshot({ path: '/tmp/baton-fe-briefing.png', fullPage: true });
  const rect = await page.getByTestId('briefing-questions').boundingBox();
  const nav = await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox();
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(nav!.y);
  await expect(page.locator('[data-testid^="source-button-"]')).toHaveCount(0);
  await expect(page.getByTestId('briefing-watch')).toHaveCount(0);
});
test('C 홈과 직접 질문·브리핑 주소에 제한 내용이 없다', async ({ page, request }) => {
  await login(page, 'c'); await expect(page.getByTestId('questions-link')).toHaveCount(0); await expect(page.getByTestId('briefing-link')).toHaveCount(0); await expect(page.getByTestId('alert-card')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('바토디핀');
  const headers = await apiLogin(request, 'c');
  const home = await (await request.get('/api/patients/p_01/home?dept=내과', { headers })).json();
  expect(Object.keys(home)).not.toContain('openAlertCount'); expect(Object.keys(home.nextVisit)).not.toContain('questionCount'); expect(Object.keys(home.nextVisit)).not.toContain('briefingReady');
  expect(Object.keys(home.recent[0].record.blocks)).toEqual(['schedule']);
  for (const section of ['questions', 'briefing']) expect((await request.get(`/api/patients/p_01/visits/v_im_03/${section}`, { headers })).status()).toBe(404);
  await page.goto('/p/p_01/visits/v_im_03/briefing'); await expect(page.getByRole('heading', { name: '찾을 수 없어요' })).toBeVisible();
});
test('A는 근거를 펼쳐 보고 없는 준비사항을 확인한다', async ({ page }) => {
  await login(page, 'a'); await expect(page.getByTestId('alert-card')).toContainText('1건');
  await page.getByTestId('questions-link').click(); await page.getByTestId('basis-mq_03').locator('summary').click();
  await expect(page.getByTestId('basis-mq_03')).toContainText('저녁 혈압약');
  await page.getByRole('link', { name: '가족 기록', exact: false }).click(); await page.getByTestId('briefing-link').click();
  await expect(page.getByTestId('briefing-prep')).toContainText('기록에 없어요'); await expect(page.getByTestId('briefing-prep')).toContainText('확인 필요');
});
test('B 응답에는 full·불일치·원문·정형외과 값이 없다', async ({ request }) => {
  const headers = await apiLogin(request, 'b');
  for (const suffix of ['home?dept=내과', 'timeline?dept=내과', 'visits/v_im_02', 'visits/v_im_03/questions', 'visits/v_im_03/briefing']) {
    const res = await request.get(`/api/patients/p_01/${suffix}`, { headers }); expect(res.status()).toBe(200); const data = await res.json(); const text = JSON.stringify(data);
    for (const forbidden of ['"full"', 'sourceRefs', 'basisRefs', 'openAlertCount', '가상질환', '가상지표', '7.2', '낮게 나와', 'v_os_01', '가상록소정', '"scope"', '"state"']) expect(text).not.toContain(forbidden);
  }
  const outsider = await apiLogin(request, 'outsider'); expect((await request.get('/api/patients/p_01/home', { headers: outsider })).status()).toBe(403);
});
test('진료과 필터와 로그아웃 후 계정 전환에서 기록이 섞이지 않는다', async ({ page }) => {
  await login(page, 'a'); await page.getByRole('link', { name: '타임라인', exact: true }).click();
  await page.getByTestId('timeline-dept-정형외과').click(); await expect(page.getByTestId('timeline-card-v_os_01')).toBeVisible(); await expect(page.getByTestId('timeline-card-v_im_02')).toHaveCount(0);
  await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('logout').click(); await expect(page).toHaveURL(/login$/);
  await login(page, 'c'); await expect(page.locator('main')).not.toContainText('가상질환');
});
test('큰 글씨·고대비가 유지되고 가로 넘침이 없다', async ({ page }) => {
  await login(page, 'b'); await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('font-size-extra-large').check(); await page.getByTestId('high-contrast').check();
  await page.getByRole('link', { name: '홈', exact: true }).click(); await page.getByTestId('briefing-link').click(); await expect(page.getByTestId('briefing-questions').locator('li')).toHaveCount(3);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-font', 'extra-large'); await expect(page.locator('html')).toHaveAttribute('data-contrast', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
});
test('401은 세션과 화면을 비우고 로그인으로 이동한다', async ({ page }) => {
  await login(page, 'b');
  await page.route('**/api/patients/**/timeline?*', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: '다시 로그인해 주세요.' } }) }));
  await page.getByRole('link', { name: '타임라인', exact: true }).click(); await expect(page).toHaveURL(/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('baton.session'))).toBeNull(); await expect(page.locator('main')).not.toContainText('바토디핀');
});
test('질문 통합과 브리핑은 202 작업으로 처리한다', async ({ page }) => {
  await login(page, 'b'); await page.getByTestId('questions-link').click();
  const response = page.waitForResponse(r => r.url().endsWith('/questions/merge') && r.request().method() === 'POST');
  await page.getByTestId('merge-button').click(); expect((await response).status()).toBe(202); await expect(page.getByTestId('job-status')).toBeVisible(); await expect(page.getByTestId('job-status')).toHaveCount(0);
  await page.getByRole('button', { name: '이 질문으로 브리핑 만들기' }).click(); await expect(page).toHaveURL(/briefing$/); await expect(page.getByTestId('briefing-questions')).toBeVisible();
});
test('B의 미연결 등록은 실패 안내와 입력을 유지한다', async ({ page, request }) => {
  await login(page, 'b'); await page.getByTestId('questions-link').click();
  await page.getByTestId('question-input').fill('새로 확인하고 싶은 질문'); await page.getByTestId('question-submit').click();
  await expect(page.getByRole('alert')).toContainText('질문 등록은 준비 중'); await expect(page.getByTestId('question-input')).toHaveValue('새로 확인하고 싶은 질문');
  const headers = await apiLogin(request, 'b'); const response = await request.post('/api/patients/p_01/visits/v_im_03/questions/merge', { headers, data: { inputVersion: 0 } });
  expect(response.status()).toBe(409); expect((await response.json()).error.reason).toBe('stale_input');
});
test('최신 blocked 응답을 받은 full 화면은 낮은 결과를 표시하지 않는다', async ({ page }) => {
  await login(page, 'a');
  await page.route('**/api/patients/p_01/visits/v_im_03/questions', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.merged.state = 'blocked'; delete data.merged.blocks.companion;
    await route.fulfill({ response, json: data });
  });
  await page.getByTestId('questions-link').click(); await expect(page.getByText('질문을 다시 정리해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('merged-question-mq_01')).toHaveCount(0); await expect(page.getByRole('button', { name: '이 질문으로 브리핑 만들기' })).toBeDisabled();
  await page.route('**/api/patients/p_01/visits/v_im_03/briefing', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.state = 'blocked'; delete data.blocks.companion; data.questions = [];
    await route.fulfill({ response, json: data });
  });
  await page.goto('/p/p_01/visits/v_im_03/briefing'); await expect(page.getByText('브리핑을 다시 정리해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('briefing-changes')).toHaveCount(0); await expect(page.getByTestId('briefing-questions')).toHaveCount(0);
});
test('개발용 조회도 새 계약의 진료과·초안 선택 규칙을 따른다', async ({ request }) => {
  const headers = await apiLogin(request, 'b');
  for (const suffix of ['timeline', 'timeline?dept=존재하지않음', 'home?dept=존재하지않음']) expect((await request.get(`/api/patients/p_01/${suffix}`, { headers })).status()).toBe(400);
  expect((await request.get('/api/patients/p_01/visits/v_im_02?view=draft', { headers })).status()).toBe(404);
});
test('작업 중 화면을 떠나면 폴링을 중단한다', async ({ page }) => {
  await login(page, 'a'); await page.getByTestId('questions-link').click();
  let polls = 0;
  await page.route('**/api/jobs/*', route => { polls++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'pending', status: 'running' }) }); });
  await page.getByTestId('merge-button').click(); await expect.poll(() => polls).toBeGreaterThan(0);
  await page.getByRole('link', { name: '가족 기록', exact: false }).click(); const stopped = polls; await page.waitForTimeout(2200); expect(polls).toBe(stopped);
});
test('새 입력을 저장된 예시로 성공 처리하지 않는다', async ({ page }) => {
  await login(page, 'patient'); await page.getByTestId('questions-link').click();
  await page.getByTestId('question-input').fill('추가 확인 질문'); await page.getByTestId('question-submit').click(); await expect(page.getByRole('heading', { name: '가족이 남긴 질문 4개' })).toBeVisible();
  await expect(page.getByText('새 질문이 있어요. 다시 정리할까요?')).toBeVisible(); await page.getByTestId('merge-button').click();
  await expect(page.getByRole('alert')).toContainText('이 입력에 맞는 저장된 결과가 없어요');
  await expect(page.getByRole('button', { name: '이 질문으로 브리핑 만들기' })).toBeDisabled();
});
