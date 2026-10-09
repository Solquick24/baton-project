import { afterEach, expect, it, describe } from 'vitest';
import { phase5 } from './phase5-helpers.js';
let ctx: Awaited<ReturnType<typeof phase5>> | undefined;
afterEach(async () => { await ctx?.close(); ctx = undefined; });
it('keeps generated records private, allows only permitted draft kinds and makes no AI calls on GET', async () => {
  ctx = await phase5(); expect(await ctx.structure()).toMatchObject({ status: 'succeeded' });
  for (const user of ['u_a', 'u_c']) {
    expect((await ctx.request(user, ctx.base)).json()).not.toHaveProperty('record');
    expect((await ctx.request(user, `${ctx.base}?view=draft`)).statusCode).toBe(403);
  }
  ctx.statements.length = 0;
  const draft = (await ctx.request('u_b', `${ctx.base}?view=draft`)).json().record;
  expect(Object.keys(draft.blocks)).toEqual(['schedule', 'companion']);
  expect(JSON.stringify(draft)).not.toMatch(/sourceRefs|transcript|가상질환|가상지표|7.2%/);
  expect(ctx.statements.filter((s) => /SELECT.*payload/.test(s)).every((s) => !s.includes("'full'"))).toBe(true);
  const count = ctx.generate.mock.calls.length;
  for (let i = 0; i < 10; i++) await ctx.request('u_b', `${ctx.base}?view=draft`);
  expect(ctx.generate).toHaveBeenCalledTimes(count);
});
it('deduplicates jobs, retains existing published data during re-generation and marks stale drafts', async () => {
  ctx = await phase5(); const first = await ctx.structure(); expect(first.status).toBe('succeeded');
  expect((await ctx.structure()).id).toBe(first.id); expect(ctx.generate).toHaveBeenCalledTimes(1);
  // Existing-published-state precondition only; this does not claim T043 POST share success.
  ctx.db.prepare("UPDATE visits SET recordPublishedVersion=1,status='done' WHERE id='v_im_03'").run();
  const published = (await ctx.request('u_c', ctx.base)).json();
  const before = (await ctx.request('u_c', '/api/patients/p_01/visits/v_im_02')).json();
  ctx.note('실패 시연'); expect(await ctx.structure()).toMatchObject({ status: 'failed' });
  expect((await ctx.request('u_c', ctx.base)).json()).toEqual(published);
  expect((await ctx.request('u_c', '/api/patients/p_01/visits/v_im_02')).json()).toEqual(before);
  expect((await ctx.request('u_b', `${ctx.base}?view=draft`)).json().record).toMatchObject({ version: 1, stale: true, shareable: false });
  expect(await ctx.structure()).toMatchObject({ status: 'succeeded', attempt: 2, resultVersion: 2 });
  expect((await ctx.request('u_c', ctx.base)).json()).toEqual(published);
});
// Red run confirmed 404 before/after independent implementation. Re-enable only with
// actual T031/T039/T042/T043 routes; T038 remains incomplete, these are not successes.
describe.skip('T043 HTTP acceptance, blocked by actual T031/T039/T042 foundations', () => {
  it('publishes once and reuses the successful share without duplicate logs', async () => {
    ctx = await phase5(); expect((await ctx.structure()).status).toBe('succeeded');
    const payload = { draftVersion: 1, inputVersion: 1, idempotencyKey: '00000000-0000-4000-8000-000000000001' };
    const first = await ctx.request('u_b', `${ctx.base}/share`, 'POST', payload);
    expect(first.statusCode).toBe(200); expect(first.json().alreadyPublished).toBe(false);
    expect((await ctx.request('u_b', `${ctx.base}/share`, 'POST', payload)).json().alreadyPublished).toBe(true);
    expect(ctx.db.prepare("SELECT count(*) n FROM share_logs WHERE action='publish' AND visitId='v_im_03'").get()).toEqual({ n: 1 });
  });
  it('rejects a blocked draft even with a valid share payload', async () => {
    ctx = await phase5(); ctx.note('혼입 시연'); await ctx.structure();
    const res = await ctx.request('u_b', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 2, idempotencyKey: '00000000-0000-4000-8000-000000000002' });
    expect(res.statusCode).toBe(409); expect(res.json().error.reason).toBe('blocked');
  });
  it('rejects stale draft/input versions', async () => {
    ctx = await phase5(); await ctx.structure(); ctx.note('새 입력');
    const res = await ctx.request('u_b', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: '00000000-0000-4000-8000-000000000003' });
    expect(res.statusCode).toBe(409); expect(res.json().error.reason).toBe('stale_input');
  });
});
