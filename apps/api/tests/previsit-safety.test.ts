import { afterEach, expect, it, vi } from 'vitest';
import { questionsBlocksSchema, briefingBlocksSchema } from '@baton/contracts';
import { FixtureLLM } from '../src/adapters/ai/fixture.js';
import { validatedLLM, ProviderError, type LLMProvider, type LLMResult } from '../src/adapters/ai/providers.js';
import { fixturesDir } from './helpers.js';
import { phase3 } from './phase3-helpers.js';

let ctx: Awaited<ReturnType<typeof phase3>> | undefined;
afterEach(async () => { await ctx?.close(); ctx = undefined; });
const fixture = () => validatedLLM(new FixtureLLM(fixturesDir));
async function setup(mutate: (result: LLMResult) => void = () => {}) {
  const original = fixture();
  ctx = await phase3({ async generate(request) { const result = await original.generate(request); mutate(result); return result; } });
  return ctx;
}
async function failedMerge(c: Awaited<ReturnType<typeof phase3>>) {
  const { job } = await c.merge();
  expect(job.json()).toMatchObject({ status: 'failed', errorCode: 'validation_failed', resultVersion: null });
  expect(c.db.prepare("SELECT count(*) n FROM block_sets WHERE section='questions'").get()).toEqual({ n: 0 });
  expect((await c.request('u_b', `${c.base}/questions`)).json()).not.toHaveProperty('merged');
}
it.each(['가 상 질 환 Ｋ１', '７．２％', '추천합니다'])('blocks normalized restricted/judgment text %s and selects no lower payload', async (text) => {
  const c = await setup((result) => { questionsBlocksSchema.parse(result.blocks); (result.blocks as ReturnType<typeof questionsBlocksSchema.parse>).companion.mergedQuestions[0]!.text = text; });
  expect((await c.merge()).job.json()).toMatchObject({ status: 'succeeded', resultState: 'blocked' });
  c.statements.length = 0;
  expect((await c.request('u_b', `${c.base}/questions`)).json()).not.toHaveProperty('merged');
  expect(c.statements.filter((sql) => /SELECT.*payload/i.test(sql))).toEqual([]);
  const full = (await c.request('u_a', `${c.base}/questions`)).json().merged;
  expect(Object.keys(full.blocks)).toEqual(['full']); expect(full.state).toBe('blocked');
  expect(full.blocks.full.basisRefs).toHaveLength(5);
});
it('checks string IDs as well as public text for restricted values', async () => {
  const c = await setup((result) => {
    const b = result.blocks as ReturnType<typeof questionsBlocksSchema.parse>;
    b.companion.mergedQuestions[0]!.id = '가상질환 K1';
    b.full.basisRefs.filter((r) => r.itemId === 'mq_01').forEach((r) => { r.itemId = '가상질환 K1'; });
  });
  expect((await c.merge()).job.json()).toMatchObject({ status: 'succeeded', resultState: 'blocked' });
});
it('does not collapse punctuation when comparing a restricted measurement', async () => {
  const c = await setup((result) => { (result.blocks as ReturnType<typeof questionsBlocksSchema.parse>).companion.mergedQuestions[0]!.text = '72가 아니라 일정을 여쭤보기'; });
  expect((await c.merge()).job.json()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
});
it.each(['foreign-dept', 'invented-quote', 'missing-basis', 'extra-key'])('rejects a schema-shaped but unsafe question result: %s', async (failure) => {
  const c = await setup((result) => {
    const b = result.blocks as ReturnType<typeof questionsBlocksSchema.parse>;
    if (failure === 'foreign-dept') b.full.basisRefs[3]!.source = { type: 'observation', observationId: 'ob_03' };
    if (failure === 'invented-quote') b.full.basisRefs[0]!.quote = '자료에 없는 원문';
    if (failure === 'missing-basis') b.full.basisRefs = b.full.basisRefs.filter((r) => r.itemId !== 'mq_03');
    if (failure === 'extra-key') Object.assign(b.companion, { sourceRefs: [] });
  });
  await failedMerge(c);
});
it('uses at most one retry for malformed raw fixture results and never persists them', async () => {
  const generateRaw = vi.fn(async () => ({ companion: { unexpected: '자료' } }));
  ctx = await phase3(validatedLLM({ mode: 'fixture', generateRaw }));
  await failedMerge(ctx); expect(generateRaw).toHaveBeenCalledTimes(2);
});
it('fails rather than declaring fixture success when new public originals are not covered', async () => {
  const c = await setup();
  await c.request('u_b', `${c.base}/questions`, 'POST', { text: '다음 일정도 확인할까요?' });
  const response = await c.request('u_b', `${c.base}/questions/merge`, 'POST', { inputVersion: 4 });
  await c.app.baton.runner.runNext();
  expect((await c.request('u_b', `/api/jobs/${response.json().jobId}`)).json()).toMatchObject({ status: 'failed', errorCode: 'validation_failed' });
});
it('blocks private original references even when the public sentence looks safe', async () => {
  const c = await setup();
  c.db.prepare("UPDATE questions SET visibility='full' WHERE id='q_01'").run();
  expect((await c.merge()).job.json()).toMatchObject({ status: 'succeeded', resultState: 'blocked' });
  const response = await c.request('u_b', `${c.base}/questions`);
  expect(response.json().originals).toHaveLength(2); expect(response.json()).not.toHaveProperty('merged');
});
it('rejects a claimed original relationship without its actual question evidence', async () => {
  const c = await setup((result) => {
    const b = result.blocks as ReturnType<typeof questionsBlocksSchema.parse>;
    b.full.basisRefs = b.full.basisRefs.filter((ref) => !(ref.source.type === 'question' && ref.source.questionId === 'q_02'));
  });
  await failedMerge(c);
});
it('excludes an alert with a foreign source; its missing fixture evidence cannot become ready', async () => {
  const c = await setup();
  const row = c.db.prepare('SELECT id,"references" FROM alerts').get() as { id: string; references: string };
  const refs = JSON.parse(row.references); refs[0].id = 'ob_03';
  c.db.prepare('UPDATE alerts SET "references"=? WHERE id=?').run(JSON.stringify(refs), row.id);
  const { job } = await c.merge();
  expect(job.json()).toMatchObject({ status: 'failed', errorCode: 'validation_failed' });
  expect(c.generate.mock.calls[0]![0].input).toHaveProperty('alerts', []);
  expect(JSON.stringify(c.generate.mock.calls[0]![0].input)).not.toContain('ob_03');
});
it('normalizes missing full evidence to null/needsCheck and records only safe issue metadata', async () => {
  const c = await setup((result) => {
    if (result.section !== 'briefing') return;
    const b = result.blocks as ReturnType<typeof briefingBlocksSchema.parse>;
    b.full.briefing.prep[0]!.text = '근거 없이 만든 준비사항'; b.full.briefing.prep[0]!.needsCheck = false;
  });
  expect((await c.briefing()).job.json().resultState).toBe('ready');
  const b = (await c.request('u_a', `${c.base}/briefing`)).json();
  expect(b.blocks.full.briefing.prep[0]).toMatchObject({ text: null, needsCheck: true });
  expect(c.db.prepare("SELECT issues FROM block_sets WHERE section='briefing'").get()).toEqual({ issues: JSON.stringify([{ blockKind: 'full', itemId: 'bp_01', rule: 'missing_source' }]) });
});
it('exposes only full on a blocked briefing and reports briefingReady=false', async () => {
  const c = await setup((result) => { if (result.section === 'briefing') (result.blocks as ReturnType<typeof briefingBlocksSchema.parse>).companion.briefing.changes[0]!.text = '가상질환 K1'; });
  expect((await c.briefing()).job.json().resultState).toBe('blocked');
  expect((await c.request('u_b', `${c.base}/briefing`)).statusCode).toBe(404);
  const full = (await c.request('u_a', `${c.base}/briefing`)).json();
  expect(Object.keys(full.blocks)).toEqual(['full']); expect(full.questions).toEqual([]);
  expect((await c.request('u_b', '/api/patients/p_01/home?dept=내과')).json().nextVisit.briefingReady).toBe(false);
});
it('keeps saved briefing questions at their original version and marks stale after re-merge', async () => {
  let second = false;
  const c = await setup((result) => { if (second && result.section === 'questions') (result.blocks as ReturnType<typeof questionsBlocksSchema.parse>).companion.mergedQuestions[0]!.text = '아침 어지럼에 대해 다시 여쭤보기'; });
  await c.briefing(); second = true;
  c.db.prepare("UPDATE visits SET questionsInputVersion=4 WHERE id='v_im_03'").run();
  const response = await c.request('u_b', `${c.base}/questions/merge`, 'POST', { inputVersion: 4 });
  await c.app.baton.runner.runNext();
  expect((await c.request('u_b', `/api/jobs/${response.json().jobId}`)).json()).toMatchObject({ status: 'succeeded', resultVersion: 2 });
  const briefing = (await c.request('u_b', `${c.base}/briefing`)).json();
  expect(briefing.stale).toBe(true); expect(briefing.questions[0].text).toContain('혈압약을 반 정으로');
  expect((await c.request('u_b', `${c.base}/questions`)).json().merged.blocks.companion.mergedQuestions[0].text).toContain('다시');
});
it('moves to the latest blocked result without falling back to an old ready merge', async () => {
  let blocked = false;
  const c = await setup((result) => { if (blocked) (result.blocks as ReturnType<typeof questionsBlocksSchema.parse>).companion.mergedQuestions[0]!.text = '가상질환 K1'; });
  await c.merge(); blocked = true;
  c.db.prepare("UPDATE visits SET questionsInputVersion=4 WHERE id='v_im_03'").run();
  await c.request('u_b', `${c.base}/questions/merge`, 'POST', { inputVersion: 4 }); await c.app.baton.runner.runNext();
  expect((await c.request('u_b', `${c.base}/questions`)).json()).not.toHaveProperty('merged');
  expect((await c.request('u_a', `${c.base}/questions`)).json().merged).toMatchObject({ version: 2, state: 'blocked', blocks: { full: {} } });
  expect(c.db.prepare("SELECT count(*) n FROM block_sets WHERE section='questions'").get()).toEqual({ n: 2 });
});
it.each(['input', 'permission'])('rolls back generated blocks and pointers if %s changes while awaiting AI', async (change) => {
  const original = fixture();
  ctx = await phase3({ async generate(request) {
    const result = await original.generate(request);
    if (change === 'input') ctx!.db.prepare("UPDATE visits SET questionsInputVersion=4 WHERE id='v_im_03'").run();
    else ctx!.db.prepare("UPDATE members SET scope='schedule' WHERE userId='u_b'").run();
    return result;
  } });
  const response = await ctx.request('u_b', `${ctx.base}/questions/merge`, 'POST', { inputVersion: 3 });
  await ctx.app.baton.runner.runNext();
  expect((await ctx.request('u_a', `/api/jobs/${response.json().jobId}`)).json().status).toBe('failed');
  expect(ctx.db.prepare("SELECT questionsVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ questionsVersion: null });
  expect(ctx.db.prepare("SELECT count(*) n FROM block_sets WHERE section='questions'").get()).toEqual({ n: 0 });
});
it('retries provider failures with a new job/attempt and preserves an existing ready pointer on later failure', async () => {
  const original = fixture(); let fail = true;
  const provider: LLMProvider = { async generate(request) { if (fail) throw new ProviderError('ai_unavailable'); return original.generate(request); } };
  ctx = await phase3(provider);
  const first = await ctx.merge(); expect(first.job.json()).toMatchObject({ status: 'failed', errorCode: 'ai_unavailable', attempt: 1 });
  fail = false; const retry = await ctx.merge();
  expect(retry.response.json().jobId).not.toBe(first.response.json().jobId);
  expect(retry.job.json()).toMatchObject({ status: 'succeeded', attempt: 2 });
  fail = true; ctx.db.prepare("UPDATE visits SET questionsInputVersion=4 WHERE id='v_im_03'").run();
  await ctx.request('u_b', `${ctx.base}/questions/merge`, 'POST', { inputVersion: 4 }); await ctx.app.baton.runner.runNext();
  expect((await ctx.request('u_b', `${ctx.base}/questions`)).json().merged).toMatchObject({ version: 1, stale: true });
});
