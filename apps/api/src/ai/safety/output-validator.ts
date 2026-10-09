import { questionsBlocksSchema, briefingBlocksSchema, recordBlocksSchema, recordGeneratedBlocksSchema, alertRefSchema, type SourceRef, type ValidationIssue, type BlockKind } from '@baton/contracts';
import type { GenerationInput } from '../../adapters/sqlite/generation-repository.js';
import { ProviderError } from '../../adapters/ai/providers.js';
import { fullRestrictedValues, hasRestrictedValue, normalizeRestricted, stringValues } from './block-leak-check.js';

// One medical phrase list shared by registration and all generation validators.
const medicalJudgmentPhrases = ['가능성이 있', '으로 보입니다', '것 같습니다', '정상입니다', '정상 범위', '비정상', '권장합니다', '추천합니다'];
export const hasMedicalJudgment = (text: string) => medicalJudgmentPhrases.some((phrase) => normalizeRestricted(text).includes(normalizeRestricted(phrase)));
function disclosureRules(value: unknown, restricted: readonly string[]) {
  const values = stringValues(value);
  return (['restricted_value', 'medical_judgment'] as const).filter((rule) => values.some((text) => rule === 'restricted_value' ? hasRestrictedValue(text, restricted) : hasMedicalJudgment(text)));
}
const key = (source: SourceRef['source']) => JSON.stringify(source);
function sourceCatalog(input: GenerationInput) {
  const catalog = new Map<string, string[]>();
  for (const q of input.questions) catalog.set(key({ type: 'question', questionId: q.id }), [q.text]);
  if ('notes' in input) for (const n of input.notes) catalog.set(key({ type: 'note', noteId: n.id }), [n.text]);
  if ('transcript' in input && input.transcript) for (const segment of input.transcript.segments) catalog.set(key({ type: 'transcript', segmentId: segment.id }), [segment.text]);
  if ('prescriptions' in input) for (const p of input.prescriptions) catalog.set(key({ type: 'prescription', prescriptionId: p.id }), [p.text]);
  if ('records' in input && input.records) for (const record of input.records) {
    const blocks = recordBlocksSchema.parse(record.blocks);
    const items: Record<string, string[]> = {};
    function walk(value: unknown) {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== 'object') return;
      const row = value as Record<string, unknown>;
      if (typeof row.id === 'string') items[row.id] = Object.values(row).filter((v): v is string => typeof v === 'string');
      Object.values(row).forEach(walk);
    }
    walk({ schedule: blocks.schedule, companion: blocks.companion, full: blocks.full });
    for (const [id, texts] of Object.entries(items)) catalog.set(key({ type: 'record', visitId: record.visitId, version: record.version, itemId: id }), [
      ...texts, ...blocks.full.sourceRefs.filter((r) => r.itemId === id && r.quote !== null).map((r) => r.quote!),
    ]);
  }
  if ('observations' in input && input.observations) for (const o of input.observations) catalog.set(key({ type: 'observation', observationId: o.id }), [o.text]);
  if ('alerts' in input && input.alerts) for (const alert of input.alerts) for (const raw of alert.references) {
    const ref = alertRefSchema.parse(raw);
    if (ref.type === 'observation') catalog.set(key({ type: 'observation', observationId: ref.id }), [ref.quote]);
    if (ref.type === 'prescription') catalog.set(key({ type: 'prescription', prescriptionId: ref.id }), [ref.quote]);
  }
  return catalog;
}
function assertRefs(refs: SourceRef[], catalog: Map<string, string[]>) {
  for (const ref of refs) {
    const texts = catalog.get(key(ref.source));
    if (!texts || (ref.quote !== null && (!ref.quote.trim() || !texts.some((text) => normalizeRestricted(text).includes(normalizeRestricted(ref.quote!)))))) throw new ProviderError('validation_failed');
  }
}
/** Only Phase 3 sections. Schema, source identities/quotes, missing facts and disclosure checks run before storage. */
export function validatePrevisit(section: 'questions' | 'briefing', raw: unknown, input: GenerationInput, restricted: readonly string[]) {
  const parsed = (section === 'questions' ? questionsBlocksSchema : briefingBlocksSchema).safeParse(raw);
  if (!parsed.success) throw new ProviderError('validation_failed');
  const blocks = structuredClone(parsed.data);
  const refs = 'basisRefs' in blocks.full ? blocks.full.basisRefs : blocks.full.sourceRefs;
  const catalog = sourceCatalog(input);
  assertRefs(refs, catalog);
  const issues: ValidationIssue[] = [];
  let state: 'ready' | 'blocked' = 'ready';
  const add = (kind: 'companion' | 'full', id: string, rule: ValidationIssue['rule']) => {
    if (!issues.some((issue) => issue.blockKind === kind && issue.itemId === id && issue.rule === rule)) issues.push({ blockKind: kind, itemId: id, rule });
  };
  const restrictedValues = [...restricted, ...fullRestrictedValues(blocks.full)];
  function disclosure(value: unknown, id: string, row?: { needsCheck: boolean }) {
    for (const rule of disclosureRules(value, restrictedValues)) {
        if (row) row.needsCheck = true;
        state = 'blocked'; add('companion', id, rule);
    }
  }
  function item(row: { id: string; text: string | null; needsCheck: boolean }, kind: 'companion' | 'full') {
    const grounded = refs.some((ref) => ref.itemId === row.id);
    if (row.text === null || !grounded) {
      if (!row.needsCheck || (kind === 'full' && row.text !== null && !grounded)) add(kind, row.id, 'missing_source');
      row.needsCheck = true;
      if (kind === 'full' && !grounded) row.text = null;
    }
    if (kind === 'companion' && row.text !== null) {
      if (!grounded) throw new ProviderError('validation_failed'); // non-nullable public text cannot safely be invented
      disclosure(row, row.id, row);
      if (refs.some((ref) => {
        const source = ref.source;
        return ref.itemId === row.id && source.type === 'question' && input.questions.find((q) => q.id === source.questionId)?.visibility === 'full';
      })) {
        row.needsCheck = true; state = 'blocked'; add('companion', row.id, 'restricted_value');
      }
    }
  }
  if ('mergedQuestions' in blocks.companion) {
    const covered = new Set<string>();
    for (const q of blocks.companion.mergedQuestions) {
      if (q.addedByAI ? q.fromQuestionIds.length !== 0 : q.fromQuestionIds.length === 0) throw new ProviderError('validation_failed');
      for (const id of q.fromQuestionIds) {
        const original = input.questions.find((question) => question.id === id);
        if (!original || covered.has(id)) throw new ProviderError('validation_failed');
        if (!refs.some((ref) => ref.itemId === q.id && ref.source.type === 'question' && ref.source.questionId === id)) throw new ProviderError('validation_failed');
        covered.add(id);
        if (original.visibility !== 'companion') { q.needsCheck = true; state = 'blocked'; add('companion', q.id, 'restricted_value'); }
      }
      item(q, 'companion');
    }
    if (input.questions.some((q) => q.visibility === 'companion' && !covered.has(q.id))) throw new ProviderError('validation_failed');
  } else if ('briefing' in blocks.full) {
    const merged = 'merged' in input && input.merged ? questionsBlocksSchema.parse(input.merged) : null;
    const ids = blocks.companion.briefing.questions;
    // IDs and arrays are public string values too, not only text properties.
    for (const id of ids) disclosure(id, id);
    if (!merged || new Set(ids).size !== ids.length || ids.some((id) => !merged.companion.mergedQuestions.some((q) => q.id === id))) throw new ProviderError('validation_failed');
    for (const row of blocks.companion.briefing.changes) {
      item(row, 'companion');
      if ('alerts' in input && input.alerts?.some((alert) => refs.some((ref) => ref.itemId === row.id && alert.references.some((raw: unknown) => {
        const source = alertRefSchema.parse(raw);
        return source.type === 'observation' && ref.source.type === 'observation' && source.id === ref.source.observationId || source.type === 'prescription' && ref.source.type === 'prescription' && source.id === ref.source.prescriptionId;
      })))) row.needsCheck = true;
    }
    const changeIds = new Set(blocks.companion.briefing.changes.map((row) => row.id));
    for (const reason of blocks.full.briefing.changeReasons) if (!changeIds.has(reason.changeId)) throw new ProviderError('validation_failed');
    for (const rows of Object.values(blocks.full.briefing)) for (const row of rows) item(row, 'full');
  }
  // A fabricated reference target cannot make an unrelated item appear grounded.
  const itemIds = new Set<string>();
  function collect(value: unknown) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object') return;
    const row = value as Record<string, unknown>;
    if (typeof row.id === 'string') itemIds.add(row.id);
    Object.values(row).forEach(collect);
  }
  collect(blocks);
  if (refs.some((ref) => !itemIds.has(ref.itemId))) throw new ProviderError('validation_failed');
  return { blocks, state, issues };
}

/** Record only: deterministic provenance/anchor checks are not semantic entailment guarantees. */
export function validateRecord(raw: unknown, input: GenerationInput, restricted: readonly string[]) {
  const parsed = recordGeneratedBlocksSchema.safeParse(raw);
  if (!parsed.success || !('notes' in input)) throw new ProviderError('validation_failed');
  const blocks = structuredClone(parsed.data), refs = blocks.full.sourceRefs, catalog = sourceCatalog(input);
  assertRefs(refs, catalog);
  const items = [...blocks.schedule.nextSchedule, ...blocks.companion.medChanges, ...blocks.companion.easySummary,
    ...blocks.full.diagnosis, ...blocks.full.labResults, ...blocks.full.doctorExplanation, ...blocks.full.medReasons, ...blocks.full.answers];
  const ids = new Set(items.map((r) => r.id)), medIds = new Set(blocks.companion.medChanges.map((r) => r.id));
  const mergedIds = new Set(input.merged ? questionsBlocksSchema.parse(input.merged).companion.mergedQuestions.map((r) => r.id) : []);
  if (refs.some((r) => !ids.has(r.itemId)) || blocks.full.medReasons.some((r) => !medIds.has(r.medChangeId)) ||
    blocks.full.medDetails.some((r) => !medIds.has(r.medChangeId)) || new Set(blocks.full.medDetails.map((r) => r.medChangeId)).size !== blocks.full.medDetails.length ||
    blocks.full.answers.some((r) => !mergedIds.has(r.questionId)) || new Set(blocks.full.answers.map((r) => r.questionId)).size !== blocks.full.answers.length ||
    blocks.full.needsCheckDetails.some((r) => !ids.has(r.itemId) || r.alertId !== null)) throw new ProviderError('validation_failed');
  const issues: ValidationIssue[] = [];
  let state: 'ready' | 'blocked' = 'ready';
  const add = (blockKind: BlockKind, itemId: string, rule: ValidationIssue['rule']) => {
    if (!issues.some((r) => r.blockKind === blockKind && r.itemId === itemId && r.rule === rule)) issues.push({ blockKind, itemId, rule });
  };
  const missing = (row: { id: string; needsCheck: boolean }, kind: BlockKind, changed: boolean) => {
    if (!row.needsCheck || changed) add(kind, row.id, 'missing_source');
    row.needsCheck = true;
  };
  // A family question is context, not proof of an answer or a clinical fact.
  const evidence = (id: string) => refs.filter((r) => r.itemId === id && r.source.type !== 'question').flatMap((r) => catalog.get(key(r.source)) ?? []);
  const values = [...restricted, ...fullRestrictedValues(blocks.full)];
  for (const [kind, rows] of [['schedule', blocks.schedule.nextSchedule], ['companion', [...blocks.companion.medChanges, ...blocks.companion.easySummary]]] as const) {
    for (const row of rows) for (const rule of disclosureRules(row, values)) { row.needsCheck = true; state = 'blocked'; add(kind, row.id, rule); }
  }
  const normalizedEvidence = (id: string) => evidence(id).map(normalizeRestricted).join('\n');
  const doseText = (s: string) => normalizeRestricted(s).replace(/반(?:알|정)/gu, '0.5정').replace(/한(?:알|정)/gu, '1정').replace(/알/gu, '정');
  const doseIn = (text: string, dose: string) => new RegExp(`(?<![\\d.])${dose.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d.])`, 'u').test(text);
  for (const row of blocks.schedule.nextSchedule) {
    if (row.dept !== null && row.dept !== input.dept) throw new ProviderError('validation_failed');
    const texts = normalizedEvidence(row.id);
    if (row.date !== null) {
      const [, month, day] = row.date.split('-');
      if (!texts.includes(row.date) && !texts.includes(`${Number(month)}월${Number(day)}일`)) { row.date = null; row.time = null; missing(row, 'schedule', true); }
    }
    if (row.date === null) missing(row, 'schedule', false);
    if (row.time !== null) {
      const [h, m] = row.time.split(':').map(Number);
      const korean = `${h! < 12 ? '오전' : '오후'}${h! % 12 || 12}시${m ? `${m}분` : ''}`;
      if (!texts.includes(row.time) && !texts.includes(korean)) { row.time = null; missing(row, 'schedule', true); }
    }
  }
  for (const row of [...blocks.companion.easySummary, ...blocks.full.diagnosis, ...blocks.full.doctorExplanation, ...blocks.full.medReasons, ...blocks.full.answers]) {
    const kind = blocks.companion.easySummary.includes(row) ? 'companion' : 'full';
    if (row.text !== null && evidence(row.id).length === 0) { row.text = null; missing(row, kind, true); }
    if (row.text === null) missing(row, kind, false);
  }
  for (const row of blocks.full.diagnosis) {
    if (row.text !== null && !normalizedEvidence(row.id).includes(normalizeRestricted(row.text))) { row.text = null; missing(row, 'full', true); }
  }
  for (const row of blocks.full.labResults) {
    const text = normalizedEvidence(row.id).replace(/퍼센트/gu, '%');
    const value = row.value === null ? null : normalizeRestricted(row.value + (row.unit ?? ''));
    const escaped = value?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (value !== null && (!text.includes(normalizeRestricted(row.name)) || !new RegExp(`(?<![\\d.])${escaped}(?![\\d.])`, 'u').test(text))) { row.value = null; missing(row, 'full', true); }
    if (row.value === null) missing(row, 'full', false);
  }
  for (const row of blocks.companion.medChanges) {
    if (evidence(row.id).length === 0) { const changed = row.from !== null || row.to !== null; row.from = null; row.to = null; row.caution = null; missing(row, 'companion', changed); }
    const text = doseText(evidence(row.id).join('\n'));
    for (const field of ['from', 'to'] as const) {
      if (row[field] === null) continue;
      const value = doseText(row[field]), doses = value.match(/\d+(?:\.\d+)?(?:정|mg|ml)/gu) ?? [];
      const times = value.match(/아침|점심|저녁|취침/gu) ?? [];
      if ((!doses.length && !text.includes(value)) || doses.some((d) => !doseIn(text, d)) || times.some((t) => !text.includes(t))) { row[field] = null; missing(row, 'companion', true); }
    }
    if ((row.from === null && row.change !== 'start') || (row.to === null && row.change !== 'stop')) missing(row, 'companion', false);
  }
  // The comparison keys/facts must be attached to a real medication item and actual evidence.
  const timingText = { morning: '아침', lunch: '점심', evening: '저녁', bedtime: '취침' };
  for (const detail of blocks.full.medDetails) {
    const row = blocks.companion.medChanges.find((r) => r.id === detail.medChangeId)!;
    const text = doseText(evidence(row.id).join('\n'));
    const known = input.prescriptions.flatMap((p) => p.items).find((p) => p.drugKey === detail.drugKey);
    if (row.drug !== detail.drugName || (known ? known.drugName !== detail.drugName : !text.includes(normalizeRestricted(detail.drugName)))) throw new ProviderError('validation_failed');
    if (detail.dose !== null && !doseIn(text, doseText(detail.dose))) { detail.dose = null; missing(row, 'companion', true); }
    if (detail.timing !== null && !detail.timing.every((t) => text.includes(timingText[t]))) { detail.timing = null; missing(row, 'companion', true); }
    if (detail.dose === null || detail.timing === null) missing(row, 'companion', false);
  }
  // Persist a strict generated schema once more after corrections; transcript is server-owned.
  recordGeneratedBlocksSchema.parse(blocks);
  return { blocks, state, issues };
}
