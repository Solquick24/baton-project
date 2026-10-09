import { afterEach, expect, it } from 'vitest';
import { recordGeneratedBlocksSchema } from '@baton/contracts';
import { FixtureLLM } from '../src/adapters/ai/fixture.js';
import { validatedLLM, type LLMResult } from '../src/adapters/ai/providers.js';
import { fixturesDir } from './helpers.js';
import { expected } from './phase3-helpers.js';
import { phase5 } from './phase5-helpers.js';
let ctx: Awaited<ReturnType<typeof phase5>> | undefined;
afterEach(async () => { await ctx?.close(); ctx = undefined; });
async function setup(mutate: (result: LLMResult) => void = () => {}) {
  const fixture = validatedLLM(new FixtureLLM(fixturesDir));
  ctx = await phase5({ async generate(request) { const result = await fixture.generate(request); mutate(result); return result; } });
  return ctx;
}
type Blocks = ReturnType<typeof recordGeneratedBlocksSchema.parse>;
it.each(['v_im_03.json', 'v_im_03.leak.json'])('generates exact record fixture and validation results: %s', async (file) => {
  const c = await setup(); if (file.includes('leak')) c.note('혼입 시연');
  const want = expected('validation.json').cases.find((r: any) => r.file === `structure/${file}`);
  expect(await c.structure()).toMatchObject({ status: 'succeeded', mode: 'fixture', resultState: want.expectedState });
  const set = c.db.prepare("SELECT id,issues FROM block_sets WHERE visitId='v_im_03' AND section='record'").get() as { id: string; issues: string };
  expect(JSON.parse(set.issues)).toEqual(want.expectedIssues);
  const blocks = Object.fromEntries((c.db.prepare('SELECT kind,payload FROM visit_blocks WHERE blockSetId=?').all(set.id) as { kind: string; payload: string }[]).map((r) => [r.kind, JSON.parse(r.payload)]));
  const { transcript, ...full } = blocks.full;
  const fixture = expected(`structure/${file}`);
  if (want.expectedState === 'blocked') fixture.companion.easySummary[0].needsCheck = true;
  expect({ ...blocks, full }).toEqual(fixture);
  expect(transcript).toMatchObject({ transcriptId: 'tr_phase5', uploadId: null, mode: 'fixture', segments: expected('transcribe/v_im_03.json').segments });
  expect(c.db.prepare("SELECT recordPublishedVersion,status FROM visits WHERE id='v_im_03'").get()).toEqual({ recordPublishedVersion: null, status: 'upcoming' });
});
it.each(['schedule', 'companion'])('blocks restricted values in all %s string fields', async (kind) => {
  const c = await setup((result) => { const b = result.blocks as Blocks; if (kind === 'schedule') b.schedule.nextSchedule[0]!.hospital = '가 상 질 환 Ｋ１'; else b.companion.medChanges[0]!.caution = '７．２％'; });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', resultState: 'blocked' });
  const b = (await c.request('u_b', `${c.base}?view=draft`)).json().record;
  expect(b).toMatchObject({ state: 'blocked', shareable: false, blocks: {} });
});
it.each(['extra-field', 'foreign-source', 'invented-quote', 'forged-transcript', 'unknown-answer'])('rejects unsafe provider output without storing a draft: %s', async (failure) => {
  const c = await setup((result) => {
    const b = result.blocks as Blocks;
    if (failure === 'extra-field') Object.assign(b.companion, { sourceRefs: [] });
    if (failure === 'foreign-source') b.full.sourceRefs[0]!.source = { type: 'prescription', prescriptionId: 'rx_os_01' };
    if (failure === 'invented-quote') b.full.sourceRefs[0]!.quote = '원본에 없는 인용';
    if (failure === 'forged-transcript') Object.assign(b.full, { transcript: null });
    if (failure === 'unknown-answer') b.full.answers[0]!.questionId = 'mq_foreign';
  });
  expect(await c.structure()).toMatchObject({ status: 'failed', errorCode: 'validation_failed' });
  expect(c.db.prepare("SELECT recordDraftVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ recordDraftVersion: null });
});
it('turns missing facts/evidence into null+needsCheck without blocking ordinary uncertainty', async () => {
  const c = await setup((result) => {
    const b = result.blocks as Blocks; b.full.answers[1]!.needsCheck = false;
    b.full.diagnosis[0]!.text = '근거에 없는 가상진단';
    b.full.sourceRefs = b.full.sourceRefs.filter((r) => r.itemId !== 'dx_im03_1');
    b.companion.easySummary[0]!.text = '근거 없는 문장';
    b.full.sourceRefs = b.full.sourceRefs.filter((r) => r.itemId !== 'es_im03_1');
  });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  const blocks = (await c.request('u_patient', `${c.base}?view=draft`)).json().record.blocks;
  expect(blocks.companion.easySummary[0]).toMatchObject({ text: null, needsCheck: true });
  expect(blocks.full.diagnosis[0]).toMatchObject({ text: null, needsCheck: true });
  expect(blocks.full.answers[1]).toMatchObject({ text: null, needsCheck: true });
});
it('does not treat a real source ID as proof of an invented diagnostic value', async () => {
  const c = await setup((result) => { (result.blocks as Blocks).full.labResults[0]!.value = '99.9'; });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  expect((await c.request('u_patient', `${c.base}?view=draft`)).json().record.blocks.full.labResults[0]).toMatchObject({ value: null, needsCheck: true });
});
it('isolates actual generation input and never sends private or other-department data', async () => {
  const c = await setup(); c.db.exec('CREATE TEMP TABLE private_notes(text TEXT)');
  c.db.prepare('INSERT INTO private_notes VALUES (?)').run('private-phase5-sentinel');
  expect(await c.structure()).toMatchObject({ status: 'succeeded' });
  expect(JSON.stringify(c.generate.mock.calls[0]![0].input)).not.toMatch(/v_os_01|ob_03|rx_os_01|가상록소정|private-phase5-sentinel/);
});
it('does not invent medication core values or schedule times from an otherwise valid source', async () => {
  const c = await setup((result) => { const b = result.blocks as Blocks; b.companion.medChanges[0]!.to = '저녁 9정'; b.schedule.nextSchedule[0]!.time = '23:59'; });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  const blocks = (await c.request('u_patient', `${c.base}?view=draft`)).json().record.blocks;
  expect(blocks.companion.medChanges[0]).toMatchObject({ to: null, needsCheck: true });
  expect(blocks.schedule.nextSchedule[0]).toMatchObject({ time: null, needsCheck: true });
});
it.each(['fixture', 'live'] as const)('uses identical pre-storage checks for injected %s responses without AWS calls', async (mode) => {
  const c = await setup((result) => { result.mode = mode; (result.blocks as Blocks).companion.easySummary[0]!.text = '추천합니다'; });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', mode, resultState: 'blocked' });
});
it('rolls back output and draft pointer if source rows change during generation even without a version bump', async () => {
  const c = await setup(() => { ctx!.db.prepare("UPDATE transcripts SET segments='[]' WHERE id='tr_phase5'").run(); });
  expect(await c.structure()).toMatchObject({ status: 'failed', errorCode: 'stale_input' });
  expect(c.db.prepare("SELECT recordDraftVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ recordDraftVersion: null });
  expect(c.db.prepare("SELECT count(*) n FROM block_sets WHERE visitId='v_im_03' AND section='record'").get()).toEqual({ n: 0 });
});
it('never exposes raw provider errors in job/error responses', async () => {
  ctx = await phase5({ async generate() { throw new Error('가상질환 K1 7.2% 내부 원문'); } });
  const result = await ctx.structure(); expect(result.status).toBe('failed');
  expect(JSON.stringify(result)).not.toMatch(/가상질환|7.2%|내부 원문/);
});
it.each(['start', 'stop'] as const)('keeps the specified %s medication null exception without a false missing-source issue', async (change) => {
  const c = await setup((result) => { const row = (result.blocks as Blocks).companion.medChanges[0]!; row.change = change; row[change === 'start' ? 'from' : 'to'] = null; });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  const record = (await c.request('u_patient', `${c.base}?view=draft`)).json().record;
  expect(record.blocks.companion.medChanges[0].needsCheck).toBe(false);
  expect(record.issues).toEqual([]);
});
it('does not accept a family question alone as proof of an answer', async () => {
  const c = await setup((result) => {
    const b = result.blocks as Blocks;
    b.full.sourceRefs = b.full.sourceRefs.filter((r) => r.itemId !== 'an_im03_1');
    b.full.sourceRefs.push({ itemId: 'an_im03_1', source: { type: 'question', questionId: 'q_01' }, quote: null });
  });
  expect(await c.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  expect((await c.request('u_patient', `${c.base}?view=draft`)).json().record.blocks.full.answers[0]).toMatchObject({ text: null, needsCheck: true });
});
it('stores no partial record, alerts or pointer if any block insert fails', async () => {
  const c = await setup();
  c.db.exec("CREATE TRIGGER fail_record_full BEFORE INSERT ON visit_blocks WHEN NEW.kind='full' BEGIN SELECT RAISE(ABORT,'test completion rollback'); END");
  expect(await c.structure()).toMatchObject({ status: 'failed', errorCode: 'internal' });
  expect(c.db.prepare("SELECT recordDraftVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ recordDraftVersion: null });
  expect(c.db.prepare("SELECT count(*) n FROM block_sets WHERE section='record' AND visitId='v_im_03'").get()).toEqual({ n: 0 });
  expect(c.db.prepare("SELECT count(*) n FROM alerts WHERE kind='record_vs_prescription'").get()).toEqual({ n: 0 });
});
it('rechecks current permission before record completion', async () => {
  const c = await setup(() => { ctx!.db.prepare("UPDATE members SET scope='schedule' WHERE userId='u_b'").run(); });
  expect(await c.structure()).toMatchObject({ status: 'failed' });
  expect(c.db.prepare("SELECT recordDraftVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ recordDraftVersion: null });
});
