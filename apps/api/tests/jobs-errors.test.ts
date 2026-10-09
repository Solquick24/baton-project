import { expect, it, vi } from 'vitest';
import { errorResponseSchema, jobSchema } from '@baton/contracts';
import { buildApp } from '../src/app.js';
import { JobsService } from '../src/modules/jobs/service.js';
import { JobRunner } from '../src/workers/runner.js';
import { ProviderError } from '../src/adapters/ai/providers.js';
import { ApiError } from '../src/shared/errors.js';
import { safeLoggerOptions } from '../src/shared/logger.js';
import { fixtureDatabase } from './helpers.js';

function upload(db: ReturnType<typeof fixtureDatabase>, id: string, visitId = 'v_im_03') {
  db.prepare('INSERT INTO uploads (id,patientId,visitId,uploaderId,storagePath,mediaType,size,createdAt) VALUES (?,?,?,?,?,?,?,?)').run(id, 'p_01', visitId, 'u_b', 'test-only-path', 'audio/wav', 1, new Date().toISOString());
}

it('deduplicates queued/running/success; retries failed attempt with a new id', async () => {
  const db = fixtureDatabase(), service = new JobsService(db);
  try {
    const first = service.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', 3);
    expect(service.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', 3)).toEqual(first);
    const fail = new JobRunner(service, { merge_questions: async () => { throw new ProviderError('ai_unavailable'); } });
    await fail.runNext();
    expect(service.get('u_b', first.jobId)).toMatchObject({ status: 'failed', errorCode: 'ai_unavailable', attempt: 1, resultVersion: null });
    const retry = service.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', 3);
    expect(retry.jobId).not.toBe(first.jobId); expect(service.get('u_b', retry.jobId).attempt).toBe(2);
    service.claim();
    expect(service.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', 3)).toEqual(retry);
    db.prepare("UPDATE jobs SET status='succeeded' WHERE id=?").run(retry.jobId);
    expect(service.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', 3)).toEqual(retry);
  } finally { db.close(); }
});
it('returns only public job metadata to owner/current full; hides other jobs and rechecks active status', async () => {
  const db = fixtureDatabase(), service = new JobsService(db);
  const id = service.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 0).jobId;
  const app = await buildApp({ db });
  const get = (u: string) => app.inject({ url: `/api/jobs/${id}`, headers: { authorization: `Bearer ${app.jwt.sign({ sub: u })}` } });
  try {
    for (const u of ['u_b', 'u_a', 'u_patient']) {
      const res = await get(u); expect(res.statusCode).toBe(200); jobSchema.parse(res.json());
      expect(res.body).not.toMatch(/"(?:scope|inputVersion|patientId|requestedBy|payload|transcript|blocks)"/);
    }
    for (const u of ['u_c', 'u_x']) expect((await get(u)).statusCode).toBe(404);
    db.prepare("UPDATE members SET scope='schedule' WHERE userId='u_a'").run();
    expect((await get('u_a')).statusCode).toBe(404);
    db.prepare("UPDATE members SET active=0 WHERE userId='u_b'").run();
    expect((await get('u_b')).statusCode).toBe(404);
    expect((await app.inject(`/api/jobs/${id}`)).statusCode).toBe(401);
  } finally { await app.close(); db.close(); }
});
it('on startup fails interrupted running jobs and leaves queued jobs intact', async () => {
  const db = fixtureDatabase(), service = new JobsService(db);
  const running = service.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 0).jobId;
  service.claim();
  const queued = service.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', 3).jobId;
  const app = await buildApp({ db });
  try {
    expect(service.get('u_b', running)).toMatchObject({ status: 'failed', errorCode: 'internal', resultVersion: null });
    expect(service.get('u_b', queued).status).toBe('queued');
  } finally { await app.close(); db.close(); }
});
it('requires current generation permission, input version, recording consent and same patient', () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    expect(() => jobs.enqueue('u_c', 'p_01', 'v_im_03', 'structure', 0)).toThrow(ApiError);
    expect(() => jobs.enqueue('u_x', 'p_01', 'v_im_03', 'structure', 0)).toThrow(ApiError);
    expect(() => jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 100)).toThrow(ApiError);
    expect(() => jobs.enqueue('u_b', 'p_01', 'v_im_03', 'briefing', 1)).toThrow(ApiError);
    db.prepare('UPDATE patients SET recordingAllowed=0').run();
    expect(() => jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0)).toThrow(ApiError);
    expect(db.prepare('SELECT count(*) n FROM jobs').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
it('refuses phantom success, missing handlers and stale/removed permissions at execution', async () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    const id = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 0).jobId;
    await new JobRunner(jobs, { structure: async () => ({ mode: 'fixture', resultVersion: 100, resultState: 'ready' }) }).runNext();
    expect(jobs.get('u_b', id)).toMatchObject({ status: 'failed', resultVersion: null, errorCode: 'internal' });
    const missing = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 0).jobId;
    await new JobRunner(jobs).runNext();
    expect(jobs.get('u_b', missing).status).toBe('failed');
    const stale = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 0).jobId;
    db.prepare("UPDATE visits SET recordInputVersion=1 WHERE id='v_im_03'").run();
    const handler = vi.fn();
    await new JobRunner(jobs, { structure: handler }).runNext();
    expect(handler).not.toHaveBeenCalled();
    expect(jobs.get('u_b', stale)).toMatchObject({ status: 'failed', errorCode: 'stale_input' });
    const denied = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 1).jobId;
    db.prepare("UPDATE members SET scope='schedule' WHERE userId='u_b'").run();
    await new JobRunner(jobs, { structure: handler }).runNext();
    expect(jobs.get('u_b', denied)).toMatchObject({ status: 'failed', errorCode: 'internal' });
  } finally { db.close(); }
});
it('completes only existing matching result versions, retains published pointers and stops cleanly', async () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    const id = jobs.enqueue('u_a', 'p_01', 'v_im_02', 'structure', 1).jobId;
    const runner = new JobRunner(jobs, { structure: async () => ({ mode: 'fixture', resultVersion: 1, resultState: 'ready' }) });
    await runner.runNext(); await runner.stop();
    expect(jobs.get('u_a', id)).toMatchObject({ status: 'succeeded', resultVersion: 1, resultState: 'ready', mode: 'fixture' });
    expect(db.prepare("SELECT recordPublishedVersion FROM visits WHERE id='v_im_02'").get()).toEqual({ recordPublishedVersion: 1 });
    expect(await runner.runNext()).toBe(false);
  } finally { db.close(); }
});
it('prevents overlapping runner calls and catches an input change while awaiting worker', async () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    const id = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', 0).jobId;
    let release!: () => void;
    const ready = new Promise<void>((r) => { release = r; });
    const runner = new JobRunner(jobs, { structure: async () => { await ready; return { mode: 'fixture', resultVersion: 1, resultState: 'ready' }; } });
    const active = runner.runNext();
    expect(await runner.runNext()).toBe(false);
    db.prepare("UPDATE visits SET recordInputVersion=1 WHERE id='v_im_03'").run();
    release(); await active; await runner.stop();
    expect(jobs.get('u_b', id)).toMatchObject({ status: 'failed', errorCode: 'stale_input' });
  } finally { db.close(); }
});
it('reports transcription completion only after a stored transcript and one input-version increment', async () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    upload(db, 'test-upload');
    const id = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0, 'test-upload').jobId;
    const runner = new JobRunner(jobs, { transcribe: async () => {
      db.transaction(() => {
        db.prepare('INSERT INTO transcripts VALUES (?,?,?,?,?,?,?)').run('test-tr', 'p_01', 'v_im_03', 'test-upload', 'fixture', '[]', new Date().toISOString());
        db.prepare("UPDATE visits SET recordInputVersion=1 WHERE id='v_im_03'").run();
      })();
      return { mode: 'fixture', resultVersion: null, resultState: null };
    } });
    await runner.runNext();
    expect(jobs.get('u_b', id)).toMatchObject({ status: 'succeeded', resultVersion: null, resultState: null, mode: 'fixture' });
    expect(jobSchema.safeParse({ ...jobs.get('u_b', id), resultVersion: 1, resultState: 'ready' }).success).toBe(false);
    expect(jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 1, 'test-upload')).toEqual({ jobId: id });
  } finally { db.close(); }
});
it('deduplicates transcription by upload, validates ownership context and counts attempts across input versions', async () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    upload(db, 'audio-1'); upload(db, 'audio-2'); upload(db, 'wrong-visit', 'v_os_01');
    expect(() => jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0)).toThrow(ApiError);
    expect(() => jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0, 'wrong-visit')).toThrow(ApiError);
    const first = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0, 'audio-1');
    expect(jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0, 'audio-1')).toEqual(first);
    const second = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0, 'audio-2');
    expect(second.jobId).not.toBe(first.jobId);
    await new JobRunner(jobs, { transcribe: async () => { throw new ProviderError('stt_unavailable'); } }).runNext();
    const failed = [first, second].find((job) => jobs.get('u_b', job.jobId).status === 'failed')!;
    const uploadId = (db.prepare('SELECT uploadId FROM jobs WHERE id=?').get(failed.jobId) as { uploadId: string }).uploadId;
    db.prepare("UPDATE visits SET recordInputVersion=1 WHERE id='v_im_03'").run();
    const retry = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 1, uploadId);
    expect(jobs.get('u_b', retry.jobId).attempt).toBe(2);
  } finally { db.close(); }
});
it('refuses transcription success for an unrelated upload even after the input increment', async () => {
  const db = fixtureDatabase(), jobs = new JobsService(db);
  try {
    upload(db, 'wanted'); upload(db, 'unrelated');
    const job = jobs.enqueue('u_b', 'p_01', 'v_im_03', 'transcribe', 0, 'wanted');
    await new JobRunner(jobs, { transcribe: async () => {
      db.prepare('INSERT INTO transcripts VALUES (?,?,?,?,?,?,?)').run('wrong-tr', 'p_01', 'v_im_03', 'unrelated', 'fixture', '[]', new Date().toISOString());
      db.prepare("UPDATE visits SET recordInputVersion=1 WHERE id='v_im_03'").run();
      return { mode: 'fixture', resultVersion: null, resultState: null };
    } }).runNext();
    expect(jobs.get('u_b', job.jobId)).toMatchObject({ status: 'failed', errorCode: 'internal', resultVersion: null });
  } finally { db.close(); }
});
it.each([['unauthorized', 401], ['forbidden', 403], ['not_found', 404], ['bad_request', 400], ['conflict', 409], ['upstream_error', 502], ['internal_error', 500]] as const)('returns the strict %s error contract with server-generated requestId', async (code, status) => {
  const app = await buildApp();
  app.get('/probe/error', async () => { throw new ApiError(code); });
  try {
    const res = await app.inject({ url: '/probe/error?raw=secret-source', headers: { 'x-request-id': 'attacker-secret' } });
    expect(res.statusCode).toBe(status); const body = errorResponseSchema.parse(res.json());
    expect(body.error.requestId).not.toBe('attacker-secret');
    expect(res.body).not.toContain('secret');
  } finally { await app.close(); }
});
it.each([['file_too_large', 413], ['unsupported_media_type', 415], ['unsupported_action', 400]] as const)('normalizes %s without disclosing raw upload errors', async (reason, status) => {
  const app = await buildApp();
  app.get('/probe/error', async () => { throw new ApiError('bad_request', reason); });
  try {
    const res = await app.inject('/probe/error'); expect(res.statusCode).toBe(status);
    expect(errorResponseSchema.parse(res.json()).error).toMatchObject({ code: 'bad_request', reason });
  } finally { await app.close(); }
});
it('omits internal exceptions/paths/token/body from responses and logger serializers', async () => {
  const app = await buildApp();
  const log = vi.spyOn(app.log, 'info');
  app.get('/probe/error', async () => { throw new Error('/private/path raw-original token secret-data'); });
  try {
    const res = await app.inject({ url: '/probe/error?source=secret-data', headers: { authorization: 'Bearer token-secret' } }); expect(res.statusCode).toBe(500); errorResponseSchema.parse(res.json());
    expect(res.body).not.toMatch(/private|raw-original|token|secret-data/);
    expect(JSON.stringify(safeLoggerOptions.serializers.err())).not.toMatch(/private|token/);
    expect(safeLoggerOptions.serializers.req()).toEqual({});
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|raw-original|token|secret-data/);
    expect(Object.keys(log.mock.calls[0]![0] as object).sort()).toEqual(['method', 'requestId', 'statusCode']);
  } finally { await app.close(); }
});
