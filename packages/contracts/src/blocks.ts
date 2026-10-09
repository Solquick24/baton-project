import { z } from 'zod';
import { idSchema as id, dateSchema, dateTimeSchema, timeSchema, modeSchema, versionSchema, inputVersionSchema, blockKindSchema, visitMetaSchema } from './core.js';

const str = z.string();
function uniqueIds(value: unknown, ctx: z.RefinementCtx) {
  const ids = new Set<string>();
  function walk(node: unknown) {
    if (Array.isArray(node)) { for (const item of node) walk(item); return; }
    if (!node || typeof node !== 'object') return;
    const row = node as Record<string, unknown>;
    if (typeof row.id === 'string') {
      if (ids.has(row.id)) ctx.addIssue({ code: 'custom', message: '한 세트의 항목 ID는 유일해야 합니다.' });
      ids.add(row.id);
    }
    for (const child of Object.values(row)) walk(child);
  }
  walk(value);
}
const textItem = z.strictObject({ id, text: str.nullable(), needsCheck: z.boolean() });
export const medFactSchema = z.strictObject({ drugKey: str.regex(/^[a-z][a-z0-9_]*$/), drugName: str.min(1), dose: str.nullable(), timing: z.array(z.enum(['morning', 'lunch', 'evening', 'bedtime'])).nullable() });
export const sourceRefSchema = z.strictObject({ itemId: id, source: z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('transcript'), segmentId: id }),
  z.strictObject({ type: z.literal('note'), noteId: id }),
  z.strictObject({ type: z.literal('prescription'), prescriptionId: id }),
  z.strictObject({ type: z.literal('observation'), observationId: id }),
  z.strictObject({ type: z.literal('question'), questionId: id }),
  z.strictObject({ type: z.literal('record'), visitId: id, version: versionSchema, itemId: id }),
]), quote: str.nullable() });
export const transcriptSchema = z.strictObject({ transcriptId: id, uploadId: id.nullable(), mode: modeSchema,
  segments: z.array(z.strictObject({ id, startMs: z.number().nonnegative().nullable(), endMs: z.number().nonnegative().nullable(), speaker: str.nullable(), text: str })),
});
export const questionsScheduleSchema = z.strictObject({});
export const questionsCompanionSchema = z.strictObject({ mergedQuestions: z.array(z.strictObject({
  id, text: str.min(1), fromQuestionIds: z.array(id), addedByAI: z.boolean(), needsCheck: z.boolean(),
})) });
export const questionsFullSchema = z.strictObject({ basisRefs: z.array(sourceRefSchema) });
export const briefingScheduleSchema = z.strictObject({});
export const briefingCompanionSchema = z.strictObject({ briefing: z.strictObject({ changes: z.array(textItem.extend({ text: str })), questions: z.array(id) }) });
export const briefingFullSchema = z.strictObject({ briefing: z.strictObject({
  changeReasons: z.array(textItem.extend({ changeId: id })), watch: z.array(textItem), tests: z.array(textItem), prep: z.array(textItem.extend({ label: str })),
}), sourceRefs: z.array(sourceRefSchema) });
export const recordScheduleSchema = z.strictObject({ nextSchedule: z.array(z.strictObject({ id,
  date: dateSchema.nullable(), time: timeSchema.nullable(), dept: str.nullable(), hospital: str.nullable(), needsCheck: z.boolean(),
})) });
export const recordCompanionSchema = z.strictObject({ medChanges: z.array(z.strictObject({ id, drug: str, change: z.enum(['start', 'stop', 'dose', 'timing', 'keep']), from: str.nullable(), to: str.nullable(), caution: str.nullable(), needsCheck: z.boolean() })), easySummary: z.array(textItem) });
export const recordGeneratedFullSchema = z.strictObject({
  diagnosis: z.array(textItem), labResults: z.array(z.strictObject({ id, name: str, value: str.nullable(), unit: str.nullable(), needsCheck: z.boolean() })),
  doctorExplanation: z.array(textItem), medReasons: z.array(textItem.extend({ medChangeId: id })),
  medDetails: z.array(medFactSchema.extend({ medChangeId: id })), answers: z.array(textItem.extend({ questionId: id })),
  needsCheckDetails: z.array(z.strictObject({ itemId: id, reason: z.enum(['no_source', 'low_confidence', 'conflict', 'restricted_value', 'medical_judgment']), alertId: id.nullable() })),
  sourceRefs: z.array(sourceRefSchema),
});
export const recordFullSchema = recordGeneratedFullSchema.extend({ transcript: transcriptSchema.nullable() });
export const questionsBlocksSchema = z.strictObject({ schedule: questionsScheduleSchema, companion: questionsCompanionSchema, full: questionsFullSchema }).superRefine(uniqueIds).superRefine((blocks, ctx) => {
  for (const q of blocks.companion.mergedQuestions) {
    if (q.addedByAI && !blocks.full.basisRefs.some((ref) => ref.itemId === q.id)) ctx.addIssue({ code: 'custom', message: 'AI 추가 질문의 근거가 필요합니다.' });
  }
});
export const briefingBlocksSchema = z.strictObject({ schedule: briefingScheduleSchema, companion: briefingCompanionSchema, full: briefingFullSchema }).superRefine(uniqueIds);
export const recordGeneratedBlocksSchema = z.strictObject({ schedule: recordScheduleSchema, companion: recordCompanionSchema, full: recordGeneratedFullSchema }).superRefine(uniqueIds);
export const recordBlocksSchema = z.strictObject({ schedule: recordScheduleSchema, companion: recordCompanionSchema, full: recordFullSchema }).superRefine(uniqueIds);
export const validationIssueSchema = z.strictObject({ blockKind: blockKindSchema, itemId: id, rule: z.enum(['schema', 'missing_source', 'restricted_value', 'medical_judgment']) });
export const visitViewSchema = z.strictObject({ meta: visitMetaSchema, record: z.strictObject({
  view: z.enum(['published', 'draft']), version: versionSchema, mode: modeSchema,
  state: z.enum(['generating', 'ready', 'blocked', 'failed']).optional(), shareable: z.boolean().optional(), issues: z.array(validationIssueSchema).optional(),
  blocks: z.strictObject({ schedule: recordScheduleSchema.optional(), companion: recordCompanionSchema.optional(), full: recordFullSchema.optional() }),
}).optional() });
export const seedRecordSchema = z.strictObject({ visitId: id, section: z.literal('record'), version: versionSchema, inputVersion: inputVersionSchema,
  state: z.literal('ready'), mode: z.literal('fixture'), createdBy: id, createdAt: dateTimeSchema, publishedAt: dateTimeSchema,
  issues: z.array(validationIssueSchema), blocks: recordBlocksSchema,
});
export type RecordBlocks = z.infer<typeof recordBlocksSchema>;
export type VisitView = z.infer<typeof visitViewSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type MedFact = z.infer<typeof medFactSchema>;
