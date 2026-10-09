import { questionsBlocksSchema, briefingBlocksSchema, recordBlocksSchema, alertRefSchema, type SourceRef, type ValidationIssue } from '@baton/contracts';
import type { GenerationInput } from '../../adapters/sqlite/generation-repository.js';
import { ProviderError } from '../../adapters/ai/providers.js';
import { fullRestrictedValues, hasRestrictedValue, normalizeRestricted } from './block-leak-check.js';

// Shared with question registration. Record validation remains T041, outside this implementation.
const medicalJudgmentPhrases = ['가능성이 있', '으로 보입니다', '것 같습니다', '정상입니다', '정상 범위', '비정상', '권장합니다', '추천합니다'];
export const hasMedicalJudgment = (text: string) => medicalJudgmentPhrases.some((phrase) => normalizeRestricted(text).includes(normalizeRestricted(phrase)));
const key = (source: SourceRef['source']) => JSON.stringify(source);
function sourceCatalog(input: GenerationInput) {
  const catalog = new Map<string, string[]>();
  for (const q of input.questions) catalog.set(key({ type: 'question', questionId: q.id }), [q.text]);
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
/** Only Phase 3 sections. Schema, source identities/quotes, missing facts and disclosure checks run before storage. */
export function validatePrevisit(section: 'questions' | 'briefing', raw: unknown, input: GenerationInput, restricted: readonly string[]) {
  const parsed = (section === 'questions' ? questionsBlocksSchema : briefingBlocksSchema).safeParse(raw);
  if (!parsed.success) throw new ProviderError('validation_failed');
  const blocks = structuredClone(parsed.data);
  const refs = 'basisRefs' in blocks.full ? blocks.full.basisRefs : blocks.full.sourceRefs;
  const catalog = sourceCatalog(input);
  for (const ref of refs) {
    const texts = catalog.get(key(ref.source));
    if (!texts || (ref.quote !== null && (!ref.quote.trim() || !texts.some((text) => normalizeRestricted(text).includes(normalizeRestricted(ref.quote!)))))) throw new ProviderError('validation_failed');
  }
  const issues: ValidationIssue[] = [];
  let state: 'ready' | 'blocked' = 'ready';
  const add = (kind: 'companion' | 'full', id: string, rule: ValidationIssue['rule']) => {
    if (!issues.some((issue) => issue.blockKind === kind && issue.itemId === id && issue.rule === rule)) issues.push({ blockKind: kind, itemId: id, rule });
  };
  const restrictedValues = [...restricted, ...fullRestrictedValues(blocks.full)];
  function strings(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  }
  function disclosure(value: unknown, id: string, row?: { needsCheck: boolean }) {
    const values = strings(value);
    for (const rule of ['restricted_value', 'medical_judgment'] as const) {
      if (values.some((text) => rule === 'restricted_value' ? hasRestrictedValue(text, restrictedValues) : hasMedicalJudgment(text))) {
        if (row) row.needsCheck = true;
        state = 'blocked'; add('companion', id, rule);
      }
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
