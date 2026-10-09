import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, account = 'b') {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(`${account}@baton.demo`);
  await page.getByTestId('login-password').fill('baton-demo-2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
}
test.beforeEach(async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
  expect((await request.post('/api/__test/reset', { data: {} })).status()).toBe(200);
});

test('briefing opens static hospital guidance and the recording screen', async ({ page, request }) => {
  await login(page); await page.getByTestId('briefing-link').click();
  await expect(page.getByTestId('briefing-changes')).toContainText('이전 진료');
  const questions = await page.getByTestId('briefing-questions').boundingBox();
  expect(questions!.y + questions!.height).toBeLessThanOrEqual(844);
  await expect(page.getByTestId('briefing-tests')).toHaveCount(0);
  await expect(page.getByTestId('briefing-changes').getByText('원문 보기')).toHaveCount(0);
  await page.getByTestId('hospital-link').click();
  await page.getByRole('tab', { name: '원내 약도' }).click();
  await expect(page.getByTestId('guide-steps').locator('li')).toHaveCount(5);
  await expect.poll(() => page.getByTestId('hospital-floor').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole('link', { name: '진료 전 브리핑으로' }).click();
  await expect(page.getByTestId('briefing-questions')).toBeVisible();
  await page.screenshot({ path: '/tmp/baton-wireframe-briefing.png', fullPage: true });
  await page.getByTestId('record-link').click();
  await expect(page.getByTestId('recorder-start')).toBeVisible();
  await page.screenshot({ path: '/tmp/baton-wireframe-recording.png', fullPage: true });
  expect((await (await request.get('/api/__test/ai-calls')).json()).llm).toBe(0);
});

test('real MediaRecorder → fixture transcription → optional documents → real draft → explicit share', async ({ page, request }) => {
  await login(page); await page.getByTestId('record-link').click();
  await page.getByTestId('recorder-start').click();
  await expect(page.getByTestId('recorder-stop')).toBeVisible();
  await expect(page.getByTestId('recording-time')).not.toHaveText('00:00');
  await page.getByTestId('recorder-stop').click();
  await expect(page).toHaveURL(/\/documents$/);
  await page.getByRole('link', { name: '문서 없이 계속하기' }).click();
  await page.getByTestId('document-structure').click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByTestId('review-state')).toContainText('저장된 결과');
  const token = (await (await request.post('/api/auth/login', { data: { email: 'a@baton.demo', password: 'baton-demo-2026' } })).json()).accessToken;
  const published = await request.get('/api/patients/p_01/visits/v_im_03', { headers: { Authorization: `Bearer ${token}` } });
  expect(await published.json()).not.toHaveProperty('record');
  await page.getByTestId('share-button').click(); await page.getByTestId('share-confirm').click();
  await expect(page.getByRole('status')).toContainText('공유했어요');
  const calls = await (await request.get('/api/__test/ai-calls')).json();
  expect(calls).toMatchObject({ llm: 1, stt: 1, departmentIsolated: true });
});

test('denied microphone leaves file upload and stored review available', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await login(page); await page.getByTestId('record-link').click();
  await page.getByTestId('recorder-start').click();
  await expect(page.getByRole('alert')).toContainText('마이크 사용을 허용하지');
  await page.getByTestId('audio-input').setInputFiles({ name: 'virtual.wav', mimeType: 'audio/wav', buffer: Buffer.from('RIFF virtual audio only') });
  await page.getByTestId('transcribe-button').click();
  await expect(page.getByTestId('transcribe-result')).toContainText('변환 완료');
  await page.getByTestId('structure-button').click(); await expect(page).toHaveURL(/\/review$/);
});

test('recording stops on screen exit and schedule-only account cannot enter it', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      Object.defineProperty(window, 'batonTestStream', { value: stream, configurable: true });
      return stream;
    };
  });
  await login(page); await page.getByTestId('record-link').click();
  await page.getByTestId('recorder-start').click();
  await expect(page.getByTestId('recorder-stop')).toBeVisible();
  await page.getByRole('link', { name: '설정', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect.poll(() => page.evaluate(() => (window as Window & { batonTestStream?: MediaStream }).batonTestStream?.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  await page.getByTestId('logout').click(); await login(page, 'c');
  await expect(page.getByTestId('record-link')).toHaveCount(0);
  await page.goto('/p/p_01/visits/v_im_03/record');
  await expect(page.getByRole('heading', { name: '찾을 수 없어요' })).toBeVisible();
  await expect(page.getByTestId('recorder-start')).toHaveCount(0);
});

test('shared timeline opens saved easy summary and same-department chronological flow without generation', async ({ page, request }) => {
  await login(page); await page.getByRole('link', { name: '타임라인', exact: true }).click();
  await page.getByTestId('timeline-card-v_im_02').getByRole('link', { name: '쉬운 진료 요약' }).click();
  await expect(page.getByRole('heading', { name: '쉬운 말 진료 요약' })).toBeVisible();
  await expect(page.locator('main').getByText('원문 보기', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '← 타임라인' }).click();
  await page.getByRole('link', { name: '날짜순 진료 흐름 보기' }).click();
  await expect(page.getByTestId('flow-card-v_im_01')).toBeVisible();
  await expect(page.getByTestId('flow-card-v_os_01')).toHaveCount(0);
  expect((await (await request.get('/api/__test/ai-calls')).json()).llm).toBe(0);
});

test('consent, invitation and schedule previews are reachable and never send mutations', async ({ page }) => {
  await login(page); const mutations: string[] = [];
  page.on('request', req => { if (req.method() !== 'GET') mutations.push(req.url()); });
  for (const kind of ['consent', 'invite', 'schedule']) {
    await page.getByRole('link', { name: '설정', exact: true }).click();
    await page.locator(`a[href="/preview/${kind}"]`).click();
    await expect(page.locator('main')).toContainText('화면 시연');
    if (kind === 'invite') await page.getByLabel('가상 가족 이메일').fill('family@baton.demo');
    if (kind === 'schedule') {
      await page.getByLabel('날짜', { exact: true }).fill('2026-04-09');
      await page.getByLabel('시간', { exact: true }).fill('10:00');
      await page.getByLabel('진료과', { exact: true }).fill('내과');
    }
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: '화면 확인하기' }).click();
    await expect(page.getByRole('status')).toContainText('처리하지 않았어요');
  }
  expect(mutations).toEqual([]);
});

test('full briefing displays saved tests and preparation while hospital guide is public', async ({ page }) => {
  await login(page, 'a'); await page.getByTestId('briefing-link').click();
  await expect(page.getByTestId('briefing-tests')).toContainText('피검사');
  await expect(page.getByTestId('briefing-prep')).toContainText('기록에 없어요');
  await expect(page.getByTestId('briefing-prep')).toContainText('확인 필요');
  await page.getByTestId('hospital-link').click();
  await expect(page.getByTestId('hospital-floor')).toBeVisible();
});

test('document preview preserves the selection but never sends raw documents or pretend OCR to the API', async ({ page, request }) => {
  await login(page, 'a'); await page.getByTestId('record-link').click();
  await page.getByTestId('documents-link').click();
  await page.getByTestId('document-input').setInputFiles({ name: 'virtual.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2S8AAAAASUVORK5CYII=', 'base64') });
  const mutations: string[] = []; page.on('request', req => { if (req.method() !== 'GET') mutations.push(req.url()); });
  await page.getByTestId('document-next').click();
  await expect(page.getByTestId('document-original')).toBeVisible();
  await page.getByLabel('문서에서 읽은 내용').fill('직접 확인한 가상 문서 내용');
  await page.getByRole('link', { name: '← 문서 올리기' }).click();
  await expect(page.locator('main')).toContainText('virtual.png');
  expect(mutations).toEqual([]);
  expect((await (await request.get('/api/__test/ai-calls')).json()).llm).toBe(0);
});

test('companion document confirmation never renders originals or extraction inputs', async ({ page }) => {
  await login(page); await page.getByTestId('record-link').click(); await page.getByTestId('documents-link').click();
  await page.getByTestId('document-input').setInputFiles({ name: 'virtual.png', mimeType: 'image/png', buffer: Buffer.from('virtual document only') });
  await page.getByTestId('document-next').click();
  await expect(page.locator('main')).toContainText('자동 판독 결과가 아니');
  await expect(page.getByTestId('document-original')).toHaveCount(0);
  await expect(page.getByLabel('문서에서 읽은 내용')).toHaveCount(0);
});

test('private note is patient-only, opted into doctor view, cleared on logout, and excluded from AI', async ({ page, request }) => {
  await login(page, 'patient'); await page.getByTestId('briefing-link').click();
  await page.getByTestId('private-notes-link').click();
  await page.getByTestId('private-note-input').fill('가상 비공개 메모 테스트');
  await page.getByTestId('private-note-include').check(); await page.getByTestId('private-note-save').click();
  await page.getByTestId('doctor-view-link').click(); await expect(page.getByTestId('doctor-private-notes')).toContainText('가상 비공개 메모 테스트');
  expect((await (await request.get('/api/__test/ai-calls')).json()).llm).toBe(0);
  await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('logout').click();
  await login(page, 'patient'); await page.goto('/p/p_01/visits/v_im_03/doctor-view');
  await expect(page.getByTestId('doctor-private-notes')).toHaveCount(0);
  await page.getByRole('link', { name: '설정', exact: true }).click(); await page.getByTestId('logout').click();
  await login(page, 'a'); await page.goto('/p/p_01/visits/v_im_03/private-notes');
  await expect(page.locator('main')).toContainText('환자 본인만'); await expect(page.getByTestId('private-note-input')).toHaveCount(0);
});

test('experience remains an explicit preview and large high contrast screens do not overflow', async ({ page, request }) => {
  await login(page); await page.getByRole('link', { name: '설정', exact: true }).click();
  await page.getByTestId('font-size-extra-large').check(); await page.getByTestId('high-contrast').check();
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/p/p_01/visits/v_im_03/experience', '/hospital/h_01?tab=floor', '/p/p_01/visits/v_im_03/documents']) {
    await page.goto(path); await expect(page.getByText('가상 데이터', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/p/p_01/visits/v_im_03/experience');
  await page.getByTestId('experience-confirm').click(); await expect(page.getByTestId('experience-preview')).toContainText('공개하지 않았어요');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await (await request.get('/api/__test/ai-calls')).json()).llm).toBe(0);
});
