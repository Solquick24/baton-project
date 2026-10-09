import { expect, type APIRequestContext, type Page } from '@playwright/test';
export const visit = '/api/patients/p_01/visits/v_im_03';
export async function login(page: Page, account: string) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(`${account}@baton.demo`);
  await page.getByTestId('login-password').fill('baton-demo-2026');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('next-visit-card')).toBeVisible();
}
export async function auth(api: APIRequestContext, account: string) {
  const res = await api.post('/api/auth/login', { data: { email: `${account}@baton.demo`, password: 'baton-demo-2026' } });
  expect(res.status()).toBe(200);
  return { Authorization: `Bearer ${(await res.json()).accessToken}` };
}
export async function job(api: APIRequestContext, headers: Record<string, string>, path: string, data: object) {
  const res = await api.post(`${visit}/${path}`, { headers, data }); expect(res.status()).toBe(202);
  const id = (await res.json()).jobId;
  await expect.poll(async () => (await (await api.get(`/api/jobs/${id}`, { headers })).json()).status).toMatch(/succeeded|failed/);
  return (await (await api.get(`/api/jobs/${id}`, { headers })).json());
}
export async function reset(api: APIRequestContext, pregenerate = true) {
  expect((await api.post('/api/__test/reset', { data: { pregenerate } })).status()).toBe(200);
}
export async function record(page: Page, note?: string) {
  await page.getByTestId('record-link').click();
  await page.getByTestId('audio-input').setInputFiles({ name: 'virtual.wav', mimeType: 'audio/wav', buffer: Buffer.from('RIFF virtual audio only') });
  await expect(page.getByTestId('transcribe-button')).toBeEnabled();
  await page.getByTestId('transcribe-button').click();
  await expect(page.getByTestId('transcribe-result')).toContainText('변환 완료');
  if (note) { await page.getByTestId('note-input').fill(note); await page.getByTestId('note-save').click(); await expect(page.getByTestId('note-message')).toContainText('메모를 저장했어요'); }
  await page.getByTestId('structure-button').click();
  await expect(page).toHaveURL(/\/review$/);
}
