import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { recordBlocksSchema, recordGeneratedBlocksSchema, questionsBlocksSchema, briefingBlocksSchema, visitMetaSchema } from '@baton/contracts';
import { fixtureDatabase, fixturesDir } from './helpers.js';
import { seedDatabase } from '../../../scripts/seed.js';
import { initializeSchema } from '../src/adapters/sqlite/database.js';

const json = (name: string) => JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8'));
it('parses every existing block fixture with strict nested schemas', () => {
  for (const r of json('seed/records.json').blockSets) recordBlocksSchema.parse(r.blocks);
  for (const file of ['structure/v_im_03.json', 'structure/v_im_03.leak.json']) recordGeneratedBlocksSchema.parse(json(`expected/${file}`));
  questionsBlocksSchema.parse(json('expected/merge-questions/v_im_03.json'));
  briefingBlocksSchema.parse(json('expected/briefing/v_im_03.json'));
  const blocks = json('expected/structure/v_im_03.json');
  blocks.companion.sourceRefs = [];
  expect(recordGeneratedBlocksSchema.safeParse(blocks).success).toBe(false);
  expect(visitMetaSchema.safeParse({ scope: 'full' }).success).toBe(false);
  const duplicate = json('expected/structure/v_im_03.json');
  duplicate.full.diagnosis[0].id = duplicate.companion.easySummary[0].id;
  expect(recordGeneratedBlocksSchema.safeParse(duplicate).success).toBe(false);
  const noBasis = json('expected/merge-questions/v_im_03.json');
  noBasis.full.basisRefs = [];
  expect(questionsBlocksSchema.safeParse(noBasis).success).toBe(false);
});
it('preserves existing jobs during the upload-key schema update and makes initialization repeatable', () => {
  const db = fixtureDatabase();
  try {
    db.exec(`DROP TABLE jobs; CREATE TABLE jobs (
      id TEXT PRIMARY KEY, patientId TEXT, visitId TEXT, requestedBy TEXT, kind TEXT, inputVersion INTEGER, status TEXT,
      attempt INTEGER, mode TEXT, resultVersion INTEGER, resultState TEXT, errorCode TEXT, createdAt TEXT, updatedAt TEXT);
      INSERT INTO jobs VALUES ('legacy','p_01','v_im_03','u_b','structure',0,'failed',1,NULL,NULL,NULL,'internal','2026-03-12T00:00:00Z','2026-03-12T00:00:00Z');`);
    const before = db.prepare('SELECT * FROM jobs').get();
    initializeSchema(db); initializeSchema(db);
    expect(db.prepare('SELECT * FROM jobs').get()).toEqual({ ...before as object, uploadId: null });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs_before_upload_identity'").get()).toBeUndefined();
  } finally { db.close(); }
});
it('stores successful share request identities with patient/actor uniqueness and patient/visit FK', () => {
  const db = fixtureDatabase();
  try {
    const insert = db.prepare('INSERT INTO share_requests VALUES (?,?,?,?,?,?,?,?)');
    insert.run('p_01', 'u_b', 'test-key', 'v_im_02', 1, 1, 1, '2026-03-12T00:00:00Z');
    expect(() => insert.run('p_01', 'u_b', 'test-key', 'v_im_03', 2, 2, 2, '2026-03-12T00:00:00Z')).toThrow();
    expect(() => insert.run('p_01', 'u_b', 'other-key', 'absent', 1, 1, 1, '2026-03-12T00:00:00Z')).toThrow();
    seedDatabase(db, { fixturesDir });
    expect(db.prepare('SELECT count(*) n FROM share_requests').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
it('seeds hashes, published versions and the exact code-derived alert; reseeds atomically', () => {
  const db = fixtureDatabase();
  try {
    const users = db.prepare('SELECT passwordHash FROM users').all() as Array<{ passwordHash: string }>;
    expect(users).toHaveLength(5);
    expect(users.every((u) => u.passwordHash.startsWith('scrypt$') && !u.passwordHash.includes('baton-demo'))).toBe(true);
    const alerts = db.prepare('SELECT patientId,visitId,dept,kind,"references",differences,summary,status FROM alerts').all() as Array<Record<string, string>>;
    const parsed = alerts.map((a) => ({ ...a, references: JSON.parse(a.references!), differences: JSON.parse(a.differences!) }));
    expect(parsed).toEqual(json('expected/alerts.json').alerts);
    expect(seedDatabase(db, { fixturesDir })).toEqual({ users: 5, visits: 4, records: 3, alerts: 1 });
    expect(db.prepare('SELECT count(*) n FROM users').get()).toEqual({ n: 5 });
  } finally { db.close(); }
});
it('enforces cross-patient FKs, kinds, uniqueness, bound values and rollback', () => {
  const db = fixtureDatabase();
  try {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(() => db.prepare('INSERT INTO visit_blocks VALUES (?,?,?)').run('seed_v_im_02_1', 'full', '{}')).toThrow();
    expect(() => db.prepare('INSERT INTO visit_blocks VALUES (?,?,?)').run('seed_v_im_02_1', 'unknown', '{}')).toThrow();
    expect(() => db.prepare('UPDATE block_sets SET patientId=? WHERE visitId=?').run('absent', 'v_im_02')).toThrow();
    db.prepare("INSERT INTO patients VALUES ('p_02','가상 환자','u_x','u_a',0,1)").run();
    expect(() => db.prepare('UPDATE block_sets SET patientId=? WHERE visitId=?').run('p_02', 'v_im_02')).toThrow();
    expect(() => db.transaction(() => {
      db.prepare('UPDATE users SET name=? WHERE id=?').run("value'); DROP TABLE users; --", 'u_b');
      db.prepare('UPDATE members SET scope=? WHERE userId=?').run('unknown', 'u_b');
    })()).toThrow();
    expect(db.prepare('SELECT name FROM users WHERE id=?').get('u_b')).toEqual({ name: '박지후' });
  } finally { db.close(); }
});
