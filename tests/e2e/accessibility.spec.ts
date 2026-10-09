import { expect, test, type Page } from '@playwright/test';
import { auth, login, record, reset } from './helpers';

async function layout(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`).toBe(true);
  const controls = page.locator('main button:visible, main a:visible, main input:visible, main textarea:visible, main summary:visible');
  for (let i = 0; i < await controls.count(); i++) {
    const el = controls.nth(i); await el.evaluate(e => e.scrollIntoView({ block: 'center' }));
    const b = await el.boundingBox(); expect(b, `${name}: missing control`).not.toBeNull();
    expect(b!.x, `${name}: left`).toBeGreaterThanOrEqual(0); expect(b!.x + b!.width, `${name}: right`).toBeLessThanOrEqual(391);
    const clipped = await el.evaluate(e => e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2);
    // Native radio/checkbox sizing excludes platform decoration.
    if (!await el.evaluate(e => e.matches('input[type=radio], input[type=checkbox]'))) expect(clipped, `${name}: clipped control text ${await el.evaluate(e => JSON.stringify({element:e.outerHTML, width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}))}`).toBe(false);
    if (b!.height <= 500) {
      const visible = await el.evaluate(e => { const b=e.getBoundingClientRect(), nav=document.querySelector('.bottom-nav')?.getBoundingClientRect(); const y=Math.min(b.bottom-2,b.top+b.height/2); return (!nav || y < nav.top) && (e===document.elementFromPoint(b.x+b.width/2,y) || e.contains(document.elementFromPoint(b.x+b.width/2,y))); });
      expect(visible, `${name}: covered control ${await el.evaluate(e => {const r=e.getBoundingClientRect();return JSON.stringify({element:e.outerHTML,rect:r.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,Math.min(r.bottom-2,r.top+r.height/2))?.outerHTML});})}`).toBe(true);
    }
  }
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}
async function large(page: Page) {
  await page.getByRole('link', { name: '설정', exact: true }).click();
  for (const [font, px] of [['normal',18],['large',22],['extra-large',26]] as const) {
    await page.getByTestId(`font-size-${font}`).check();
    await expect(page.locator('html')).toHaveCSS('font-size', `${px}px`);
  }
  await page.getByTestId('high-contrast').check();
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('html')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('.card').first()).toHaveCSS('border-top-width','3px');
}
test.beforeEach(async ({ request }) => reset(request));
test('390px maximum font/high contrast covers B home, questions, briefing, input, review and timeline', async ({ page }) => {
  await login(page,'b'); await large(page); await layout(page,'b-settings');
  await page.goto('/p/p_01'); await expect(page.getByTestId('questions-link')).toBeVisible(); await layout(page,'b-home');
  await page.getByTestId('questions-link').click(); await expect(page.getByTestId('merged-question-mq_03')).toBeVisible(); await layout(page,'b-questions');
  await page.goto('/p/p_01/visits/v_im_03/briefing'); await expect(page.getByTestId('briefing-questions')).toBeVisible(); await layout(page,'b-briefing');
  await page.getByTestId('record-link').click(); await expect(page.getByTestId('note-save')).toBeVisible(); await layout(page,'b-input');
  await page.goto('/p/p_01'); await record(page); await layout(page,'b-review');
  await page.getByTestId('share-button').click(); await layout(page,'b-confirm'); await page.getByTestId('share-confirm').click();
  await expect(page.getByRole('status')).toContainText('공유했어요');
  await page.getByRole('link',{name:'타임라인',exact:true}).click(); await expect(page.getByTestId('timeline-card-v_im_03')).toBeVisible(); await layout(page,'b-timeline');
});
test('390px maximum font/high contrast covers patient sharing, full evidence, alerts and static hospital', async ({ page, request }) => {
  await login(page,'patient'); await large(page); await page.getByTestId('sharing-member-u_b').click(); await expect(page.getByTestId('share-log')).toBeVisible(); await layout(page,'scope');
  await page.goto('/p/p_01/visits/v_im_03/questions'); await page.getByTestId('basis-mq_03').locator('summary').click(); await layout(page,'full-questions');
  await page.goto('/p/p_01/visits/v_im_03/briefing'); await page.getByText('이유와 원문 보기',{exact:true}).first().click(); await layout(page,'full-briefing');
  await page.goto('/p/p_01/alerts'); await page.locator('[data-testid^=alert-open-]').first().click(); await expect(page.getByTestId('alert-right')).toBeVisible(); await layout(page,'alert');
  await page.getByTestId('resolve-edit').click(); await layout(page,'alert-edit');
  const before=await (await request.get('/api/__test/ai-calls')).json();
  await page.goto('/hospitals/h_01'); await expect(page.getByTestId('hospital-map')).toBeVisible(); await layout(page,'hospital-map');
  await expect(page.locator('main')).toContainText('서울특별시 가상구 바통로 24'); await expect(page.getByRole('link',{name:'02-0000-0000 (가상 번호)'})).toHaveAttribute('href','tel:02-0000-0000');
  await page.getByRole('button',{name:'원내 약도',exact:true}).click(); await expect(page.getByTestId('guide-steps').locator('li')).toHaveCount(5); await layout(page,'hospital-floor');
  await expect(page.locator('main')).toContainText('공식 안내가 아닙니다'); await expect(page.locator('main .inner-card')).toHaveCount(3);
  await expect(page.getByRole('button',{name:/길찾기|경로 계산/})).toHaveCount(0); await expect(page.locator('a[href^="https://"]')).toHaveCount(0);
  expect(await (await request.get('/api/__test/ai-calls')).json()).toEqual(before);
  const h=await request.get('/api/hospitals/h_01',{headers:await auth(request,'c')}); expect(h.status()).toBe(200);
  await page.goto('/settings'); await page.getByTestId('logout').click(); await login(page,'b'); await record(page);
  await page.goto('/settings'); await page.getByTestId('logout').click(); await login(page,'patient');
  await page.goto('/p/p_01/visits/v_im_03/review'); await expect(page.getByTestId('draft-full-section')).toBeVisible(); await layout(page,'full-review');
  await page.getByTestId('share-button').click(); await page.getByTestId('share-confirm').click(); await expect(page.getByRole('status')).toContainText('공유했어요');
  await page.getByRole('link',{name:'타임라인',exact:true}).click(); await page.getByTestId('timeline-card-v_im_03').getByText('진료 내용과 근거 보기',{exact:true}).click(); await layout(page,'full-timeline');
});
test('display persists on page close/reopen, logout/login; settings controls work with keyboard', async ({ page, context }) => {
  await login(page,'b'); await page.getByRole('link',{name:'설정',exact:true}).click();
  await page.getByTestId('font-size-extra-large').focus(); await page.keyboard.press('Space');
  await page.getByTestId('high-contrast').focus(); await page.keyboard.press('Space');
  await expect(page.getByTestId('high-contrast')).toBeChecked(); await page.getByTestId('logout').click(); await layout(page,'login');
  await page.close(); const reopened=await context.newPage(); await reopened.goto('/login');
  await expect(reopened.locator('html')).toHaveAttribute('data-font','extra-large'); await expect(reopened.locator('html')).toHaveAttribute('data-contrast','true');
  await login(reopened,'c'); await expect(reopened.getByTestId('questions-link')).toHaveCount(0); await layout(reopened,'c-home');
  await reopened.getByRole('link',{name:'타임라인',exact:true}).click(); await expect(reopened.getByTestId('timeline-card-v_im_02')).toBeVisible(); await layout(reopened,'c-timeline');
});
test('invalid or unavailable display storage falls back safely and still allows changing settings', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('baton.display','{"font":"invalid","contrast":"yes"}'); const original=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(k==='baton.display') throw new Error('storage unavailable'); return original.call(this,k,v); }; });
  await login(page,'b'); await expect(page.locator('html')).toHaveAttribute('data-font','normal'); await large(page); await expect(page.getByTestId('high-contrast')).toBeChecked();
});
