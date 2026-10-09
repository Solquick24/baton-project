import { afterEach, beforeEach, expect, it } from 'vitest';
import { questionsResponseSchema } from '@baton/contracts';
import { phase3, expected } from './phase3-helpers.js';

let ctx: Awaited<ReturnType<typeof phase3>>;
beforeEach(async () => { ctx = await phase3(); });
afterEach(async () => { await ctx.close(); });
it('lists seeded originals with authors and no merged key before generation', async () => {
  const res = await ctx.request('u_b', `${ctx.base}/questions`);
  expect(res.statusCode).toBe(200);
  const body = questionsResponseSchema.parse(res.json());
  expect(body.originals.map((q) => [q.id, q.author.userId])).toEqual([['q_01', 'u_patient'], ['q_02', 'u_a'], ['q_03', 'u_b']]);
  expect(body.questionsInputVersion).toBe(3); expect(Object.keys(body)).not.toContain('merged');
});
it('registers one bound question and input version atomically; rejects empty/long/extra input', async () => {
  const create = await ctx.request('u_b', `${ctx.base}/questions`, 'POST', { text: '  다음에 무엇을 가져오나요?  ' });
  expect(create.statusCode).toBe(201); expect(create.json().questionsInputVersion).toBe(4);
  expect(ctx.db.prepare('SELECT text,authorId FROM questions WHERE id=?').get(create.json().id)).toEqual({ text: '다음에 무엇을 가져오나요?', authorId: 'u_b' });
  for (const payload of [{ text: ' ' }, { text: 'a'.repeat(201) }, { text: '질문', visibility: 'companion' }]) expect((await ctx.request('u_b', `${ctx.base}/questions`, 'POST', payload)).statusCode).toBe(400);
  expect((await ctx.request('u_b', `${ctx.base}/questions`)).json().questionsInputVersion).toBe(4);
});
it('keeps restricted new questions full-only even for their companion author, including SQL selection and home count', async () => {
  const res = await ctx.request('u_b', `${ctx.base}/questions`, 'POST', { text: '가상질환 K1과 가상지표 X 7.2%가 궁금해요.' });
  expect(res.statusCode).toBe(201);
  ctx.statements.length = 0;
  const lower = await ctx.request('u_b', `${ctx.base}/questions`);
  expect(lower.json().originals).toHaveLength(3); expect(lower.body).not.toContain(res.json().id);
  expect(ctx.statements.find((s) => /SELECT.*q\.text/i.test(s))).toContain("q.visibility='companion'");
  expect((await ctx.request('u_a', `${ctx.base}/questions`)).json().originals).toHaveLength(4);
  expect((await ctx.request('u_b', '/api/patients/p_01/home?dept=내과')).json().nextVisit.questionCount).toBe(3);
});
it('returns 404 for schedule reads, 403 for writes/nonmembers and 401 without a token', async () => {
  expect((await ctx.request('u_c', `${ctx.base}/questions`)).statusCode).toBe(404);
  expect((await ctx.request('u_c', `${ctx.base}/questions`, 'POST', { text: '질문' })).statusCode).toBe(403);
  expect((await ctx.request('u_x', `${ctx.base}/questions`)).statusCode).toBe(403);
  expect((await ctx.app.inject(`${ctx.base}/questions`)).statusCode).toBe(401);
  expect((await ctx.request('u_b', '/api/patients/p_02/visits/v_im_03/questions')).statusCode).toBe(403);
});
it('merges 3 originals into 2 plus 1 grounded AI question through a real fixture job and stores all three blocks', async () => {
  const { response, job } = await ctx.merge();
  expect(response.statusCode).toBe(202); expect(job.json()).toMatchObject({ status: 'succeeded', mode: 'fixture', resultVersion: 1, resultState: 'ready' });
  const b = questionsResponseSchema.parse((await ctx.request('u_b', `${ctx.base}/questions`)).json());
  expect(b.merged?.blocks.companion).toEqual(expected('merge-questions/v_im_03.json').companion);
  expect(b.merged?.blocks.companion?.mergedQuestions.filter((q) => q.addedByAI)).toHaveLength(1);
  expect(Object.keys(b.merged!.blocks)).toEqual(['companion']); expect(Object.keys(b.merged!)).not.toContain('state');
  const a = (await ctx.request('u_a', `${ctx.base}/questions`)).json();
  expect(a.merged.blocks.full).toEqual(expected('merge-questions/v_im_03.json').full);
  expect(a.merged.state).toBe('ready');
  expect(ctx.db.prepare("SELECT count(*) n FROM visit_blocks WHERE blockSetId IN (SELECT id FROM block_sets WHERE section='questions')").get()).toEqual({ n: 3 });
  expect(ctx.db.prepare("SELECT recordPublishedVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ recordPublishedVersion: null });
});
it('deduplicates generation and shows stale after a question is added without regenerating on GET', async () => {
  const first = await ctx.merge();
  const again = await ctx.request('u_b', `${ctx.base}/questions/merge`, 'POST', { inputVersion: 3 });
  expect(again.statusCode).toBe(202); expect(again.json()).toEqual(first.response.json()); expect(ctx.generate).toHaveBeenCalledTimes(1);
  await ctx.request('u_b', `${ctx.base}/questions`, 'POST', { text: '다음 일정은 언제인가요?' });
  expect((await ctx.request('u_b', `${ctx.base}/questions`)).json().merged.stale).toBe(true);
  const stale = await ctx.request('u_b', `${ctx.base}/questions/merge`, 'POST', { inputVersion: 3 });
  expect(stale.statusCode).toBe(409); expect(stale.json().error.reason).toBe('stale_input');
});
