import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/shared/config.js';
import { FixtureLLM, FixtureTranscription } from '../src/adapters/ai/fixture.js';
import { ProviderError, validatedLLM, type LLMProvider, type TranscriptionProvider } from '../src/adapters/ai/providers.js';
import { OpenAILLM } from '../src/adapters/ai/openai.js';
import { fixtureDatabase, fixturesDir, password } from './helpers.js';
import { expected } from './phase3-helpers.js';

let ctx: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(async () => { await ctx?.close(); ctx = undefined; });
async function setup(provider?: LLMProvider, transcription?: TranscriptionProvider) {
  const statements: string[] = [], db = fixtureDatabase(sql => statements.push(sql));
  const uploadDir = await mkdtemp(join(tmpdir(), 'baton-record-api-'));
  const generate = vi.fn((provider ?? validatedLLM(new FixtureLLM(fixturesDir))).generate);
  const stt = transcription ?? new FixtureTranscription(fixturesDir);
  const transcribe = vi.fn(stt.transcribe.bind(stt));
  const app = await buildApp({ db, config: readConfig({ ...process.env, UPLOAD_DIR: uploadDir }), llm: { generate }, stt: { transcribe } });
  await app.ready(); await app.baton.runner.stop();
  const tokens: Record<string, string> = {};
  for (const user of ['patient', 'a', 'b', 'c', 'outsider']) {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: `${user}@baton.demo`, password } });
    expect(res.statusCode).toBe(200); tokens[user] = res.json().accessToken;
  }
  const base = '/api/patients/p_01/visits/v_im_03';
  const request = (user: string, url: string, method: 'GET' | 'POST' | 'PUT' = 'GET', payload?: unknown) => app.inject({
    method, url, headers: { authorization: `Bearer ${tokens[user]}` }, ...(payload === undefined ? {} : { payload: payload as object }),
  });
  async function job(path: string, payload: object) {
    const res = await request('b', `${base}/${path}`, 'POST', payload);
    expect(res.statusCode).toBe(202); await app.baton.runner.runNext();
    return (await request('b', `/api/jobs/${res.json().jobId}`)).json();
  }
  async function previsit() {
    expect(await job('questions/merge', { inputVersion: 3 })).toMatchObject({ status: 'succeeded', resultState: 'ready' });
    expect(await job('briefing', { questionsVersion: 1 })).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  }
  async function upload(user = 'b', type = 'audio/wav', bytes = Buffer.from('RIFF virtual audio only'), url = `${base}/audio`) {
    const boundary = 'baton-boundary';
    const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../secret.wav"\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    return app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${tokens[user]}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
  }
  async function input() { return (await request('b', `${base}/record-input`)).json().recordInputVersion; }
  async function note(text: string) { return request('b', `${base}/notes`, 'POST', { text }); }
  async function structure() { return job('structure', { inputVersion: await input() }); }
  async function prepare() {
    await previsit(); const res = await upload(); expect(res.statusCode).toBe(201);
    expect(await job('transcribe', { uploadId: res.json().uploadId })).toMatchObject({ status: 'succeeded', mode: 'fixture', resultVersion: null, resultState: null });
    return res.json().uploadId as string;
  }
  async function share(key = randomUUID(), version = 1, inputVersion = 1) {
    return request('b', `${base}/share`, 'POST', { draftVersion: version, inputVersion, idempotencyKey: key });
  }
  return { app, db, base, request, job, previsit, upload, input, note, structure, prepare, share, generate, transcribe, statements, uploadDir,
    async close() { await app.close(); db.close(); await rm(uploadDir, { recursive: true, force: true }); } };
}

it('calls only registered product APIs for login → previsit → upload → transcribe → note → job → review → share → allowed reads', async () => {
  ctx = await setup(); const uploadId = await ctx.prepare();
  expect((await ctx.note('혈압약 아침 반 알 그대로. 다음 진료 4월 9일 10시.')).statusCode).toBe(201);
  expect(await ctx.input()).toBe(2);
  expect(await ctx.structure()).toMatchObject({ status: 'succeeded', mode: 'fixture', resultState: 'ready', resultVersion: 1 });
  expect((await ctx.request('a', ctx.base)).json()).not.toHaveProperty('record');
  expect((await ctx.request('c', '/api/patients/p_01/timeline?dept=내과')).json().items.map((x: any) => x.meta.id)).not.toContain('v_im_03');
  expect((await ctx.request('a', `${ctx.base}?view=draft`)).statusCode).toBe(403);
  const draft = (await ctx.request('b', `${ctx.base}?view=draft`)).json().record;
  expect(draft).toMatchObject({ version: 1, inputVersion: 2, state: 'ready', shareable: true, stale: false });
  expect(Object.keys(draft.blocks)).toEqual(['schedule', 'companion']);
  const normal = expected('structure/v_im_03.json');
  expect(draft.blocks.schedule).toEqual(normal.schedule); expect(draft.blocks.companion).toEqual(normal.companion);
  const key = randomUUID(); const published = await ctx.share(key, 1, 2);
  expect(published.statusCode).toBe(200); expect(published.json()).toMatchObject({ publishedVersion: 1, alreadyPublished: false });
  for (const [user, kinds] of [['c', ['schedule']], ['b', ['schedule', 'companion']], ['a', ['schedule', 'companion', 'full']]] as const) {
    ctx.statements.length = 0;
    const record = (await ctx.request(user, ctx.base)).json().record;
    expect(Object.keys(record.blocks)).toEqual(kinds);
    expect(record).not.toHaveProperty('inputVersion'); expect(record).not.toHaveProperty('shareable');
    if (user !== 'a') {
      expect(JSON.stringify(record)).not.toMatch(/sourceRefs|transcript|diagnosis|labResults|medReasons|answers|scope|hidden|가상질환|가상지표|7.2%/);
      expect(ctx.statements.filter(s => /SELECT.*payload/.test(s)).every(s => !s.includes("'full'"))).toBe(true);
    } else {
      expect(record.blocks.full.answers.find((x: any) => x.questionId === 'mq_02')).toMatchObject({ text: null, needsCheck: true });
      expect(record.blocks.full.transcript.segments).toEqual(expected('transcribe/v_im_03.json').segments);
    }
  }
  expect((await ctx.request('b', `/api/patients/p_01/sources/${uploadId}`)).statusCode).toBe(403);
  expect((await ctx.request('a', `/api/patients/p_01/sources/${uploadId}`)).rawPayload.toString()).toBe('RIFF virtual audio only');
  const counts = [ctx.generate.mock.calls.length, ctx.transcribe.mock.calls.length];
  for (const scope of ['schedule', 'full', 'companion']) {
    expect((await ctx.request('patient', '/api/patients/p_01/members/u_b/scope', 'PUT', { scope })).statusCode).toBe(200);
    for (let i = 0; i < 10; i++) {
      const result = (await ctx.request('b', ctx.base)).json().record;
      expect(Object.keys(result.blocks)).toEqual(scope === 'schedule' ? ['schedule'] : scope === 'full' ? ['schedule', 'companion', 'full'] : ['schedule', 'companion']);
      await ctx.request('b', '/api/patients/p_01/home?dept=내과'); await ctx.request('b', '/api/patients/p_01/timeline?dept=내과');
    }
  }
  expect([ctx.generate.mock.calls.length, ctx.transcribe.mock.calls.length]).toEqual(counts);
  expect(JSON.stringify(ctx.generate.mock.calls)).not.toMatch(/v_os_01|ob_03|rx_os_01|가상록소정/);
});

it('rejects invalid notes, MIME, oversize audio and unknown/nonmember visits without storing files or incrementing input', async () => {
  ctx = await setup();
  for (const text of [' ', 'x'.repeat(2001)]) expect((await ctx.note(text)).statusCode).toBe(400);
  expect((await ctx.upload('b', 'text/plain')).statusCode).toBe(415);
  expect((await ctx.upload('b', 'audio/wav', Buffer.alloc(20 * 1024 * 1024 + 1))).statusCode).toBe(413);
  expect((await ctx.upload('c')).statusCode).toBe(403); expect((await ctx.upload('outsider')).statusCode).toBe(403);
  expect((await ctx.upload('b', 'audio/wav', undefined, ctx.base.replace('v_im_03', 'unknown') + '/audio')).statusCode).toBe(404);
  expect((await ctx.request('c', `${ctx.base}/record-input`)).statusCode).toBe(404);
  expect(await ctx.input()).toBe(0); expect(await readdir(ctx.uploadDir)).toEqual([]);
  expect(ctx.generate).not.toHaveBeenCalled(); expect(ctx.transcribe).not.toHaveBeenCalled();
});

it('stores immutable trimmed notes and current recording permission', async () => {
  ctx = await setup();
  expect((await ctx.note('  첫 메모  ')).json()).toMatchObject({ recordInputVersion: 1 });
  expect((await ctx.note('두 번째 메모')).json()).toMatchObject({ recordInputVersion: 2 });
  expect(ctx.db.prepare('SELECT text FROM notes ORDER BY createdAt,id').all().map((x: any) => x.text).sort()).toEqual(['두 번째 메모', '첫 메모'].sort());
  ctx.db.prepare('UPDATE patients SET recordingAllowed=0').run();
  expect((await ctx.request('b', `${ctx.base}/record-input`)).json()).toEqual({ recordInputVersion: 2, canUploadAudio: false });
  expect((await ctx.upload()).json().error.reason).toBe('recording_not_allowed');
});

it('deduplicates transcription by upload, validates STT output and retries failed jobs safely', async () => {
  let calls = 0;
  const stt: TranscriptionProvider = { async transcribe(input) { if (++calls === 1) throw new ProviderError('stt_unavailable'); return new FixtureTranscription(fixturesDir).transcribe(input); } };
  ctx = await setup(undefined, stt); const res = await ctx.upload(); expect(res.statusCode).toBe(201); const uploadId = res.json().uploadId;
  expect(await ctx.job('transcribe', { uploadId })).toMatchObject({ status: 'failed', errorCode: 'stt_unavailable' }); expect(await ctx.input()).toBe(0);
  const second = await ctx.job('transcribe', { uploadId }); expect(second).toMatchObject({ status: 'succeeded', attempt: 2 });
  await ctx.note('다른 입력'); expect((await ctx.job('transcribe', { uploadId })).id).toBe(second.id); expect(await ctx.input()).toBe(2);
  expect(ctx.transcribe).toHaveBeenCalledTimes(2);
  const other = await ctx.upload(); expect((await ctx.job('transcribe', { uploadId: other.json().uploadId })).id).not.toBe(second.id);
  expect(await ctx.input()).toBe(3);
});

it('publishes atomically and deduplicates same key and same draft, while rejecting conflicting bodies', async () => {
  ctx = await setup(); await ctx.prepare(); await ctx.structure(); const key = randomUUID();
  const first = await ctx.share(key); expect(first.statusCode).toBe(200);
  expect((await ctx.share(key)).json()).toEqual({ ...first.json(), alreadyPublished: true });
  expect((await ctx.share()).json()).toEqual({ ...first.json(), alreadyPublished: true });
  expect((await ctx.share(key, 2)).json().error.reason).toBe('idempotency_conflict');
  expect((await ctx.request('b', ctx.base.replace('v_im_03', 'v_os_01') + '/share', 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: key })).json().error.reason).toBe('idempotency_conflict');
  expect(ctx.db.prepare("SELECT count(*) n FROM share_logs WHERE action='publish' AND visitId='v_im_03'").get()).toEqual({ n: 1 });
  const logs = (await ctx.request('patient', '/api/patients/p_01/share-log')).json().logs;
  expect(logs.filter((x: any) => x.visitId === 'v_im_03')).toMatchObject([{ action: 'publish', version: 1, targetUserId: null, oldScope: null, newScope: null }]);
  expect((await ctx.request('b', '/api/patients/p_01/share-log')).statusCode).toBe(403);
});

it('refuses blocked, stale and superseded drafts; re-generation preserves the last shared version', async () => {
  ctx = await setup(); await ctx.prepare(); await ctx.structure(); expect((await ctx.share()).statusCode).toBe(200);
  const published = (await ctx.request('a', ctx.base)).json();
  await ctx.note('혼입 시연'); expect(await ctx.structure()).toMatchObject({ resultState: 'blocked' });
  expect((await ctx.share(randomUUID(), 2, 2)).json().error.reason).toBe('blocked');
  expect((await ctx.request('b', `${ctx.base}?view=draft`)).json().record.blocks).toEqual({});
  expect((await ctx.share(randomUUID(), 1, 1)).json().error.reason).toBe('stale_input');
  await ctx.note('추가 메모'); expect((await ctx.share(randomUUID(), 2, 2)).json().error.reason).toBe('stale_input');
  expect((await ctx.request('a', ctx.base)).json()).toEqual(published);
});

it('rejects current author scope/active and representative delegation revocation, including successful-key replay', async () => {
  ctx = await setup(); await ctx.prepare(); await ctx.structure(); const key = randomUUID(); expect((await ctx.share(key)).statusCode).toBe(200);
  expect((await ctx.request('a', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: randomUUID() })).statusCode).toBe(403);
  ctx.db.prepare('UPDATE patients SET delegated=1').run();
  expect((await ctx.request('a', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: randomUUID() })).statusCode).toBe(200);
  ctx.db.prepare('UPDATE patients SET delegated=0').run();
  expect((await ctx.request('a', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: randomUUID() })).statusCode).toBe(403);
  await ctx.request('patient', '/api/patients/p_01/members/u_b/scope', 'PUT', { scope: 'schedule' });
  expect((await ctx.share(key)).statusCode).toBe(403);
  ctx.db.prepare("UPDATE members SET active=0 WHERE userId='u_b'").run(); expect((await ctx.share(key)).statusCode).toBe(403);
  expect((await ctx.request('patient', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: randomUUID() })).statusCode).toBe(200);
});

it('rolls back published pointer/status/log/idempotency if any publish write fails', async () => {
  ctx = await setup(); await ctx.prepare(); await ctx.structure();
  ctx.db.exec("CREATE TRIGGER fail_share BEFORE INSERT ON share_requests BEGIN SELECT RAISE(ABORT,'virtual write failure'); END");
  expect((await ctx.share()).statusCode).toBe(500);
  expect((await ctx.request('c', ctx.base)).json()).not.toHaveProperty('record');
  expect(ctx.db.prepare("SELECT status,recordPublishedVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ status: 'upcoming', recordPublishedVersion: null });
  expect(ctx.db.prepare("SELECT count(*) n FROM share_logs WHERE visitId='v_im_03'").get()).toEqual({ n: 0 });
  ctx.db.exec('DROP TRIGGER fail_share'); expect((await ctx.share()).statusCode).toBe(200);
});

it.each(['empty', 'duplicate-segment', 'bad-time', 'permission', 'version', 'write-failure'] as const)('does not store a transcript or fake successful version on %s', async failure => {
  const stt: TranscriptionProvider = { async transcribe(input) {
    const result = await new FixtureTranscription(fixturesDir).transcribe(input);
    if (failure === 'empty') result.segments = [];
    if (failure === 'duplicate-segment') result.segments[1]!.id = result.segments[0]!.id;
    if (failure === 'bad-time') { result.segments[0]!.startMs = 1000; result.segments[0]!.endMs = 1; }
    if (failure === 'permission') ctx!.db.prepare('UPDATE patients SET recordingAllowed=0').run();
    if (failure === 'version') await ctx!.note('변환 중 새 메모');
    return result;
  } };
  ctx = await setup(undefined, stt); const upload = await ctx.upload();
  if (failure === 'write-failure') ctx.db.exec("CREATE TRIGGER fail_transcript BEFORE INSERT ON transcripts BEGIN SELECT RAISE(ABORT,'virtual failure'); END");
  const job = await ctx.job('transcribe', { uploadId: upload.json().uploadId });
  expect(job).toMatchObject({ status: 'failed', mode: null, resultVersion: null, errorCode: failure === 'version' ? 'stale_input' : ['permission', 'write-failure'].includes(failure) ? 'internal' : 'validation_failed' });
  expect(ctx.db.prepare("SELECT count(*) n FROM transcripts WHERE visitId='v_im_03'").get()).toEqual({ n: 0 });
  expect(await ctx.input()).toBe(failure === 'version' ? 1 : 0);
});

it('deduplicates queued/running/succeeded product structure requests, retries failures and retains old shared blocks', async () => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const fixture = validatedLLM(new FixtureLLM(fixturesDir));
  ctx = await setup({ async generate(request) { if (request.input.purpose === 'record') await held; return fixture.generate(request); } }); await ctx.prepare();
  const payload = { inputVersion: 1 };
  const first = await ctx.request('b', `${ctx.base}/structure`, 'POST', payload);
  const duplicate = await ctx.request('b', `${ctx.base}/structure`, 'POST', payload);
  expect(duplicate.json()).toEqual(first.json()); const running = ctx.app.baton.runner.runNext();
  expect((await ctx.request('b', `/api/jobs/${first.json().jobId}`)).json().status).toBe('running');
  expect((await ctx.request('b', `${ctx.base}/structure`, 'POST', payload)).json()).toEqual(first.json());
  release(); await running;
  expect((await ctx.request('b', `${ctx.base}/structure`, 'POST', payload)).json()).toEqual(first.json());
  const key = randomUUID(); expect((await ctx.share(key)).statusCode).toBe(200);
  const before = (await ctx.request('a', ctx.base)).json();
  await ctx.note('실패 시연'); expect(await ctx.structure()).toMatchObject({ status: 'failed', errorCode: 'ai_unavailable' });
  expect((await ctx.request('a', ctx.base)).json()).toEqual(before);
  expect((await ctx.share(key)).json().error.reason).toBe('stale_input');
  expect(await ctx.structure()).toMatchObject({ status: 'succeeded', attempt: 2, resultVersion: 2 });
  expect((await ctx.request('a', ctx.base)).json()).toEqual(before);
  expect((await ctx.share(randomUUID(), 1, 2)).json().error.reason).toBe('stale_input');
  expect((await ctx.share(randomUUID(), 2, 2)).statusCode).toBe(200);
});

it('applies safety validation to mocked OpenAI record output through the product structure/share APIs', async () => {
  const fixture = validatedLLM(new FixtureLLM(fixturesDir));
  const transport = vi.fn(async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(expected('structure/v_im_03.leak.json')) }] }] }), { status: 200 }));
  const openai = validatedLLM(new OpenAILLM('virtual-test-key', 'virtual-model', { fetch: transport }));
  ctx = await setup({ generate: request => request.input.purpose === 'record' ? openai.generate(request) : fixture.generate(request) });
  await ctx.prepare(); expect(await ctx.structure()).toMatchObject({ status: 'succeeded', mode: 'live', resultState: 'blocked' });
  expect((await ctx.share()).json().error.reason).toBe('blocked');
  expect((await ctx.request('b', `${ctx.base}?view=draft`)).json().record.blocks).toEqual({});
  expect(transport).toHaveBeenCalledTimes(1); expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('compares record facts at ready storage, publishes ordinary uncertainty, and preserves alert history/status on API resolution', async () => {
  ctx = await setup(); await ctx.prepare();
  ctx.db.prepare("UPDATE prescriptions SET items=?,text=? WHERE id='rx_im_03'").run(JSON.stringify([{ drugKey: 'batodipine', drugName: '바토디핀정 5mg', dose: '1정', timing: ['morning'] }]), '바토디핀정 5mg 아침 1정');
  expect(await ctx.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  const list = '/api/patients/p_01/alerts';
  expect((await ctx.request('a', list)).json().alerts).toHaveLength(1);
  const alert = (await ctx.request('patient', list)).json().alerts.find((x: any) => x.kind === 'record_vs_prescription');
  expect(alert.differences).toEqual([{ field: 'dose', left: '0.5정', right: '1정' }]);
  expect((await ctx.share()).statusCode).toBe(200);
  expect((await ctx.request('a', list)).json().alerts).toHaveLength(2);
  const url = `${list}/${alert.id}/resolve`;
  expect((await ctx.request('a', url, 'POST', { action: 'confirm_hospital' })).json().alert.status).toBe('awaiting_confirmation');
  expect((await ctx.request('a', url, 'POST', { action: 'reupload' })).json().alert).toMatchObject({ status: 'open', history: [{ action: 'detected' }, { action: 'confirm_hospital' }, { action: 'reupload' }] });
  expect((await ctx.request('a', url, 'POST', { action: 'edit_note', fact: alert.references[0].fact })).json().error.reason).toBe('unsupported_action');
  for (const user of ['b', 'c']) expect((await ctx.request(user, list)).statusCode).toBe(404);
});

it('removes an upload file when registration fails and validates upload/visit ownership before transcription', async () => {
  ctx = await setup();
  ctx.db.exec("CREATE TRIGGER fail_upload BEFORE INSERT ON uploads BEGIN SELECT RAISE(ABORT,'virtual upload write failure'); END");
  expect((await ctx.upload()).statusCode).toBe(500); expect(await readdir(ctx.uploadDir)).toEqual([]);
  ctx.db.exec('DROP TRIGGER fail_upload');
  const res = await ctx.upload(); const uploadId = res.json().uploadId;
  const wrong = await ctx.request('b', ctx.base.replace('v_im_03', 'v_os_01') + '/transcribe', 'POST', { uploadId });
  expect(wrong.statusCode).toBe(404); expect(ctx.transcribe).not.toHaveBeenCalled();
  expect((await ctx.request('b', `${ctx.base}/structure`, 'POST', { inputVersion: 99 })).json().error.reason).toBe('stale_input');
});
