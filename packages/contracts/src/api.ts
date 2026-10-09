import { z } from 'zod';
import { idSchema as id, dateTimeSchema, modeSchema, versionSchema, inputVersionSchema, roleSchema, scopeSchema, visitMetaSchema } from './core.js';
import { visitViewSchema, questionsCompanionSchema, questionsFullSchema, briefingCompanionSchema, briefingFullSchema, medFactSchema } from './blocks.js';

const author = z.strictObject({ userId: id, name: z.string() });
const completedState = z.enum(['ready', 'blocked']);
function completedBlocks(value: { state?: 'ready' | 'blocked' | undefined; blocks: { companion?: unknown; full?: unknown } }, ctx: z.RefinementCtx) {
  if ((value.blocks.full !== undefined) !== (value.state !== undefined)) ctx.addIssue({ code: 'custom', message: '전체 블록에는 완료 상태가 필요합니다.' });
  if (value.state === 'blocked' && value.blocks.companion !== undefined) ctx.addIssue({ code: 'custom', message: '보류된 낮은 블록은 공개할 수 없습니다.' });
  if (value.blocks.full === undefined && value.blocks.companion === undefined) ctx.addIssue({ code: 'custom', message: '완료 블록이 필요합니다.' });
}
export const mePatientsResponseSchema = z.strictObject({ self: z.strictObject({ patientId: id.nullable() }), linked: z.array(z.strictObject({ patientId: id, name: z.string() })) });
export const homeResponseSchema = z.strictObject({
  patient: z.strictObject({ id, name: z.string() }), me: z.strictObject({ role: roleSchema, canManageScopes: z.boolean() }), depts: z.array(z.string().min(1)),
  nextVisit: z.strictObject({ meta: visitMetaSchema, questionCount: inputVersionSchema.optional(), briefingReady: z.boolean().optional() }).nullable(),
  openAlertCount: inputVersionSchema.optional(), recent: z.array(visitViewSchema).max(5),
});
export const timelineResponseSchema = z.strictObject({ items: z.array(visitViewSchema) });
export const createQuestionRequestSchema = z.strictObject({ text: z.string().trim().min(1).max(200) });
export const createQuestionResponseSchema = z.strictObject({ id, questionsInputVersion: inputVersionSchema });
export const mergeQuestionsRequestSchema = z.strictObject({ inputVersion: inputVersionSchema });
export const generateBriefingRequestSchema = z.strictObject({ questionsVersion: versionSchema });
export const mergedQuestionsViewSchema = z.strictObject({ version: versionSchema, mode: modeSchema, stale: z.boolean(), state: completedState.optional(),
  blocks: z.strictObject({ companion: questionsCompanionSchema.optional(), full: questionsFullSchema.optional() }),
}).superRefine(completedBlocks);
export const questionsResponseSchema = z.strictObject({ originals: z.array(z.strictObject({ id, text: z.string(), author, createdAt: dateTimeSchema })),
  questionsInputVersion: inputVersionSchema, merged: mergedQuestionsViewSchema.optional(),
});
export const briefingResponseSchema = z.strictObject({ version: versionSchema, mode: modeSchema, stale: z.boolean(), state: completedState.optional(),
  blocks: z.strictObject({ companion: briefingCompanionSchema.optional(), full: briefingFullSchema.optional() }),
  questions: questionsCompanionSchema.shape.mergedQuestions,
}).superRefine(completedBlocks).superRefine((value, ctx) => {
  if (value.state === 'blocked' && value.questions.length) ctx.addIssue({ code: 'custom', message: '보류된 브리핑은 질문을 공개할 수 없습니다.' });
});
export const recordInputResponseSchema = z.strictObject({ recordInputVersion: inputVersionSchema, canUploadAudio: z.boolean() });
export const audioUploadResponseSchema = z.strictObject({ uploadId: id });
export const transcribeRequestSchema = z.strictObject({ uploadId: id });
export const noteRequestSchema = z.strictObject({ text: z.string().trim().min(1).max(2000) });
export const noteResponseSchema = z.strictObject({ noteId: id, recordInputVersion: inputVersionSchema });
export const structureRequestSchema = z.strictObject({ inputVersion: inputVersionSchema });
export const jobAcceptedResponseSchema = z.strictObject({ jobId: id });
export const shareRequestSchema = z.strictObject({ draftVersion: versionSchema, inputVersion: inputVersionSchema, idempotencyKey: z.uuid() });
export const shareResponseSchema = z.strictObject({ publishedVersion: versionSchema, sharedAt: dateTimeSchema, alreadyPublished: z.boolean() });
export const alertRefSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('observation'), id, quote: z.string(), fact: medFactSchema }),
  z.strictObject({ type: z.literal('prescription'), id, quote: z.string(), fact: medFactSchema }),
  z.strictObject({ type: z.literal('record'), visitId: id, version: versionSchema, itemId: id, quote: z.string().nullable(), fact: medFactSchema }),
]);
export const alertSchema = z.strictObject({ id, patientId: id, visitId: id, dept: z.string().min(1), kind: z.enum(['observation_vs_prescription', 'record_vs_prescription']),
  references: z.tuple([alertRefSchema, alertRefSchema]), differences: z.array(z.strictObject({ field: z.enum(['dose', 'timing']), left: z.string().nullable(), right: z.string().nullable() })),
  summary: z.string(), status: z.enum(['open', 'awaiting_confirmation', 'resolved']),
  history: z.array(z.strictObject({ action: z.enum(['detected', 'edit_note', 'reupload', 'confirm_hospital']), by: id.nullable(), at: dateTimeSchema, note: z.string().nullable() })),
});
export const alertsResponseSchema = z.strictObject({ alerts: z.array(alertSchema), canResolve: z.boolean() });
export const resolveRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('edit_note'), fact: medFactSchema, text: z.string().optional() }),
  z.strictObject({ action: z.literal('reupload'), note: z.string().optional() }),
  z.strictObject({ action: z.literal('confirm_hospital'), note: z.string().optional() }),
]);
export const resolveResponseSchema = z.strictObject({ alert: alertSchema });
export const memberSchema = z.strictObject({ userId: id, name: z.string(), relation: z.string(), role: roleSchema, scope: scopeSchema, active: z.boolean() });
export const membersResponseSchema = z.strictObject({ members: z.array(memberSchema) });
export const changeScopeRequestSchema = z.strictObject({ scope: scopeSchema });
export const changeScopeResponseSchema = z.strictObject({ member: memberSchema });
export const shareLogSchema = z.strictObject({ id, targetUserId: id.nullable(), actor: author, action: z.enum(['start', 'scope_change', 'stop', 'publish']),
  oldScope: scopeSchema.nullable(), newScope: scopeSchema.nullable(), visitId: id.nullable(), version: versionSchema.nullable(), at: dateTimeSchema,
});
export const shareLogsResponseSchema = z.strictObject({ logs: z.array(shareLogSchema) });
export const hospitalResponseSchema = z.strictObject({ id, name: z.string(), address: z.string(), phone: z.string(), mapImage: z.string(), floorImage: z.string(),
  guideSteps: z.array(z.strictObject({ order: z.number().int(), place: z.string(), floor: z.string() })),
  experiences: z.array(z.strictObject({ id, order: z.array(z.string()), waitBand: z.enum(['10분 이내', '30분', '1시간 이상']), tip: z.string() })), notice: z.string(),
});

export type MePatientsResponse = z.infer<typeof mePatientsResponseSchema>;
export type HomeResponse = z.infer<typeof homeResponseSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;
export type QuestionsResponse = z.infer<typeof questionsResponseSchema>;
export type BriefingResponse = z.infer<typeof briefingResponseSchema>;
export type RecordInputResponse = z.infer<typeof recordInputResponseSchema>;
export type ShareRequest = z.infer<typeof shareRequestSchema>;
export type ShareResponse = z.infer<typeof shareResponseSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type AlertsResponse = z.infer<typeof alertsResponseSchema>;
export type ResolveRequest = z.infer<typeof resolveRequestSchema>;
export type MembersResponse = z.infer<typeof membersResponseSchema>;
export type ShareLog = z.infer<typeof shareLogSchema>;
