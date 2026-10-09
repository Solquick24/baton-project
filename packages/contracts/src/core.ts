import { z } from 'zod';

export const idSchema = z.string().min(1).max(200);
export const dateSchema = z.iso.date();
export const dateTimeSchema = z.iso.datetime({ offset: true });
export const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const scopeSchema = z.enum(['schedule', 'companion', 'full']);
export const blockKindSchema = scopeSchema;
export const roleSchema = z.enum(['patient', 'lead', 'guardian']);
export const modeSchema = z.enum(['live', 'fixture']);
export const sectionSchema = z.enum(['questions', 'briefing', 'record']);
export const blockSetStateSchema = z.enum(['generating', 'ready', 'blocked', 'failed']);
export const versionSchema = z.number().int().positive();
export const inputVersionSchema = z.number().int().nonnegative();
export const visitMetaSchema = z.strictObject({
  id: idSchema, patientId: idSchema, date: dateSchema, time: timeSchema.nullable(), dept: z.string().min(1),
  hospital: z.strictObject({ id: idSchema, name: z.string().min(1) }),
  companion: z.strictObject({ userId: idSchema, name: z.string().min(1) }).nullable(),
  status: z.enum(['upcoming', 'done']),
});
export const loginRequestSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(1).max(256) });
export const loginResponseSchema = z.strictObject({ accessToken: z.string().min(1), user: z.strictObject({ id: idSchema, name: z.string() }) });
export const errorCodeSchema = z.enum(['unauthorized', 'forbidden', 'not_found', 'bad_request', 'conflict', 'upstream_error']);
export const errorReasonSchema = z.enum(['stale_input', 'blocked', 'not_ready', 'not_author', 'recording_not_allowed']);
export const errorResponseSchema = z.strictObject({ error: z.strictObject({
  code: errorCodeSchema, reason: errorReasonSchema.optional(), message: z.string(), requestId: z.string(),
}) });
export const jobKindSchema = z.enum(['transcribe', 'merge_questions', 'briefing', 'structure']);
export const jobErrorSchema = z.enum(['ai_unavailable', 'stt_unavailable', 'validation_failed', 'stale_input', 'internal']);
export const jobSchema = z.strictObject({
  id: idSchema, kind: jobKindSchema, visitId: idSchema,
  status: z.enum(['queued', 'running', 'succeeded', 'failed']), attempt: versionSchema,
  mode: modeSchema.nullable(), resultVersion: versionSchema.nullable(),
  resultState: z.enum(['ready', 'blocked']).nullable(), errorCode: jobErrorSchema.nullable(),
  createdAt: dateTimeSchema, updatedAt: dateTimeSchema,
});
export type Scope = z.infer<typeof scopeSchema>;
export type BlockKind = Scope;
export type Role = z.infer<typeof roleSchema>;
export type Mode = z.infer<typeof modeSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type VisitMeta = z.infer<typeof visitMetaSchema>;
export type Job = z.infer<typeof jobSchema>;
export type JobKind = z.infer<typeof jobKindSchema>;
export type JobError = z.infer<typeof jobErrorSchema>;
