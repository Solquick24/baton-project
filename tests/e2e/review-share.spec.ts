import { expect, test } from '@playwright/test';
import { auth, job, login, record, reset, visit } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('baton.onboarding', JSON.stringify({ version: 1, completedAt: Date.now(), lastVisitedAt: Date.now() })));
});
test.beforeEach(async ({ request }) => reset(request));

test('core record upload → transcription → note → structure → review → confirmed share uses real APIs', async ({ page, request }) => {
  await login(page, 'b'); await record(page, '혈압약 아침 반 알 그대로. 다음 진료 4월 9일 10시.');
  await expect(page.getByTestId('review-state')).toContainText('내용을 확인');
  await expect(page.getByTestId('draft-full-section')).toHaveCount(0);
  const a = await auth(request, 'a'); const c = await auth(request, 'c');
  expect(await (await request.get(visit, { headers: a })).json()).not.toHaveProperty('record');
  const timeline = await (await request.get('/api/patients/p_01/timeline?dept=내과', { headers: c })).json();
  expect(timeline.items.map((v: any) => v.meta.id)).not.toContain('v_im_03');
  await page.getByTestId('share-button').click();
  expect(await (await request.get(visit, { headers: a })).json()).not.toHaveProperty('record');
  const sent: any[] = []; page.on('request', req => { if (req.url().endsWith('/share')) sent.push(req.postDataJSON()); });
  await page.getByTestId('share-confirm').click(); await expect(page.getByRole('status')).toContainText('공유했어요');
  expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ draftVersion: 1, inputVersion: 2 }); expect(sent[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  for (const [account, kinds] of [['c', ['schedule']], ['b', ['schedule', 'companion']], ['a', ['schedule', 'companion', 'full']]] as const) {
    const headers = await auth(request, account); const res = await request.get(visit, { headers });
    expect(Object.keys((await res.json()).record.blocks)).toEqual(kinds);
  }
  const duplicate = await request.post(`${visit}/share`, { headers: await auth(request, 'b'), data: sent[0] });
  expect((await duplicate.json()).alreadyPublished).toBe(true);
  await page.getByRole('link', { name: '타임라인', exact: true }).click(); await expect(page.getByTestId('timeline-card-v_im_03')).toBeVisible();
  const calls = await (await request.get('/api/__test/ai-calls')).json(); expect(calls).toMatchObject({ llm: 1, stt: 1, departmentIsolated: true });
});

test('core full alert correction shows both sources and preserves confirmation and edit history', async ({ page }) => {
  await login(page, 'a'); await page.getByTestId('alerts-link').click();
  await page.locator('[data-testid^=alert-open-]').first().click();
  await expect(page.getByTestId('alert-left')).toContainText('저녁'); await expect(page.getByTestId('alert-right')).toContainText('아침');
  await page.getByTestId('resolve-hospital').click(); await expect(page.getByTestId('alert-status')).toContainText('병원 확인 예정');
  await page.getByTestId('resolve-edit').click(); await page.getByLabel('1회 복용량').fill('0.5정');
  await page.getByLabel('아침', { exact: true }).check(); await page.getByLabel('저녁', { exact: true }).uncheck();
  await page.getByLabel('수정한 메모').fill('바토디핀정 5mg 아침에 반 알 복용으로 메모를 고쳤어요.');
  await page.getByTestId('resolve-edit-save').click(); await expect(page.getByTestId('alert-status')).toContainText('해결됨');
  await expect(page.getByTestId('alert-history')).toContainText('메모 수정');
  await expect(page.getByTestId('alert-history')).toContainText('병원 확인 예정');
});

test('blocked review prevents UI sharing and direct API bypass; old shared record is preserved', async ({ page, request }) => {
  await login(page, 'b'); await record(page); await page.getByTestId('share-button').click(); await page.getByTestId('share-confirm').click(); await expect(page.getByRole('status')).toContainText('공유했어요');
  const b = await auth(request, 'b'); const a = await auth(request, 'a'); const old = await (await request.get(visit, { headers: a })).json();
  await request.post(`${visit}/notes`, { headers: b, data: { text: '혼입 시연' } });
  expect(await job(request, b, 'structure', { inputVersion: 2 })).toMatchObject({ resultState: 'blocked' });
  await page.reload(); await expect(page.getByTestId('review-blocked')).toBeVisible(); await expect(page.getByTestId('share-button')).toBeDisabled();
  expect((await request.post(`${visit}/share`, { headers: b, data: { draftVersion: 2, inputVersion: 2, idempotencyKey: crypto.randomUUID() } })).status()).toBe(409);
  expect(await (await request.get(visit, { headers: a })).json()).toEqual(old);
  await expect(page.locator('main')).not.toContainText('7.2%');
});

test('stale review refreshes on conflict, keeps the reviewed version and refuses share', async ({ page, request }) => {
  await login(page, 'b'); await record(page); await page.getByTestId('share-button').click();
  const headers = await auth(request, 'b'); await request.post(`${visit}/notes`, { headers, data: { text: '검토 뒤 입력 변경' } });
  const response = page.waitForResponse(r => r.url().endsWith('/share'));
  await page.getByTestId('share-confirm').click(); expect((await response).status()).toBe(409);
  await expect(page.getByTestId('review-stale')).toBeVisible(); await expect(page.getByTestId('share-button')).toBeDisabled();
  expect(await (await request.get(visit, { headers })).json()).not.toHaveProperty('record');
});

test('failed structure retains inputs, offers retry and succeeds without uploading again', async ({ page }) => {
  await login(page, 'b'); await page.getByTestId('record-link').click();
  await page.getByTestId('audio-input').setInputFiles({ name: 'virtual.wav', mimeType: 'audio/wav', buffer: Buffer.from('RIFF virtual audio only') });
  await page.getByTestId('transcribe-button').click(); await expect(page.getByTestId('transcribe-result')).toContainText('변환 완료');
  await page.getByTestId('note-input').fill('실패 시연'); await page.getByTestId('note-save').click(); await expect(page.getByRole('status')).toContainText('저장됨');
  await page.getByTestId('structure-button').click(); await expect(page.getByRole('alert')).toContainText('정리하지 못했어요');
  await page.getByTestId('structure-button').click(); await expect(page).toHaveURL(/review$/); await expect(page.getByTestId('share-button')).toBeEnabled();
});

test('an unknown share network outcome retries the identical UUID body and creates one publish log', async ({ page, request }) => {
  await login(page, 'b'); await record(page);
  const sent: any[] = [];
  await page.route('**/api/patients/p_01/visits/v_im_03/share', async route => {
    sent.push(route.request().postDataJSON());
    if (sent.length === 1) { const res = await route.fetch(); expect(res.status()).toBe(200); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByTestId('share-button').click(); await page.getByTestId('share-confirm').click();
  await expect(page.getByRole('alert')).toContainText('다시 시도');
  await page.getByTestId('share-button').click(); await page.getByTestId('share-confirm').click(); await expect(page.getByRole('status')).toContainText('공유했어요');
  expect(sent).toHaveLength(2); expect(sent[1]).toEqual(sent[0]);
  const logs = await (await request.get('/api/patients/p_01/share-log', { headers: await auth(request, 'patient') })).json();
  expect(logs.logs.filter((l: any) => l.visitId === 'v_im_03' && l.action === 'publish')).toHaveLength(1);
});

test('current scope revocation rejects a pending share and removes the previous review', async ({ page, request }) => {
  await login(page, 'b'); await record(page); await page.getByTestId('share-button').click();
  expect((await request.put('/api/patients/p_01/members/u_b/scope', { headers: await auth(request, 'patient'), data: { scope: 'schedule' } })).status()).toBe(200);
  const response = page.waitForResponse(r => r.url().endsWith('/share'));
  await page.getByTestId('share-confirm').click(); expect((await response).status()).toBe(403);
  await expect(page.getByTestId('review-record')).toHaveCount(0); await expect(page.getByTestId('share-button')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('바토디핀');
});

test('full-only audio fetch uses Bearer and releases its blob after scope refresh', async ({ page, request }) => {
  await login(page, 'b'); await record(page); await page.getByTestId('share-button').click(); await page.getByTestId('share-confirm').click(); await expect(page.getByRole('status')).toContainText('공유했어요');
  await request.put('/api/patients/p_01/members/u_b/scope', { headers: await auth(request, 'patient'), data: { scope: 'full' } });
  await page.getByRole('link', { name: '타임라인', exact: true }).click();
  const card = page.getByTestId('timeline-card-v_im_03'); await card.getByText('진료 내용과 근거 보기', { exact: true }).click();
  await page.evaluate(() => { const original = URL.revokeObjectURL; (window as any).revoked = []; URL.revokeObjectURL = url => { (window as any).revoked.push(url); original(url); }; });
  const source = page.waitForRequest(r => /\/sources\//.test(r.url())); await card.getByTestId('source-file').click();
  expect((await source).headers().authorization).toMatch(/^Bearer /); await expect(card.getByTestId('source-download')).toBeVisible();
  const blob = await card.getByTestId('source-download').getAttribute('href'); expect(blob).toMatch(/^blob:/);
  await request.put('/api/patients/p_01/members/u_b/scope', { headers: await auth(request, 'patient'), data: { scope: 'companion' } });
  await page.evaluate(() => dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('source-file')).toHaveCount(0); await expect(page.getByTestId('source-download')).toHaveCount(0);
  expect(await page.evaluate(url => (window as any).revoked.includes(url), blob)).toBe(true);
});
