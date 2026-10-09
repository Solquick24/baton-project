import { afterEach, beforeEach, expect, it } from 'vitest';
import { briefingResponseSchema } from '@baton/contracts';
import { phase3, expected } from './phase3-helpers.js';

let ctx: Awaited<ReturnType<typeof phase3>>;
beforeEach(async () => { ctx = await phase3(); });
afterEach(async () => { await ctx.close(); });
it('requires a completed ready question version and current version before enqueueing briefing', async () => {
  const absent = await ctx.request('u_b', `${ctx.base}/briefing`, 'POST', { questionsVersion: 1 });
  expect(absent.statusCode).toBe(409); expect(absent.json().error.reason).toBe('not_ready');
  await ctx.merge();
  const stale = await ctx.request('u_b', `${ctx.base}/briefing`, 'POST', { questionsVersion: 2 });
  expect(stale.statusCode).toBe(409); expect(stale.json().error.reason).toBe('stale_input');
});
it('generates and reads exact fixture changes/questions with full-only reasons, refs and null preparation', async () => {
  const result = await ctx.briefing();
  expect(result.response.statusCode).toBe(202); expect(result.job.json()).toMatchObject({ status: 'succeeded', resultState: 'ready', mode: 'fixture' });
  ctx.statements.length = 0;
  const response = await ctx.request('u_b', `${ctx.base}/briefing`);
  expect(response.statusCode).toBe(200);
  const b = briefingResponseSchema.parse(response.json());
  expect(b.blocks.companion).toEqual(expected('briefing/v_im_03.json').companion);
  expect(b.questions).toEqual(expected('merge-questions/v_im_03.json').companion.mergedQuestions);
  expect(b.blocks.companion?.briefing.changes).toHaveLength(2); expect(b.questions).toHaveLength(3);
  expect(Object.keys(b.blocks)).toEqual(['companion']); expect(Object.keys(b)).not.toContain('state');
  for (const key of ['sourceRefs', 'basisRefs', 'changeReasons', 'watch', 'tests', 'prep', 'scope', 'hiddenCount']) expect(response.body).not.toContain(`"${key}"`);
  for (const sql of ctx.statements.filter((s) => /SELECT.*payload/i.test(s))) expect(sql.match(/kind IN \(([^)]+)\)/)?.[1]).not.toContain("'full'");
  const a = briefingResponseSchema.parse((await ctx.request('u_a', `${ctx.base}/briefing`)).json());
  expect(a.blocks.full).toEqual(expected('briefing/v_im_03.json').full);
  expect(a.blocks.full?.briefing.prep[0]).toMatchObject({ text: null, needsCheck: true });
  expect(ctx.db.prepare("SELECT issues FROM block_sets WHERE section='briefing'").get()).toEqual({ issues: JSON.stringify(expected('validation.json').cases.find((c: any) => c.file === 'briefing/v_im_03.json').expectedIssues) });
});
it('isolates patient/department/time in actual provider inputs and makes no calls for ten GETs', async () => {
  await ctx.briefing();
  expect(ctx.generate).toHaveBeenCalledTimes(2);
  for (const call of ctx.generate.mock.calls) {
    const input = JSON.stringify(call[0].input);
    for (const term of ['v_os_01', 'ob_03', 'rx_os_01', '가상록소정', 'private_notes']) expect(input).not.toContain(term);
    expect(input).toContain('v_im_02');
  }
  for (let i = 0; i < 10; i++) expect((await ctx.request('u_b', `${ctx.base}/briefing`)).statusCode).toBe(200);
  for (let i = 0; i < 10; i++) for (const url of [`${ctx.base}/questions`, ctx.base, '/api/me/patients', '/api/patients/p_01/home?dept=내과', '/api/patients/p_01/timeline?dept=내과']) expect((await ctx.request('u_b', url)).statusCode).toBe(200);
  expect(ctx.generate).toHaveBeenCalledTimes(2);
  expect((await ctx.request('u_c', `${ctx.base}/briefing`)).statusCode).toBe(404);
  expect((await ctx.request('u_x', `${ctx.base}/briefing`)).statusCode).toBe(403);
});
