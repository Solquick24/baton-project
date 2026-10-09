import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenAILLM, openaiOutputSchema } from '../src/adapters/ai/openai.js';
import { generatedSchemas, validatedLLM, type LLMRequest } from '../src/adapters/ai/providers.js';
import { FixtureLLM } from '../src/adapters/ai/fixture.js';
import { BedrockLLM } from '../src/adapters/ai/bedrock.js';
import { loadGenerationInput } from '../src/adapters/sqlite/generation-repository.js';
import { readConfig } from '../src/shared/config.js';
import { buildApp } from '../src/app.js';
import { fixtureDatabase, fixturesDir } from './helpers.js';
import { expected } from './phase3-helpers.js';
import { pregenerateDatabase } from '../../../scripts/pregenerate.js';

const key = 'test-only-openai-secret-do-not-log';
const model = 'gpt-4.1-mini-2025-04-14';
const env = { JWT_SECRET: 'baton-fixture-test-secret-not-for-real-use', SQLITE_PATH: ':memory:' };
const files = { questions: 'merge-questions/v_im_03.json', briefing: 'briefing/v_im_03.json', record: 'structure/v_im_03.json' };
const completed = (text: string) => ({ status: 'completed', error: null, incomplete_details: null,
  output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text }] }],
});
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
async function request(purpose: LLMRequest['input']['purpose'] = 'questions'): Promise<LLMRequest> {
  const db = fixtureDatabase();
  try {
    if (purpose === 'briefing') await pregenerateDatabase(db, fixturesDir);
    return { input: loadGenerationInput(db, 'u_b', 'p_01', 'v_im_03', purpose), attempt: 1, instruction: '가상 자료만 정리한다.' };
  } finally { db.close(); }
}

it('blocks actual external HTTP in all API tests', async () => {
  await expect(fetch('https://api.openai.com/v1/responses')).rejects.toThrow('실제 외부 HTTP');
});
it.each(['questions', 'briefing', 'record'] as const)('sends stateless strict Responses %s requests and preserves exact nullable output', async (purpose) => {
  const raw = expected(files[purpose]);
  const transport = vi.fn(async (_url: string, _init: RequestInit) => reply(completed(JSON.stringify(raw))));
  const provider = new OpenAILLM(key, model, { fetch: transport });
  expect(await validatedLLM(provider).generate(await request(purpose))).toEqual({ mode: 'live', section: purpose, blocks: raw });
  const [url, init] = transport.mock.calls[0]!;
  expect(url).toBe('https://api.openai.com/v1/responses');
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${key}` } });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  const body = JSON.parse(init.body as string);
  expect(body).toMatchObject({ model, store: false, text: { format: { type: 'json_schema', strict: true, name: `baton_${purpose}` } } });
  expect(body.instructions).toMatch(/치료 권고/);
  for (const field of ['temperature', 'top_p', 'reasoning', 'tools', 'previous_response_id', 'conversation', 'background']) expect(Object.keys(body)).not.toContain(field);
  expect(JSON.stringify(body)).not.toContain(key);
  expect(JSON.stringify(body.input)).not.toMatch(/v_os_01|rx_os_01|ob_03|가상록소정/);
  expect(JSON.stringify(provider)).not.toContain(key);
});
it.each(['questions', 'briefing'] as const)('provides resolvable %s source identities and original quotes without unrelated department data', async (purpose) => {
  const raw = expected(files[purpose]);
  const transport = vi.fn(async () => reply(completed(JSON.stringify(raw))));
  const provider = new OpenAILLM(key, model, { fetch: transport });
  await validatedLLM(provider).generate(await request(purpose));
  const [, init] = transport.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  const content: string = body.input[0].content;
  const sent = JSON.parse(content.slice(content.indexOf('{')));
  const refs = purpose === 'questions' ? raw.full.basisRefs : raw.full.sourceRefs;
  for (const ref of refs) {
    const entry = sent.sourceCatalog.find((candidate: { source: unknown }) => JSON.stringify(candidate.source) === JSON.stringify(ref.source));
    expect(entry, 'every expected source must be available to the model').toBeDefined();
    if (ref.quote !== null) expect(entry.quoteOptions.some((quote: string) => quote.includes(ref.quote))).toBe(true);
  }
  expect(JSON.stringify(sent.sourceCatalog)).not.toMatch(/v_os_01|rx_os_01|ob_03|가상록소정/);
  expect(sent.sourceCatalog.some((entry: { source: { type: string } }) => entry.source.type === 'transcript')).toBe(false);
});
it.each(['questions', 'briefing', 'record'] as const)('keeps %s schema required/nullable meaning instead of inventing null optional keys', (purpose) => {
  const original = z.toJSONSchema(generatedSchemas[purpose]);
  const wire = openaiOutputSchema(purpose) as any;
  expect(wire).not.toHaveProperty('$schema');
  expect(JSON.stringify(wire)).not.toMatch(/"oneOf"|"const"|"exclusiveMinimum"/);
  function check(a: any, b: any) {
    if (!a || typeof a !== 'object') return;
    if (a.type === 'object') {
      expect(b.additionalProperties).toBe(false);
      expect(b.required).toEqual(a.required ?? []);
      expect([...b.required].sort()).toEqual(Object.keys(a.properties ?? {}).sort());
      for (const field of Object.keys(a.properties ?? {})) check(a.properties[field], b.properties[field]);
    }
    if (a.type) expect(b.type).toEqual(a.type);
    if (a.anyOf) { expect(b.anyOf).toHaveLength(a.anyOf.length); a.anyOf.forEach((v: any, i: number) => check(v, b.anyOf[i])); }
    if (a.oneOf) { expect(b.anyOf).toHaveLength(a.oneOf.length); a.oneOf.forEach((v: any, i: number) => check(v, b.anyOf[i])); }
    if (a.const !== undefined) expect(b.enum).toEqual([a.const]);
    if (a.items) check(a.items, b.items);
    if (a.exclusiveMinimum !== undefined) expect(b.minimum).toBe(1);
  }
  check(original, wire);
  if (purpose === 'record') {
    expect(wire.properties.full.properties).not.toHaveProperty('transcript');
    expect(wire.properties.full.properties.medReasons.items.properties.text.type).toContain('null');
  }
});
it.each(['invalid-json', 'invalid-envelope', 'schema-invalid', 'multiple-messages', 'tool-output'])('retries %s exactly once through existing validatedLLM, then fails safely', async (failure) => {
  const body = completed(JSON.stringify(expected(files.questions)));
  if (failure === 'invalid-json') body.output[0]!.content[0]!.text = '{broken';
  if (failure === 'schema-invalid') body.output[0]!.content[0]!.text = '{"unexpected":"field"}';
  if (failure === 'multiple-messages') body.output.push(body.output[0]!);
  const transport = vi.fn(async () => failure === 'tool-output' ? reply({ ...body, output: [{ type: 'function_call', name: 'external_tool' }] }) : reply(failure === 'invalid-envelope' ? {} : body));
  await expect(validatedLLM(new OpenAILLM(key, model, { fetch: transport })).generate(await request())).rejects.toMatchObject({ code: 'validation_failed' });
  expect(transport).toHaveBeenCalledTimes(2);
});
it('recovers one malformed JSON response without changing mode', async () => {
  const transport = vi.fn().mockResolvedValueOnce(reply(completed('{invalid'))).mockResolvedValueOnce(reply(completed(JSON.stringify(expected(files.questions)))));
  expect((await validatedLLM(new OpenAILLM(key, model, { fetch: transport })).generate(await request())).mode).toBe('live');
  expect(transport).toHaveBeenCalledTimes(2);
});
it('retries malformed HTTP JSON once and bounds the request to 30 seconds', async () => {
  const signal = new AbortController().signal, deadline = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
  const transport = vi.fn().mockResolvedValueOnce(new Response('{broken')).mockResolvedValueOnce(reply(completed(JSON.stringify(expected(files.questions)))));
  expect((await validatedLLM(new OpenAILLM(key, model, { fetch: transport })).generate(await request())).mode).toBe('live');
  expect(deadline).toHaveBeenCalledWith(30_000);
  expect(transport.mock.calls[0]![1].signal).toBe(signal);
  expect(transport).toHaveBeenCalledTimes(2);
});
it.each(['refusal', 'incomplete', 'content-filter', 'failed'])('rejects %s without returning partial content or upstream messages', async (kind) => {
  const body: any = completed(JSON.stringify(expected(files.questions)));
  if (kind === 'refusal') body.output[0].content.push({ type: 'refusal', refusal: `${key} private original` });
  else if (kind === 'failed') { body.status = 'failed'; body.error = { message: key }; }
  else { body.status = 'incomplete'; body.incomplete_details = { reason: kind === 'incomplete' ? 'max_output_tokens' : 'content_filter' }; }
  const transport = vi.fn(async () => reply(body));
  try { await validatedLLM(new OpenAILLM(key, model, { fetch: transport })).generate(await request()); throw Error('Expected failure'); }
  catch (error) { expect(error).toMatchObject({ code: kind === 'failed' ? 'ai_unavailable' : 'validation_failed' }); expect(String(error)).not.toContain(key); }
  expect(transport).toHaveBeenCalledTimes(1);
});
it.each([400, 401, 403, 404, 429, 500])('maps HTTP %i to ai_unavailable without logging or reading its body', async (status) => {
  const response = reply({ error: { message: `${key} private original` } }, status), json = vi.spyOn(response, 'json');
  const transport = vi.fn(async () => response);
  await expect(validatedLLM(new OpenAILLM(key, model, { fetch: transport })).generate(await request())).rejects.toMatchObject({ code: 'ai_unavailable' });
  expect(json).not.toHaveBeenCalled(); expect(transport).toHaveBeenCalledTimes(1);
});
it.each(['TimeoutError', 'AbortError', 'TypeError'])('safely maps transport %s without hidden retries', async (name) => {
  const transport = vi.fn(async () => { const error = new Error(key); error.name = name; throw error; });
  await expect(validatedLLM(new OpenAILLM(key, model, { fetch: transport })).generate(await request())).rejects.toMatchObject({ code: 'ai_unavailable' });
  expect(transport).toHaveBeenCalledTimes(1);
});
it('labels actual fixture fallback and validates it normally after an OpenAI refusal', async () => {
  const transport = vi.fn(async () => reply({ status: 'incomplete', output: [] }));
  const result = await validatedLLM(new OpenAILLM(key, model, { fetch: transport }), new FixtureLLM(fixturesDir)).generate(await request());
  expect(result).toEqual({ mode: 'fixture', section: 'questions', blocks: expected(files.questions) });
  expect(transport).toHaveBeenCalledTimes(1);
});
it('keeps fixture defaults/keyless operation and requires explicit live OpenAI settings without exposing values', () => {
  expect(readConfig(env)).toMatchObject({ llmProvider: 'openai', llmMode: 'fixture', sttMode: 'fixture', openaiApiKey: '', openaiModel: '' });
  expect(() => readConfig({ ...env, LLM_PROVIDER: 'other' })).toThrow('LLM_PROVIDER');
  expect(() => readConfig({ ...env, LLM_MODE: 'live' })).toThrow('OPENAI_API_KEY, OPENAI_MODEL');
  try { readConfig({ ...env, LLM_MODE: 'live', OPENAI_API_KEY: key }); } catch (error) { expect(String(error)).toContain('OPENAI_MODEL'); expect(String(error)).not.toContain(key); }
  expect(readConfig({ ...env, LLM_MODE: 'live', LLM_PROVIDER: 'bedrock' }).llmProvider).toBe('bedrock');
});
it.each(['fixture', 'openai', 'bedrock'] as const)('selects %s in app assembly, leaves STT unchanged and never calls providers on GET', async (choice) => {
  const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(completed(JSON.stringify(expected(files.questions)))));
  const bedrock = vi.spyOn(BedrockLLM.prototype, 'generateRaw').mockResolvedValue(expected(files.questions));
  const db = fixtureDatabase();
  const config = readConfig({ ...env, LLM_MODE: choice === 'fixture' ? 'fixture' : 'live', LLM_PROVIDER: choice === 'bedrock' ? 'bedrock' : 'openai', OPENAI_API_KEY: key, OPENAI_MODEL: model, LIVE_FALLBACK_TO_FIXTURE: 'false' });
  const app = await buildApp({ db, config });
  try {
    await app.ready(); await app.baton.runner.stop();
    expect(app.baton.stt).toBeInstanceOf((await import('../src/adapters/ai/fixture.js')).FixtureTranscription);
    for (let i = 0; i < 10; i++) await app.inject('/api/health');
    expect(transport).not.toHaveBeenCalled(); expect(bedrock).not.toHaveBeenCalled();
    expect((await app.baton.llm.generate(await request())).mode).toBe(choice === 'fixture' ? 'fixture' : 'live');
    expect(transport).toHaveBeenCalledTimes(choice === 'openai' ? 1 : 0);
    expect(bedrock).toHaveBeenCalledTimes(choice === 'bedrock' ? 1 : 0);
  } finally { await app.close(); db.close(); }
});
it('passes OpenAI output through real question/briefing storage safety, mode and HTTP permissions', async () => {
  const db = fixtureDatabase(), transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = JSON.parse(init!.body as string), section = body.text.format.name.replace('baton_', '') as keyof typeof files;
    return reply(completed(JSON.stringify(expected(files[section]))));
  });
  const config = readConfig({ ...env, LLM_MODE: 'live', OPENAI_API_KEY: key, OPENAI_MODEL: model, LIVE_FALLBACK_TO_FIXTURE: 'false' });
  const app = await buildApp({ db, config });
  try {
    await app.ready(); await app.baton.runner.stop();
    const headers = { authorization: `Bearer ${app.jwt.sign({ sub: 'u_b' })}` }, base = '/api/patients/p_01/visits/v_im_03';
    for (const [path, payload] of [['questions/merge', { inputVersion: 3 }], ['briefing', { questionsVersion: 1 }]] as const) {
      const res = await app.inject({ method: 'POST', url: `${base}/${path}`, headers, payload });
      expect(res.statusCode).toBe(202); await app.baton.runner.runNext();
      expect((await app.inject({ url: `/api/jobs/${res.json().jobId}`, headers })).json()).toMatchObject({ status: 'succeeded', mode: 'live', resultState: 'ready' });
    }
    expect(transport).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ url: `${base}/briefing`, headers });
      expect(Object.keys(res.json().blocks)).toEqual(['companion']); expect(res.body).not.toMatch(/sourceRefs|가상질환|7.2%/); expect(res.body).not.toContain(key);
    }
    expect(transport).toHaveBeenCalledTimes(2);
    // Schema-valid OpenAI output still cannot bypass the existing storage safety gate.
    db.prepare("UPDATE visits SET questionsInputVersion=4 WHERE id='v_im_03'").run();
    const bad = expected(files.questions); bad.companion.mergedQuestions[0].text = '가 상 질 환 Ｋ１';
    transport.mockResolvedValue(reply(completed(JSON.stringify(bad))));
    const res = await app.inject({ method: 'POST', url: `${base}/questions/merge`, headers, payload: { inputVersion: 4 } });
    await app.baton.runner.runNext();
    expect((await app.inject({ url: `/api/jobs/${res.json().jobId}`, headers })).json()).toMatchObject({ status: 'succeeded', mode: 'live', resultState: 'blocked' });
    expect((await app.inject({ url: `${base}/questions`, headers })).json()).not.toHaveProperty('merged');
  } finally { await app.close(); db.close(); }
});
it.each(['true', 'false'] as const)('honors app fallback=%s and keeps transport secrets out of job responses', async (fallback) => {
  const transport = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(`${key} 가상 원문`));
  const db = fixtureDatabase(), config = readConfig({ ...env, LLM_MODE: 'live', OPENAI_API_KEY: key, OPENAI_MODEL: model, LIVE_FALLBACK_TO_FIXTURE: fallback });
  const app = await buildApp({ db, config });
  const logs = vi.spyOn(app.log, 'info');
  try {
    await app.ready(); await app.baton.runner.stop();
    const headers = { authorization: `Bearer ${app.jwt.sign({ sub: 'u_b' })}` };
    const res = await app.inject({ method: 'POST', url: '/api/patients/p_01/visits/v_im_03/questions/merge', headers, payload: { inputVersion: 3 } });
    await app.baton.runner.runNext();
    const job = await app.inject({ url: `/api/jobs/${res.json().jobId}`, headers });
    expect(job.json()).toMatchObject(fallback === 'true' ? { status: 'succeeded', mode: 'fixture', resultState: 'ready' } : { status: 'failed', mode: null, errorCode: 'ai_unavailable' });
    expect(job.body).not.toMatch(/test-only-openai-secret|가상 원문/);
    expect(logs).toHaveBeenCalled();
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/test-only-openai-secret|가상 원문/);
    expect(transport).toHaveBeenCalledTimes(1);
    if (fallback === 'false') expect(db.prepare("SELECT count(*) n FROM block_sets WHERE section='questions'").get()).toEqual({ n: 0 });
  } finally { await app.close(); db.close(); }
});
