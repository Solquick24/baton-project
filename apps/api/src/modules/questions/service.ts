import { randomUUID } from 'node:crypto';
import { createQuestionRequestSchema, createQuestionResponseSchema, questionsResponseSchema, jobAcceptedResponseSchema } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { requireMembership, assertAction } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { visitContext, readPrevisitSet } from '../../adapters/sqlite/previsit-repository.js';
import { patientRestrictedValues, hasRestrictedValue } from '../../ai/safety/block-leak-check.js';
import { hasMedicalJudgment } from '../../ai/safety/output-validator.js';
import { assembleQuestionsBlocks, stored } from '../../shared/response-assembler.js';
import type { JobsService } from '../jobs/service.js';

export function createQuestion(db: BatonDatabase, userId: string, patientId: string, visitId: string, body: unknown) {
  assertAction(requireMembership(db, userId, patientId), 'write_questions');
  const { text } = createQuestionRequestSchema.parse(body);
  return db.transaction(() => {
    const visit = visitContext(db, patientId, visitId);
    const visibility = hasRestrictedValue(text, patientRestrictedValues(db, patientId)) || hasMedicalJudgment(text) ? 'full' : 'companion';
    const id = randomUUID();
    db.prepare('INSERT INTO questions (id,patientId,visitId,authorId,text,visibility,createdAt) VALUES (?,?,?,?,?,?,?)').run(id, patientId, visitId, userId, text, visibility, new Date().toISOString());
    db.prepare('UPDATE visits SET questionsInputVersion=questionsInputVersion+1 WHERE id=? AND patientId=?').run(visitId, patientId);
    return createQuestionResponseSchema.parse({ id, questionsInputVersion: visit.questionsInputVersion + 1 });
  })();
}
export function listQuestions(db: BatonDatabase, userId: string, patientId: string, visitId: string) {
  const member = requireMembership(db, userId, patientId); assertAction(member, 'read_questions');
  const full = allowedKinds(member.scope).includes('full'), visit = visitContext(db, patientId, visitId);
  const rows = db.prepare(`SELECT q.id,q.text,q.authorId,u.name,q.createdAt FROM questions q JOIN users u ON u.id=q.authorId WHERE q.patientId=? AND q.visitId=? ${full ? '' : "AND q.visibility='companion'"} ORDER BY q.createdAt,q.id`).all(patientId, visitId) as Array<{ id: string; text: string; authorId: string; name: string; createdAt: string }>;
  const set = readPrevisitSet(db, userId, patientId, visitId, 'questions', visit.questionsVersion);
  const merged = set ? { version: set.version, mode: set.mode, stale: set.inputVersion !== visit.questionsInputVersion,
    ...(full ? { state: set.state } : {}), blocks: assembleQuestionsBlocks(set.rows),
  } : undefined;
  if (merged?.blocks.companion?.mergedQuestions.some((q) => q.fromQuestionIds.some((id) => !rows.some((row) => row.id === id)))) throw new Error('Invalid public question reference');
  return stored(questionsResponseSchema, { originals: rows.map((q) => ({ id: q.id, text: q.text, author: { userId: q.authorId, name: q.name }, createdAt: q.createdAt })),
    questionsInputVersion: visit.questionsInputVersion, ...(merged ? { merged } : {}),
  });
}
export function mergeQuestions(jobs: JobsService, userId: string, patientId: string, visitId: string, inputVersion: number) {
  return jobAcceptedResponseSchema.parse(jobs.enqueue(userId, patientId, visitId, 'merge_questions', inputVersion));
}
