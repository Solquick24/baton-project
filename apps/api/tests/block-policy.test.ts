import { afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { fixtureDatabase } from './helpers.js';

let db: ReturnType<typeof fixtureDatabase>;
let app: Awaited<ReturnType<typeof buildApp>>;
let statements: string[];
beforeEach(async () => { statements = []; db = fixtureDatabase((sql) => statements.push(sql)); app = await buildApp({ db });
  app.get<{ Params: { pid: string; vid: string }; Querystring: { view?: 'published' | 'draft' } }>('/probe/:pid/visits/:vid', async (req) => {
    const { authenticate } = await import('../src/auth/session.js');
    const { readVisit } = await import('../src/adapters/sqlite/visit-repository.js');
    return readVisit(db, await authenticate(req, db), req.params.pid, req.params.vid, req.query.view ?? 'published');
  });
});
afterEach(async () => { await app.close(); db.close(); });
const read = (user: string, vid = 'v_im_02', view = 'published') => app.inject({ url: `/probe/p_01/visits/${vid}?view=${view}`, headers: { authorization: `Bearer ${app.jwt.sign({ sub: user })}` } });
it.each([['u_c', ['schedule']], ['u_b', ['schedule', 'companion']], ['u_a', ['schedule', 'companion', 'full']], ['u_patient', ['schedule', 'companion', 'full']]])('selects only permitted kinds for %s and omits forbidden keys', async (user, expected) => {
  statements.length = 0;
  const res = await read(user as string);
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(Object.keys(body.record.blocks).sort()).toEqual([...(expected as string[])].sort());
  expect(Object.keys(body.meta).sort()).toEqual(['companion', 'date', 'dept', 'hospital', 'id', 'patientId', 'status', 'time']);
  expect(res.body).not.toMatch(/"(?:scope|hiddenCount|locked|passwordHash)"/);
  const selects = statements.filter((s) => /SELECT.*payload/i.test(s));
  expect(selects).toHaveLength(1);
  expect(selects[0]).toContain('kind IN');
  const selectedKinds = selects[0]!.match(/kind IN \(([^)]+)\)/)![1]!;
  if (user === 'u_c') { expect(selectedKinds).not.toContain("'companion'"); expect(res.body).not.toContain('바토디핀정'); }
  if (user === 'u_b' || user === 'u_c') {
    expect(selectedKinds).not.toContain("'full'");
    for (const forbidden of ['sourceRefs', '가상질환', '가상지표', '낮게 나와', 'transcript']) expect(res.body).not.toContain(forbidden);
  }
});
it('rereads current scope and active relationship for every HTTP request', async () => {
  const token = app.jwt.sign({ sub: 'u_b' });
  const request = () => app.inject({ url: '/probe/p_01/visits/v_im_02', headers: { authorization: `Bearer ${token}` } });
  expect(Object.keys((await request()).json().record.blocks)).toContain('companion');
  db.prepare("UPDATE members SET scope='schedule' WHERE userId='u_b'").run();
  expect(Object.keys((await request()).json().record.blocks)).toEqual(['schedule']);
  db.prepare("UPDATE members SET active=0 WHERE userId='u_b'").run();
  expect((await request()).statusCode).toBe(403);
});
it('does not read payload for nonmembers or permit membership of another patient', async () => {
  statements.length = 0;
  expect((await read('u_x')).statusCode).toBe(403);
  expect(statements.some((s) => /SELECT.*payload/i.test(s))).toBe(false);
  db.prepare("INSERT INTO patients VALUES ('p_02','가상 환자','u_x','u_a',0,1)").run();
  db.prepare("INSERT INTO members VALUES ('p_02','u_b','guardian','full',1,'가상 관계')").run();
  const res = await app.inject({ url: '/probe/p_02/visits/v_im_02', headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'u_b' })}` } });
  expect(res.statusCode).toBe(404);
});
it('uses published pointer and hides drafts from other family; stale and blocked are not shareable', async () => {
  db.prepare("INSERT INTO block_sets SELECT 'draft2',patientId,visitId,section,2,inputVersion,'blocked',mode,'u_b',createdAt,issues FROM block_sets WHERE id='seed_v_im_02_1'").run();
  db.prepare("INSERT INTO visit_blocks SELECT 'draft2',kind,payload FROM visit_blocks WHERE blockSetId='seed_v_im_02_1'").run();
  db.prepare("UPDATE block_sets SET issues=? WHERE id='draft2'").run(JSON.stringify([
    { blockKind: 'full', itemId: 'hidden-full-item', rule: 'missing_source' },
    { blockKind: 'companion', itemId: 'es_im02_1', rule: 'restricted_value' },
  ]));
  db.prepare("UPDATE visits SET recordDraftVersion=2, recordInputVersion=2 WHERE id='v_im_02'").run();
  expect((await read('u_b')).json().record.version).toBe(1);
  expect((await read('u_a', 'v_im_02', 'draft')).statusCode).toBe(403);
  const own = await read('u_b', 'v_im_02', 'draft');
  expect(own.json().record.shareable).toBe(false);
  expect(Object.keys(own.json().record.blocks)).toEqual(['schedule', 'companion']);
  expect(own.json().record.issues).toEqual([{ blockKind: 'companion', itemId: 'es_im02_1', rule: 'restricted_value' }]);
  expect(own.body).not.toContain('hidden-full-item');
  expect((await read('u_patient', 'v_im_02', 'draft')).statusCode).toBe(200);
  expect(Object.keys((await read('u_c', 'v_im_03')).json())).toEqual(['meta']);
});
it('defaults unspecified fields to full and denies invalid scope/kind', async () => {
  const { minimumKind, allowedKinds } = await import('../src/auth/block-policy.js');
  expect(minimumKind('new_unknown_field')).toBe('full');
  expect(minimumKind('sourceRefs')).toBe('full');
  expect(minimumKind('nextSchedule')).toBe('schedule');
  expect(allowedKinds('unknown')).toEqual([]);
});
it('strictly rejects extra stored fields instead of leaking them', async () => {
  const row = db.prepare("SELECT payload FROM visit_blocks WHERE blockSetId='seed_v_im_02_1' AND kind='companion'").get() as { payload: string };
  const payload = JSON.parse(row.payload); payload.privateNotes = 'secret';
  db.prepare("UPDATE visit_blocks SET payload=? WHERE blockSetId='seed_v_im_02_1' AND kind='companion'").run(JSON.stringify(payload));
  const response = await read('u_b');
  expect(response.statusCode).toBe(500);
  expect(response.body).not.toContain('secret');
});
