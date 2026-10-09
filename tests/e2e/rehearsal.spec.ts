import { writeFileSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { auth, record, reset, visit } from './helpers';

async function signIn(page: Page, account: string) {
  await page.goto('/login');await page.getByTestId('login-email').fill(`${account}@baton.demo`);await page.getByTestId('login-password').fill('baton-demo-2026');await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading',{name:'박하늘님의 기록'})).toBeVisible();
}
async function signOut(page: Page) {await page.getByRole('link',{name:'설정',exact:true}).click();await page.getByTestId('logout').click();await expect(page).toHaveURL(/login$/);}
const wanted=JSON.parse(readFileSync(new URL('../../fixtures/expected/merge-questions/v_im_03.json',import.meta.url),'utf8')).companion.mergedQuestions.map((q:{text:string})=>q.text);

test('T067 handoff → record/share → C allowed view → A full/confirmation, twice consecutively',async({page,request})=>{
  test.setTimeout(90_000);const runs=[];
  for(let run=1;run<=2;run++) {
    await reset(request,false);await page.context().clearCookies();await page.goto('/login');await page.evaluate(()=>sessionStorage.clear());
    const started=Date.now();await signIn(page,'b');await page.getByTestId('questions-link').click();
    await expect(page.getByRole('heading',{name:'가족이 남긴 질문 3개'})).toBeVisible();await page.getByTestId('merge-button').click();
    await expect(page.locator('[data-testid^=merged-question-]')).toHaveCount(3);await expect(page.getByTestId('ai-added-badge')).toHaveCount(1);
    await page.getByRole('button',{name:'이 질문으로 브리핑 만들기'}).click();await expect(page.getByTestId('briefing-questions')).toBeVisible();
    const lookupStarted=Date.now();await expect(page.locator('[data-testid^=change-]')).toHaveCount(2);
    for(const text of wanted) await expect(page.getByTestId('briefing-questions')).toContainText(text);
    const lookupMs=Date.now()-lookupStarted;expect(lookupMs).toBeLessThan(30_000);
    await expect(page.locator('[data-testid^=source-button-]')).toHaveCount(0);
    const headers=await auth(request,'b'),beforeReads=await(await request.get('/api/__test/ai-calls')).json();
    for(let i=0;i<10;i++) expect((await request.get(`${visit}/briefing`,{headers})).status()).toBe(200);
    expect(await(await request.get('/api/__test/ai-calls')).json()).toEqual(beforeReads);
    await record(page,'혈압약 아침 반 알 그대로. 다음 진료 4월 9일 10시.');
    const a=await auth(request,'a');expect(await(await request.get(visit,{headers:a})).json()).not.toHaveProperty('record');
    await page.getByTestId('share-button').click();await page.getByTestId('share-confirm').click();await expect(page.getByRole('status')).toContainText('공유했어요');
    await signOut(page);await signIn(page,'c');await page.getByRole('link',{name:'타임라인',exact:true}).click();
    await expect(page.getByTestId('timeline-card-v_im_03')).toBeVisible();await expect(page.locator('main')).not.toContainText('바토디핀');
    await signOut(page);await signIn(page,'a');await page.getByRole('link',{name:'타임라인',exact:true}).click();
    const card=page.getByTestId('timeline-card-v_im_03');await card.getByText('진료 내용과 근거 보기',{exact:true}).click();await expect(card).toContainText('가상질환 K1');
    await expect(card.locator('blockquote').first()).not.toBeEmpty();await page.goto('/p/p_01/visits/v_im_03/briefing');await expect(page.getByTestId('briefing-prep')).toContainText('기록에 없어요');
    await page.goto('/p/p_01/alerts');await page.locator('[data-testid^=alert-open-]').first().click();
    await expect(page.getByTestId('alert-left')).toContainText('저녁');await expect(page.getByTestId('alert-right')).toContainText('아침');
    await page.getByTestId('resolve-hospital').click();await expect(page.getByTestId('alert-status')).toContainText('병원 확인 예정');await page.reload();await expect(page.getByTestId('alert-status')).toContainText('병원 확인 예정');
    const calls=await(await request.get('/api/__test/ai-calls')).json();expect(calls).toMatchObject({llm:3,stt:1,departmentIsolated:true});
    runs.push({run,initial:'fresh isolated seed; questions=3; no pregeneration; no v_im_03 draft/published; B companion/C schedule/A full; delegated=false',accounts:['B','C','A'],steps:['UI login','merge 3→2+1','briefing 2 changes/3 questions','GET10 AI0','synthetic audio→fixture STT','note→structure→draft private','explicit share','C schedule timeline','A full sources/null prep','alert two sources→awaiting confirmation→reload'],lookupMs,totalMs:Date.now()-started,calls,result:'passed',humanReadingTime:'not measured'});
    await signOut(page);
  }
  writeFileSync(test.info().outputPath('handoff-rehearsal.json'),JSON.stringify({mode:'fixture',runs},null,2));
});

test('T067 patient scope → B next read/cache → denied PUT → restore, twice consecutively',async({page,context,request})=>{
  test.setTimeout(90_000);const runs=[];
  for(let run=1;run<=2;run++) {
    await reset(request,false);await page.goto('/login');await page.evaluate(()=>sessionStorage.clear());const started=Date.now();
    await signIn(page,'patient');await page.getByRole('link',{name:'설정',exact:true}).click();await page.getByTestId('sharing-member-u_b').click();
    const b=await context.newPage();await signIn(b,'b');await expect(b.locator('main')).toContainText('바토디핀');
    const before=await(await request.get('/api/__test/ai-calls')).json();
    for(const scope of ['schedule','full','companion']) {
      await page.getByTestId(`scope-${scope}`).check();const next=b.waitForResponse(r=>/\/home(?:\?|$)/.test(r.url()));await page.getByTestId('scope-save').click();
      const data=await(await next).json();expect(Object.keys(data.recent[0].record.blocks)).toEqual(scope==='schedule'?['schedule']:scope==='full'?['schedule','companion','full']:['schedule','companion']);
      if(scope==='schedule') {await expect(b.locator('main')).not.toContainText('바토디핀');await expect(b.getByTestId('questions-link')).toHaveCount(0);}
      else await expect(b.getByTestId('questions-link')).toBeVisible();
    }
    const headers=await auth(request,'b');expect((await request.put('/api/patients/p_01/members/u_b/scope',{headers,data:{scope:'full'}})).status()).toBe(403);
    await b.getByRole('link',{name:'타임라인',exact:true}).click();await expect(b.getByTestId('timeline-card-v_im_02')).toBeVisible();await expect(b.locator('[data-testid^=source-button-]')).toHaveCount(0);
    const logs=await(await request.get('/api/patients/p_01/members/u_b/share-log',{headers:await auth(request,'patient')})).json();expect(logs.logs.filter((l:{action:string})=>l.action==='scope_change')).toHaveLength(3);
    const after=await(await request.get('/api/__test/ai-calls')).json();expect(after).toEqual(before);expect(after).toMatchObject({llm:0,stt:0});
    runs.push({run,initial:'fresh isolated seed; no generation; B companion; delegated=false; scope_change logs=0',accounts:['patient','B'],steps:['patient settings→B','B initial companion home','schedule save→next B response/UI removes medication/questions','full save→next response','restore companion→next response','B PUT403','B timeline allowed blocks','3 atomic scope logs','LLM/STT zero'],totalMs:Date.now()-started,calls:after,result:'passed'});
    await b.close();await signOut(page);
  }
  writeFileSync(test.info().outputPath('scope-rehearsal.json'),JSON.stringify({mode:'fixture',runs},null,2));
});
