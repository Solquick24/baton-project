import { afterEach, beforeEach, expect, it } from 'vitest';
import { homeResponseSchema, mePatientsResponseSchema, timelineResponseSchema } from '@baton/contracts';
import { phase3 } from './phase3-helpers.js';
let ctx: Awaited<ReturnType<typeof phase3>>;
beforeEach(async () => { ctx = await phase3(); }); afterEach(async () => { await ctx.close(); });
it('lists own/linked patients without roles/scopes and checks current active membership', async () => {
  expect(mePatientsResponseSchema.parse((await ctx.request('u_patient', '/api/me/patients')).json())).toEqual({ self: { patientId: 'p_01' }, linked: [] });
  expect((await ctx.request('u_b', '/api/me/patients')).json()).toEqual({ self: { patientId: null }, linked: [{ patientId: 'p_01', name: '박하늘' }] });
  expect((await ctx.request('u_x', '/api/me/patients')).json()).toEqual({ self: { patientId: null }, linked: [] });
  ctx.db.prepare("UPDATE members SET active=0 WHERE userId='u_b'").run();
  expect((await ctx.request('u_b', '/api/me/patients')).json().linked).toEqual([]);
});
it.each(['u_c', 'u_b', 'u_a'])('builds dept-filtered home and permitted counts for %s', async (user) => {
  const res = await ctx.request(user, '/api/patients/p_01/home?dept=내과'); expect(res.statusCode).toBe(200);
  const home = homeResponseSchema.parse(res.json());
  expect(home.depts).toEqual(['내과', '정형외과']); expect(home.nextVisit?.meta.id).toBe('v_im_03');
  expect(home.recent.map((r) => r.meta.id)).toEqual(['v_im_02', 'v_im_01']);
  expect(Object.keys(home.me).sort()).toEqual(['canManageScopes', 'role']); expect(res.body).not.toMatch(/"(?:scope|hiddenCount|locked)"/);
  if (user === 'u_c') expect(Object.keys(home.nextVisit!)).toEqual(['meta']);
  else expect(home.nextVisit).toMatchObject({ questionCount: 3, briefingReady: false });
  expect(Object.keys(home).includes('openAlertCount')).toBe(user === 'u_a');
  if (user === 'u_a') expect(home.openAlertCount).toBe(1);
});
it('requires valid dept for timeline, defaults home to first dept and omits unpublished records', async () => {
  expect((await ctx.request('u_b', '/api/patients/p_01/home')).json().recent.every((r: any) => r.meta.dept === '내과')).toBe(true);
  for (const query of ['', '?dept=', '?dept=unknown']) expect((await ctx.request('u_b', `/api/patients/p_01/timeline${query}`)).statusCode).toBe(400);
  const items = timelineResponseSchema.parse((await ctx.request('u_b', '/api/patients/p_01/timeline?dept=내과')).json()).items;
  expect(items.map((r) => r.meta.id)).toEqual(['v_im_02', 'v_im_01']);
  expect(Object.keys((await ctx.request('u_b', ctx.base)).json())).toEqual(['meta']);
  expect((await ctx.request('u_x', '/api/patients/p_01/home')).statusCode).toBe(403);
});
