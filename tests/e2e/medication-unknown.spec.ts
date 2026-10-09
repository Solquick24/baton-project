import { expect, test } from '@playwright/test';
import { login, reset } from './helpers';

test('unknown medication values remain unknown instead of claiming treatment started or stopped', async ({ page, request }) => {
  await reset(request);
  await page.route('**/api/patients/p_01/home*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const medication = data.recent.find((visit: any) => visit.meta.id === 'v_im_02').record.blocks.companion.medChanges[0];
    Object.assign(medication, { change: 'keep', from: null, to: null, needsCheck: true });
    await route.fulfill({ response, json: data });
  });
  await login(page, 'b');
  const history = page.getByTestId('recent-visit-v_im_02');
  await expect(history.locator('.recent-details > summary')).toContainText('확인 필요');
  await history.locator('.recent-details > summary').click();
  const medication = page.getByTestId('recent-visit-v_im_02').locator('p').filter({ has: page.locator('strong') }).first();
  await expect(medication).toBeVisible();
  await expect(medication).toContainText('기록에 없어요 → 기록에 없어요');
  await expect(medication).toContainText('확인 필요');
  await expect(medication).not.toContainText('복용 시작');
  await expect(medication).not.toContainText('복용 중단');
});
