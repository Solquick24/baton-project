import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/shared/config.js';
import { fixtureDatabase, password } from './helpers.js';
import { expected } from './phase3-helpers.js';

it('uses the selected OpenAI adapter through product APIs for all text pipelines, validated ready storage and reviewed sharing (mock transport only)', async () => {
  const secret = 'virtual-openai-test-secret';
  const files: Record<string, string> = { questions: 'merge-questions/v_im_03.json', briefing: 'briefing/v_im_03.json', record: 'structure/v_im_03.json' };
  const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(init!.body as string); expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined(); expect(body.previous_response_id).toBeUndefined();
    const section = body.text.format.name.replace('baton_', '');
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(expected(files[section]!)) }] }] }));
  });
  const db = fixtureDatabase(), dir = await mkdtemp(join(tmpdir(), 'baton-openai-integration-'));
  const app = await buildApp({ db, config: readConfig({ ...process.env, UPLOAD_DIR: dir, LLM_PROVIDER: 'openai', LLM_MODE: 'live', STT_MODE: 'fixture', OPENAI_API_KEY: secret, OPENAI_MODEL: 'virtual-model', LIVE_FALLBACK_TO_FIXTURE: 'false' }) });
  try {
    await app.ready(); await app.baton.runner.stop();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'b@baton.demo', password } });
    const headers = { authorization: `Bearer ${login.json().accessToken}` }, base = '/api/patients/p_01/visits/v_im_03';
    async function postJob(path: string, payload: object) {
      const res = await app.inject({ method: 'POST', url: `${base}/${path}`, headers, payload }); expect(res.statusCode).toBe(202);
      await app.baton.runner.runNext(); return (await app.inject({ url: `/api/jobs/${res.json().jobId}`, headers })).json();
    }
    for (const [path, payload] of [['questions/merge', { inputVersion: 3 }], ['briefing', { questionsVersion: 1 }]] as const) expect(await postJob(path, payload)).toMatchObject({ status: 'succeeded', mode: 'live', resultState: 'ready' });
    const boundary = 'virtual-boundary';
    const audio = await app.inject({ method: 'POST', url: `${base}/audio`, headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="virtual.wav"\r\nContent-Type: audio/wav\r\n\r\nRIFF virtual audio only\r\n--${boundary}--\r\n`) });
    expect(audio.statusCode).toBe(201); expect(await postJob('transcribe', { uploadId: audio.json().uploadId })).toMatchObject({ status: 'succeeded', mode: 'fixture' });
    expect(await postJob('structure', { inputVersion: 1 })).toMatchObject({ status: 'succeeded', mode: 'live', resultState: 'ready' });
    const draft = await app.inject({ url: `${base}?view=draft`, headers });
    expect(draft.json().record).toMatchObject({ inputVersion: 1, shareable: true, mode: 'live' }); expect(draft.body).not.toContain(secret);
    expect((await app.inject({ url: base, headers })).json()).not.toHaveProperty('record');
    expect((await app.inject({ method: 'POST', url: `${base}/share`, headers, payload: { draftVersion: 1, inputVersion: 1, idempotencyKey: randomUUID() } })).statusCode).toBe(200);
    for (let i = 0; i < 10; i++) {
      const published = await app.inject({ url: base, headers }); expect(Object.keys(published.json().record.blocks)).toEqual(['schedule', 'companion']); expect(published.body).not.toContain(secret);
    }
    expect(transport).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(transport.mock.calls.map(c => JSON.parse(c[1]!.body as string).input))).not.toMatch(/v_os_01|ob_03|rx_os_01|가상록소정/);
  } finally { await app.close(); db.close(); await rm(dir, { recursive: true, force: true }); }
});
