import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it, vi } from 'vitest';
import { recordGeneratedBlocksSchema } from '@baton/contracts';
import type { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildApp } from '../src/app.js';
import { authenticate } from '../src/auth/session.js';
import { loadGenerationInput } from '../src/adapters/sqlite/generation-repository.js';
import { readVisit } from '../src/adapters/sqlite/visit-repository.js';
import { FixtureLLM, FixtureTranscription } from '../src/adapters/ai/fixture.js';
import { BedrockLLM } from '../src/adapters/ai/bedrock.js';
import { validatedLLM, ProviderError, type LLMRequest, type RawLLMProvider } from '../src/adapters/ai/providers.js';
import { fixtureDatabase, fixturesDir } from './helpers.js';

function request(purpose: 'questions' | 'record' = 'record', note?: string): LLMRequest {
  const db = fixtureDatabase();
  try {
    if (note) db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?)').run('note_test', 'p_01', 'v_im_03', 'u_b', note, new Date().toISOString());
    return { input: loadGenerationInput(db, 'u_b', 'p_01', 'v_im_03', purpose), attempt: 1, instruction: '기록만 정리한다.' };
  } finally { db.close(); }
}
const json = (file: string) => JSON.parse(readFileSync(resolve(fixturesDir, 'expected', file), 'utf8'));
it('passes only same-patient/department/past data to injected provider through HTTP; GET makes zero calls', async () => {
  const statements: string[] = [];
  const db = fixtureDatabase((s) => statements.push(s));
  const generate = vi.fn(validatedLLM(new FixtureLLM(fixturesDir)).generate);
  const app = await buildApp({ db, llm: { generate } });
  app.post<{ Params: { pid: string; vid: string } }>('/probe/:pid/generate/:vid', async (req) => {
    const user = await authenticate(req, db);
    const result = await app.baton.llm.generate({ input: loadGenerationInput(db, user, req.params.pid, req.params.vid, 'questions'), attempt: 1, instruction: '질문 정리' });
    return { mode: result.mode }; // Internal input never returned over HTTP.
  });
  app.get('/probe/read', async (req) => readVisit(db, await authenticate(req, db), 'p_01', 'v_im_02'));
  try {
    // Test-only sentinel table proves generation never queries private notes (Tier C remains unimplemented).
    db.exec('CREATE TEMP TABLE private_notes (text TEXT)');
    db.prepare('INSERT INTO private_notes VALUES (?)').run('private-sentinel-never-send');
    statements.length = 0;
    const headers = { authorization: `Bearer ${app.jwt.sign({ sub: 'u_b' })}` };
    expect((await app.inject({ method: 'POST', url: '/probe/p_01/generate/v_im_03', headers })).statusCode).toBe(200);
    const input = JSON.stringify(generate.mock.calls[0]![0].input);
    for (const forbidden of ['v_os_01', 'ob_03', 'rx_os_01', '가상록소정', 'private-sentinel']) expect(input).not.toContain(forbidden);
    expect(statements.some((s) => s.includes('private_notes'))).toBe(false);
    expect(input).toContain('v_im_01'); expect(input).toContain('v_im_02');
    for (let i = 0; i < 10; i++) expect((await app.inject({ url: '/probe/read', headers })).statusCode).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await app.inject({ method: 'POST', url: '/probe/p_01/generate/v_os_01', headers })).statusCode).toBe(502); // No matching fixture.
    expect((await app.inject({ method: 'POST', url: '/probe/p_02/generate/v_im_03', headers })).statusCode).toBe(403);
  } finally { await app.close(); db.close(); }
});
it('filters current-visit structure originals, future observations and unpublished records', () => {
  const db = fixtureDatabase();
  try {
    db.prepare("INSERT INTO notes VALUES ('note_other','p_01','v_os_01','u_a','other-dept-note','2026-01-01T00:00:00Z')").run();
    const input = loadGenerationInput(db, 'u_b', 'p_01', 'v_im_03', 'record');
    expect(JSON.stringify(input)).not.toMatch(/rx_os_01|note_other|v_im_02/);
    expect(JSON.stringify(input)).toContain('rx_im_03');
    expect(() => loadGenerationInput(db, 'u_c', 'p_01', 'v_im_03', 'record')).toThrow();
    expect(() => loadGenerationInput(db, 'u_b', 'p_01', 'v_im_03', 'briefing')).toThrow('다시 확인');
    db.prepare("UPDATE visits SET recordPublishedVersion=NULL WHERE id='v_im_02'").run();
    const filtered = loadGenerationInput(db, 'u_b', 'p_01', 'v_im_03', 'questions');
    expect('records' in filtered && filtered.records?.some((r) => r.visitId === 'v_im_02')).toBe(false);
  } finally { db.close(); }
});
it('briefing excludes future observations and keeps only same-department past sources', () => {
  const db = fixtureDatabase();
  try {
    db.prepare("INSERT INTO block_sets VALUES ('merged','p_01','v_im_03','questions',1,3,'ready','fixture','u_b','2026-03-12T00:00:00Z','[]')").run();
    const blocks = json('merge-questions/v_im_03.json');
    for (const kind of ['schedule', 'companion', 'full']) db.prepare('INSERT INTO visit_blocks VALUES (?,?,?)').run('merged', kind, JSON.stringify(blocks[kind]));
    db.prepare("UPDATE visits SET questionsVersion=1 WHERE id='v_im_03'").run();
    db.prepare("INSERT INTO observations VALUES ('future-ob','p_01','내과','u_a','future-sentinel',NULL,'2026-04-01',1,NULL)").run();
    const input = JSON.stringify(loadGenerationInput(db, 'u_b', 'p_01', 'v_im_03', 'briefing'));
    expect(input).toContain('ob_02');
    expect(input).not.toMatch(/future-sentinel|ob_03|v_os_01|rx_os_01|가상록소정/);
  } finally { db.close(); }
});
it('uses first matching manifest rule, persists actual mode, fails first job attempt without hidden retries', async () => {
  const provider = validatedLLM(new FixtureLLM(fixturesDir));
  const plain = await provider.generate(request());
  expect(plain.mode).toBe('fixture'); recordGeneratedBlocksSchema.parse(plain.blocks);
  const leak = await provider.generate(request('record', '혼입 시연'));
  expect(JSON.stringify(leak.blocks)).toContain('가상질환 K1'); // Schema-valid, NOT semantic-safe; no storage here.
  const failed = request('record', '실패 시연');
  await expect(provider.generate(failed)).rejects.toMatchObject({ code: 'ai_unavailable' });
  expect((await provider.generate({ ...failed, attempt: 2 })).mode).toBe('fixture');
  const stt = await new FixtureTranscription(fixturesDir).transcribe({ patientId: 'p_01', visitId: 'v_im_03', attempt: 1 });
  expect(stt.mode).toBe('fixture'); expect(stt.segments).toHaveLength(6);
});
it('rejects malformed fixture before any storage with the same two-attempt limit as live', async () => {
  const raw = vi.fn(async () => ({ schedule: {}, companion: { quote: 'forbidden' }, full: {} }));
  const save = vi.fn();
  await expect(validatedLLM({ mode: 'fixture', generateRaw: raw }).generate(request()).then(save)).rejects.toMatchObject({ code: 'validation_failed' });
  expect(raw).toHaveBeenCalledTimes(2); expect(save).not.toHaveBeenCalled();
  const once = vi.fn().mockResolvedValueOnce({ malformed: true }).mockResolvedValueOnce(json('structure/v_im_03.json'));
  expect((await validatedLLM({ mode: 'live', generateRaw: once }).generate(request())).mode).toBe('live');
  expect(once).toHaveBeenCalledTimes(2); // Mock only; not a live success measurement.
});
it('wraps live errors and labels validated fixture fallback honestly', async () => {
  const live: RawLLMProvider = { mode: 'live', generateRaw: vi.fn(async () => { throw new ProviderError('ai_unavailable'); }) };
  await expect(validatedLLM(live).generate(request())).rejects.toMatchObject({ code: 'ai_unavailable' });
  expect((await validatedLLM(live, new FixtureLLM(fixturesDir)).generate(request())).mode).toBe('fixture');
});
it('collects only one named Bedrock tool input and requests zero temperature without real SDK sends', async () => {
  const metadata = { $metadata: {}, stopReason: 'tool_use' as const, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, metrics: { latencyMs: 0 } };
  const send = vi.fn(async (_command: ConverseCommand) => ({ ...metadata, output: { message: { role: 'assistant' as const, content: [{ toolUse: { toolUseId: 'tool1', name: 'save_blocks', input: json('structure/v_im_03.json') } }] } } }));
  const bedrock = new BedrockLLM('anthropic.claude-sonnet-5', { send });
  try {
    const result = await validatedLLM(bedrock).generate(request());
    expect(result.mode).toBe('live');
    const command = send.mock.calls[0]![0];
    expect(command.input.inferenceConfig?.temperature).toBe(0);
    expect(command.input.toolConfig?.toolChoice).toEqual({ tool: { name: 'save_blocks' } });
    expect(command.input.system?.[0]).toEqual(expect.objectContaining({ text: expect.stringContaining('치료 권고') }));
  } finally { bedrock.destroy(); }
  const missing = vi.fn(async () => ({ ...metadata, output: { message: { role: 'assistant' as const, content: [{ text: 'invalid text response' }] } } }));
  const invalid = new BedrockLLM('unused', { send: missing });
  try { await expect(validatedLLM(invalid).generate(request())).rejects.toMatchObject({ code: 'validation_failed' }); expect(missing).toHaveBeenCalledTimes(2); }
  finally { invalid.destroy(); }
});
it('rejects fixture path escape and unmatched visits', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'baton-fixtures-'));
  mkdirSync(resolve(dir, 'expected'));
  writeFileSync(resolve(dir, 'outside.json'), JSON.stringify(json('structure/v_im_03.json')));
  writeFileSync(resolve(dir, 'expected/manifest.json'), JSON.stringify({ _note: 'test', pipelines: { transcribe: [], briefing: [], merge_questions: [], structure: [{ visitId: 'v_im_03', file: '../outside.json' }] } }));
  try { await expect(validatedLLM(new FixtureLLM(dir)).generate(request())).rejects.toMatchObject({ code: 'validation_failed' }); }
  finally { rmSync(dir, { recursive: true }); }
  const r = request(); r.input.visitId = 'unknown';
  await expect(validatedLLM(new FixtureLLM(fixturesDir)).generate(r)).rejects.toMatchObject({ code: 'ai_unavailable' });
});
