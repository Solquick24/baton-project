import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as files from '../src/adapters/local/files.js';
import { phase4 } from './phase4-helpers.js';

let h: Awaited<ReturnType<typeof phase4>>;
let temporary: string, uploads: string;
const content = Buffer.from('synthetic audio fixture');
const url = '/api/patients/p_01/sources/up_test';
beforeEach(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'baton-source-test-')); uploads = join(temporary, 'uploads');
  await mkdir(uploads); await writeFile(join(uploads, 'audio.wav'), content); await writeFile(join(temporary, 'outside.wav'), 'private outside fixture');
  h = await phase4(uploads);
  h.db.prepare('INSERT INTO uploads (id,patientId,visitId,uploaderId,storagePath,mediaType,size,createdAt) VALUES (?,?,?,?,?,?,?,?)')
    .run('up_test', 'p_01', 'v_im_02', 'u_b', 'audio.wav', 'audio/wav', content.length, new Date().toISOString());
});
afterEach(async () => { await h.close(); await rm(temporary, { recursive: true, force: true }); });
it.each(['u_patient', 'u_a'])('streams original bytes to current full member %s with safe non-cacheable headers', async user => {
  const res = await h.request(user, url);
  expect(res.statusCode).toBe(200); expect(res.rawPayload).toEqual(content);
  expect(res.headers['cache-control']).toBe('private, no-store');
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['content-disposition']).toMatch(/^attachment;/);
  expect(JSON.stringify(res.headers)).not.toContain(uploads);
});
it.each(['u_b', 'u_c', 'u_x'])('rejects original access for %s, including the companion uploader', async user => {
  const res = await h.request(user, url);
  expect(res.statusCode).toBe(403); expect(res.body).not.toContain(content.toString());
  expect(res.body).not.toContain(uploads);
  expect(h.statements.filter(sql => /SELECT.*FROM uploads/i.test(sql))).toHaveLength(0);
});
it('accepts an absolute registered path within the private root and uses octet-stream for untrusted MIME', async () => {
  h.db.prepare("UPDATE uploads SET storagePath=?,mediaType='text/html' WHERE id='up_test'").run(join(uploads, 'audio.wav'));
  const res = await h.request('u_a', url);
  expect(res.statusCode).toBe(200); expect(res.rawPayload).toEqual(content);
  expect(res.headers['content-type']).toBe('application/octet-stream');
});
it('sends no original bytes if full permission is revoked while the file opens', async () => {
  const openFile = files.openSourceFile;
  vi.spyOn(files, 'openSourceFile').mockImplementationOnce(async (...args) => {
    const source = await openFile(...args);
    h.db.prepare("UPDATE members SET scope='companion' WHERE userId='u_a'").run();
    return source;
  });
  const res = await h.request('u_a', url);
  expect(res.statusCode).toBe(403); expect(res.body).not.toContain(content.toString());
});
it('requires authentication and returns safe missing-source errors', async () => {
  expect((await h.app.inject(url)).statusCode).toBe(401);
  expect((await h.request('u_a', '/api/patients/p_01/sources/missing')).statusCode).toBe(404);
  expect((await h.request('u_a', '/api/patients/missing/sources/up_test')).statusCode).toBe(403);
  const res = await h.request('u_a', '/api/patients/p_01/sources/missing');
  expect(Object.keys(res.json().error).sort()).toEqual(['code', 'message', 'requestId']);
});
it('checks patient and visit ownership even when the caller belongs to both patients', async () => {
  h.db.prepare('INSERT INTO patients VALUES (?,?,?,?,?,?)').run('p_other', '가상환자', 'u_x', 'u_a', 0, 1);
  h.db.prepare('INSERT INTO members VALUES (?,?,?,?,?,?)').run('p_other', 'u_a', 'lead', 'full', 1, '대표');
  expect((await h.request('u_a', '/api/patients/p_other/sources/up_test')).statusCode).toBe(404);
  // Simulate inconsistent legacy metadata; the route must independently join visit ownership.
  h.db.pragma('foreign_keys = OFF');
  h.db.prepare("UPDATE uploads SET visitId='missing' WHERE id='up_test'").run();
  expect((await h.request('u_a', url)).statusCode).toBe(404);
});
it.each(['../outside.wav', '..\\outside.wav', 'missing.wav', ''])('rejects unsafe or missing storage path %s without exposing it', async path => {
  h.db.prepare('UPDATE uploads SET storagePath=? WHERE id=?').run(path, 'up_test');
  const res = await h.request('u_a', url);
  expect(res.statusCode).toBe(404); expect(res.body).not.toContain('private outside fixture'); expect(res.body).not.toContain(temporary);
});
it('rejects absolute paths outside the upload root and directories', async () => {
  for (const path of [join(temporary, 'outside.wav'), uploads]) {
    h.db.prepare('UPDATE uploads SET storagePath=? WHERE id=?').run(path, 'up_test');
    expect((await h.request('u_a', url)).statusCode).toBe(404);
  }
});
it('rejects a directory symlink or Windows junction escaping the upload root', async () => {
  await symlink(temporary, join(uploads, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  h.db.prepare("UPDATE uploads SET storagePath='escape/outside.wav' WHERE id='up_test'").run();
  expect((await h.request('u_a', url)).statusCode).toBe(404);
});
it('rechecks scope and active membership for an existing token, with no AI or STT calls', async () => {
  expect((await h.request('u_a', url)).statusCode).toBe(200);
  h.db.prepare("UPDATE members SET scope='companion' WHERE userId='u_a'").run();
  expect((await h.request('u_a', url)).statusCode).toBe(403);
  h.db.prepare("UPDATE members SET scope='full',active=0 WHERE userId='u_a'").run();
  expect((await h.request('u_a', url)).statusCode).toBe(403);
  expect(h.generate).not.toHaveBeenCalled(); expect(h.transcribe).not.toHaveBeenCalled();
});
