import { afterEach, beforeEach, expect, it } from 'vitest';
import { alertsResponseSchema, resolveResponseSchema } from '@baton/contracts';
import { phase3, expected } from './phase3-helpers.js';
let ctx: Awaited<ReturnType<typeof phase3>>;
beforeEach(async () => { ctx = await phase3(); }); afterEach(async () => { await ctx.close(); });
const url = '/api/patients/p_01/alerts';
async function alert() { return (await ctx.request('u_a', url)).json().alerts[0]; }
it('returns exact seed alert to full only, with current resolve permission and no AI call', async () => {
  const res = await ctx.request('u_a', url); expect(res.statusCode).toBe(200);
  const body = alertsResponseSchema.parse(res.json()); const { id, history, ...row } = body.alerts[0]!;
  expect(row).toEqual(expected('alerts.json').alerts[0]); expect(body.canResolve).toBe(true);
  for (const user of ['u_b', 'u_c']) expect((await ctx.request(user, url)).statusCode).toBe(404);
  expect((await ctx.request('u_x', url)).statusCode).toBe(403);
  ctx.db.prepare("UPDATE members SET scope='full' WHERE userId='u_b'").run();
  expect((await ctx.request('u_b', url)).json().canResolve).toBe(false);
  for (let i = 0; i < 10; i++) await ctx.request('u_a', url);
  expect(ctx.generate).not.toHaveBeenCalled();
});
it('stores hospital confirmation as awaiting_confirmation, reupload as open and preserves history', async () => {
  const original = await alert();
  const confirmed = await ctx.request('u_a', `${url}/${original.id}/resolve`, 'POST', { action: 'confirm_hospital', note: '병원에 확인할 예정' });
  expect(confirmed.statusCode).toBe(200);
  expect(resolveResponseSchema.parse(confirmed.json()).alert).toMatchObject({ status: 'awaiting_confirmation' });
  const reopened = await ctx.request('u_patient', `${url}/${original.id}/resolve`, 'POST', { action: 'reupload' });
  expect(reopened.json().alert.status).toBe('open'); expect(reopened.json().alert.history.map((h: any) => h.action)).toEqual(['detected', 'confirm_hospital', 'reupload']);
});
it('revises observation immutably, recomputes differences and leaves saved blocks unchanged', async () => {
  const original = await alert(); const old = ctx.db.prepare("SELECT * FROM observations WHERE id='ob_01'").get();
  const blocks = ctx.db.prepare('SELECT payload FROM visit_blocks ORDER BY blockSetId,kind').all();
  const fact = { ...original.references[0].fact, timing: ['morning'] };
  const response = await ctx.request('u_a', `${url}/${original.id}/resolve`, 'POST', { action: 'edit_note', fact, text: '아침에 반 알로 수정한 가상 관찰' });
  expect(response.statusCode).toBe(200); const updated = response.json().alert;
  expect(updated).toMatchObject({ status: 'resolved', differences: [] });
  expect(updated.references[0].id).not.toBe('ob_01');
  expect(ctx.db.prepare('SELECT revision,supersedesId FROM observations WHERE id=?').get(updated.references[0].id)).toEqual({ revision: 2, supersedesId: 'ob_01' });
  expect(ctx.db.prepare("SELECT * FROM observations WHERE id='ob_01'").get()).toEqual(old);
  expect(ctx.db.prepare('SELECT payload FROM visit_blocks ORDER BY blockSetId,kind').all()).toEqual(blocks);
  const before = JSON.stringify(updated);
  expect((await ctx.request('u_a', `${url}/${original.id}/resolve`, 'POST', { action: 'edit_note', fact, text: '아침에 반 알로 수정한 가상 관찰' })).json().alert).toEqual(JSON.parse(before));
});
it('keeps a changed but still conflicting observation open; rejects non-owner patient and guardian mutation', async () => {
  const original = await alert(); const body = { action: 'edit_note', fact: { ...original.references[0].fact, dose: '1정' } };
  expect((await ctx.request('u_a', `${url}/${original.id}/resolve`, 'POST', body)).json().alert.status).toBe('open');
  for (const user of ['u_b', 'u_c']) expect((await ctx.request(user, `${url}/${original.id}/resolve`, 'POST', { action: 'reupload' })).statusCode).toBe(404);
  ctx.db.prepare("UPDATE members SET scope='full' WHERE userId='u_b'").run();
  expect((await ctx.request('u_b', `${url}/${original.id}/resolve`, 'POST', { action: 'reupload' })).statusCode).toBe(403);
  expect((await ctx.request('u_a', '/api/patients/p_02/alerts')).statusCode).toBe(403);
});
