import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { membersResponseSchema, changeScopeResponseSchema, shareLogsResponseSchema } from '@baton/contracts';
import { phase4 } from './phase4-helpers.js';

let h: Awaited<ReturnType<typeof phase4>>;
const base = '/api/patients/p_01';
beforeEach(async () => { h = await phase4(); });
afterEach(async () => { await h.close(); });
it('returns only the strict member contract to the patient', async () => {
  const res = await h.request('u_patient', `${base}/members`);
  expect(res.statusCode).toBe(200);
  const { members } = membersResponseSchema.parse(res.json());
  expect(members.map(m => m.userId).sort()).toEqual(['u_a', 'u_b', 'u_c', 'u_patient']);
  expect(Object.keys(members[0]!).sort()).toEqual(['active', 'name', 'relation', 'role', 'scope', 'userId']);
});
it.each(['u_a', 'u_b', 'u_c', 'u_x'])('rejects unauthorized management and log access for %s without scope disclosures', async user => {
  for (const path of ['/members', '/share-log', '/members/u_b/share-log']) {
    const res = await h.request(user, base + path);
    expect(res.statusCode).toBe(403);
    expect(Object.keys(res.json())).toEqual(['error']);
    expect(Object.keys(res.json().error).sort()).toEqual(['code', 'message', 'requestId']);
    expect(res.body).not.toMatch(/companion|schedule|full|박지후/);
  }
  expect((await h.request(user, `${base}/members/u_b/scope`, 'PUT', { scope: 'full' })).statusCode).toBe(403);
});
it('requires authentication on all management routes', async () => {
  for (const path of ['/members', '/share-log', '/members/u_b/share-log']) expect((await h.app.inject(base + path)).statusCode).toBe(401);
  expect((await h.app.inject({ method: 'PUT', url: `${base}/members/u_b/scope`, payload: { scope: 'full' } })).statusCode).toBe(401);
});
it('rechecks delegated lead authority and active membership with the same JWT', async () => {
  h.db.prepare('UPDATE patients SET delegated=1 WHERE id=?').run('p_01');
  expect((await h.request('u_a', `${base}/members/u_b/scope`, 'PUT', { scope: 'schedule' })).statusCode).toBe(200);
  h.db.prepare('UPDATE patients SET delegated=0 WHERE id=?').run('p_01');
  expect((await h.request('u_a', `${base}/members`)).statusCode).toBe(403);
  h.db.prepare("UPDATE members SET scope='full' WHERE userId='u_b'").run();
  expect((await h.request('u_b', `${base}/members`)).statusCode).toBe(403);
  h.db.prepare("UPDATE members SET active=0 WHERE userId='u_patient'").run();
  expect((await h.request('u_patient', `${base}/members`)).statusCode).toBe(403);
});
it('writes one scope-change audit with actor and old/new values, and no audit for an unchanged value', async () => {
  const initial = (h.db.prepare('SELECT COUNT(*) n FROM share_logs').get() as { n: number }).n;
  const res = await h.request('u_patient', `${base}/members/u_b/scope`, 'PUT', { scope: 'schedule' });
  expect(res.statusCode).toBe(200);
  expect(changeScopeResponseSchema.parse(res.json()).member.scope).toBe('schedule');
  expect((await h.request('u_patient', `${base}/members/u_b/scope`, 'PUT', { scope: 'schedule' })).statusCode).toBe(200);
  const logsRes = await h.request('u_patient', `${base}/members/u_b/share-log`);
  expect(logsRes.statusCode).toBe(200);
  const { logs } = shareLogsResponseSchema.parse(logsRes.json());
  expect(logs[0]).toMatchObject({ targetUserId: 'u_b', actor: { userId: 'u_patient', name: '박하늘' }, action: 'scope_change', oldScope: 'companion', newScope: 'schedule', visitId: null, version: null });
  expect(logs.every(log => log.targetUserId === 'u_b' && log.action !== 'publish')).toBe(true);
  expect((h.db.prepare('SELECT COUNT(*) n FROM share_logs').get() as { n: number }).n).toBe(initial + 1);
});
it('returns seed start/publish audits newest first and only to authorized managers', async () => {
  const res = await h.request('u_patient', `${base}/share-log`);
  expect(res.statusCode).toBe(200);
  const { logs } = shareLogsResponseSchema.parse(res.json());
  expect(logs).toHaveLength(6);
  expect(new Set(logs.map(l => l.action))).toEqual(new Set(['start', 'publish']));
  expect(logs.map(l => l.at)).toEqual(logs.map(l => l.at).sort().reverse());
  h.db.prepare('UPDATE patients SET delegated=1').run();
  expect((await h.request('u_a', `${base}/share-log`)).statusCode).toBe(200);
});
it.each([{ scope: 'invalid' }, { scope: 'full', delegated: true }, {}])('rejects invalid or extra input %j without mutating scope', async payload => {
  expect((await h.request('u_patient', `${base}/members/u_b/scope`, 'PUT', payload)).statusCode).toBe(400);
  expect(h.db.prepare("SELECT scope FROM members WHERE userId='u_b'").get()).toEqual({ scope: 'companion' });
});
it('rejects patient scope changes and missing, foreign, or inactive target members', async () => {
  expect((await h.request('u_patient', `${base}/members/u_patient/scope`, 'PUT', { scope: 'full' })).statusCode).toBe(400);
  for (const user of ['missing', 'u_x']) {
    expect((await h.request('u_patient', `${base}/members/${user}/scope`, 'PUT', { scope: 'full' })).statusCode).toBe(404);
    expect((await h.request('u_patient', `${base}/members/${user}/share-log`)).statusCode).toBe(404);
  }
  h.db.prepare("UPDATE members SET active=0 WHERE userId='u_b'").run();
  expect((await h.request('u_patient', `${base}/members/u_b/scope`, 'PUT', { scope: 'full' })).statusCode).toBe(404);
  expect((await h.request('u_patient', '/api/patients/missing/members')).statusCode).toBe(403);
});
it('rolls back the scope change if the audit insert fails', async () => {
  h.db.exec("CREATE TRIGGER fail_scope_audit BEFORE INSERT ON share_logs WHEN NEW.action='scope_change' BEGIN SELECT RAISE(ABORT,'test-only failure'); END");
  expect((await h.request('u_patient', `${base}/members/u_b/scope`, 'PUT', { scope: 'full' })).statusCode).toBe(500);
  expect(h.db.prepare("SELECT scope FROM members WHERE userId='u_b'").get()).toEqual({ scope: 'companion' });
});
it('immediately applies three scope changes to ten reads each with allowed-kind SQL, no forbidden keys, and zero AI calls', async () => {
  const prepare = vi.spyOn(h.db, 'prepare');
  for (const [scope, kinds] of [['schedule', ['schedule']], ['full', ['schedule', 'companion', 'full']], ['companion', ['schedule', 'companion']]] as const) {
    expect((await h.request('u_patient', `${base}/members/u_b/scope`, 'PUT', { scope })).statusCode).toBe(200);
    for (let i = 0; i < 10; i++) {
      prepare.mockClear(); h.statements.length = 0;
      const res = await h.request('u_b', `${base}/visits/v_im_02`);
      expect(res.statusCode).toBe(200);
      expect(Object.keys(res.json().record.blocks)).toEqual(kinds);
      const selects = h.statements.filter(sql => /SELECT kind,payload FROM visit_blocks/i.test(sql));
      expect(selects).toHaveLength(1);
      expect(prepare.mock.calls.some(([sql]) => /SELECT kind,payload FROM visit_blocks WHERE blockSetId=\? AND kind IN \(/.test(sql))).toBe(true);
      const selection = selects[0]!.split('ORDER BY')[0];
      if (scope !== 'full') expect(selection).not.toContain("'full'");
      if (scope === 'schedule') expect(selection).not.toContain("'companion'");
      expect(res.body).not.toMatch(/"scope"|"oldScope"|"newScope"|"hiddenCount"/);
      if (scope !== 'full') expect(res.body).not.toMatch(/"sourceRefs"|"quote"|"diagnosis"|7\.2/);
    }
  }
  expect(h.generate).not.toHaveBeenCalled(); expect(h.transcribe).not.toHaveBeenCalled();
});
