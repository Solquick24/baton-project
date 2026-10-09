import { expect, test, type Page } from '@playwright/test';
import { login, reset } from './helpers';

async function inputPage(page: Page) {
  await login(page,'b'); await page.getByTestId('record-link').click();
  await expect(page.getByTestId('note-input')).toBeVisible();
}
test.beforeEach(async({request})=>reset(request));
test('idle without code changes has no reload/poll loop; tab return keeps the draft and question checks',async({page,context})=>{
  let hmrUpdates=0;
  page.on('websocket', socket => socket.on('framereceived', frame => { if (/"type":"(?:update|full-reload)"/.test(String(frame.payload))) hmrUpdates++; }));
  await inputPage(page);
  const note=page.getByTestId('note-input'), check=page.locator('main input[type=checkbox]').first();
  await note.fill('아직 저장하지 않은 가상 메모'); await check.check();
  let reads=0,polls=0,navigations=0;
  page.on('request',r=>{if(r.method()==='GET' && r.url().includes('/api/')) reads++;if(r.url().includes('/api/jobs/')) polls++;});
  page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
  await page.waitForTimeout(4500); const before=reads; await page.waitForTimeout(2100);
  expect(reads).toBe(before);expect(polls).toBe(0);expect(navigations).toBe(0);expect(hmrUpdates).toBe(0);
  await expect(note).toHaveValue('아직 저장하지 않은 가상 메모');await expect(check).toBeChecked();
  const other=await context.newPage();await other.goto('/login');await other.bringToFront();await page.bringToFront();
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
  await expect(note).toHaveValue('아직 저장하지 않은 가상 메모');await expect(check).toBeChecked();
  await expect(page.getByTestId('structure-button')).toBeVisible();await other.close();
});
test('memo save refresh never replaces the input form, keeps success/check/scroll and uses the latest version immediately',async({page})=>{
  await inputPage(page);
  await page.getByTestId('audio-input').setInputFiles({name:'virtual.wav',mimeType:'audio/wav',buffer:Buffer.from('RIFF virtual fixture')});
  await page.getByTestId('transcribe-button').click();await expect(page.getByTestId('transcribe-result')).toBeVisible();
  const note=page.getByTestId('note-input');await note.fill('다음 진료 4월 9일 10시');
  await page.locator('main input[type=checkbox]').first().check();
  await note.evaluate(e=>(window as any).originalNote=e);
  await page.route('**/record-input',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,600));await route.fulfill({response});});
  const beforeScroll=await page.getByTestId('note-save').evaluate(e=>{e.scrollIntoView({block:'center'});return window.scrollY;});
  await page.getByTestId('note-save').click();await expect(page.getByTestId('note-message')).toContainText('저장했어요');
  await expect(page.getByTestId('structure-button')).toBeEnabled();
  expect(Math.abs(await page.evaluate(()=>scrollY)-beforeScroll)).toBeLessThan(80);
  await expect(note).toBeVisible();await expect(note).toHaveValue('다음 진료 4월 9일 10시');
  expect(await note.evaluate(e=>e===(window as any).originalNote)).toBe(true);
  await expect(page.locator('main input[type=checkbox]').first()).toBeChecked();
  // A newly typed unsaved edit stays local during a metadata refresh and must be saved before structuring.
  await note.fill('저장되지 않은 다음 입력');await expect(page.getByTestId('structure-button')).toBeDisabled();
  await note.fill('다음 진료 4월 9일 10시');
  const posted=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/structure'));
  await page.getByTestId('structure-button').click();expect((await posted).postDataJSON().inputVersion).toBe(2);
  await expect(page).toHaveURL(/review$/);
});
test('memo failure retains input; validation failure can retry a succeeded same-input job, then explicit share leads to history',async({page})=>{
  await inputPage(page);
  await page.getByTestId('audio-input').setInputFiles({name:'virtual.wav',mimeType:'audio/wav',buffer:Buffer.from('RIFF virtual fixture')});
  await page.getByTestId('transcribe-button').click();await expect(page.getByTestId('transcribe-result')).toBeVisible();
  await page.getByTestId('note-input').fill('다음 진료 4월 9일 10시');
  await page.route('**/notes',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{code:'internal',message:'메모 저장을 완료하지 못했어요.'}})}),{times:1});
  await page.getByTestId('note-save').click();await expect(page.getByRole('alert')).toContainText('메모 저장');await expect(page.getByTestId('note-input')).toHaveValue('다음 진료 4월 9일 10시');
  await page.getByTestId('note-save').click();await expect(page.getByTestId('note-message')).toContainText('저장했어요');
  const acceptedIds:string[]=[];
  page.on('response',async response=>{if(response.request().method()==='POST'&&response.url().endsWith('/structure')&&response.status()===202)acceptedIds.push((await response.json()).jobId);});
  // Fault injection at the polling response only: the real job completes once; retry reuses it.
  await page.route('**/api/jobs/*',async route=>{
    let response=await route.fetch(), j=await response.json();
    for(let i=0;i<20 && j.status!=='succeeded';i++){await new Promise(r=>setTimeout(r,100));response=await route.fetch();j=await response.json();}
    expect(j.status).toBe('succeeded');
    await route.fulfill({response,json:{...j,status:'failed',errorCode:'validation_failed',mode:null,resultState:null,resultVersion:null}});
  },{times:1});
  await page.getByTestId('structure-button').click();await expect(page.getByRole('alert')).toContainText('응답 검증');
  await expect(page.getByTestId('note-input')).toHaveValue('다음 진료 4월 9일 10시');await expect(page).toHaveURL(/record$/);
  await page.getByTestId('structure-button').click();await expect(page).toHaveURL(/review$/);
  await expect.poll(()=>acceptedIds.length).toBe(2);expect(acceptedIds[1]).toBe(acceptedIds[0]);
  expect(await(await page.request.get('/api/__test/ai-calls')).json()).toMatchObject({llm:1,stt:1});
  await expect(page.getByTestId('review-state')).toContainText('저장된 대체 결과');
  await page.getByTestId('share-button').click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByTestId('share-confirm').click();
  await expect(page.getByRole('status')).toContainText('공유했어요');await page.getByTestId('shared-history-link').click();await expect(page.getByTestId('timeline-card-v_im_03')).toBeVisible();
});
test('read failures do not retry on a timer; actual permission revocation removes the draft and cannot restore old inputs',async({page,request})=>{
  await inputPage(page);await page.getByTestId('note-input').fill('권한 철회 전 미저장 가상 메모');
  let failedReads=0;
  await page.route('**/record-input',route=>{failedReads++;return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{code:'internal_error',message:'입력 정보 확인 실패'}})});});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByText('입력 정보를 확인하지 못했어요.',{exact:false})).toBeVisible();
  const count=failedReads;await page.waitForTimeout(2300);expect(failedReads).toBe(count);await expect(page.getByTestId('note-input')).toHaveValue('권한 철회 전 미저장 가상 메모');
  await page.unroute('**/record-input');await page.getByRole('button',{name:'다시 확인',exact:true}).click();await expect(page.getByTestId('note-save')).toBeEnabled();
  const {auth}=await import('./helpers');const headers=await auth(request,'patient');
  expect((await request.put('/api/patients/p_01/members/u_b/scope',{headers,data:{scope:'schedule'}})).status()).toBe(200);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByTestId('note-input')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('권한 철회 전 미저장 가상 메모');
  expect((await request.put('/api/patients/p_01/members/u_b/scope',{headers,data:{scope:'companion'}})).status()).toBe(200);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByTestId('note-input')).toHaveValue('');
});
