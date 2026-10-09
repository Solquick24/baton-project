import { briefingResponseSchema, questionsCompanionSchema, jobAcceptedResponseSchema } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { visitContext, readPrevisitSet } from '../../adapters/sqlite/previsit-repository.js';
import { requireMembership, assertAction } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { assembleBriefingBlocks, assembleQuestionsBlocks, stored } from '../../shared/response-assembler.js';
import { ApiError } from '../../shared/errors.js';
import type { JobsService } from '../jobs/service.js';

export function requestBriefing(jobs: JobsService, userId: string, patientId: string, visitId: string, questionsVersion: number) {
  assertAction(requireMembership(jobs.db, userId, patientId), 'generate');
  const visit = visitContext(jobs.db, patientId, visitId);
  if (visit.questionsVersion === null) throw new ApiError('conflict', 'not_ready');
  if (visit.questionsVersion !== questionsVersion) throw new ApiError('conflict', 'stale_input');
  const set = jobs.db.prepare("SELECT state FROM block_sets WHERE patientId=? AND visitId=? AND section='questions' AND version=?").get(patientId, visitId, questionsVersion) as { state: string } | undefined;
  if (set?.state !== 'ready') throw new ApiError('conflict', 'not_ready');
  return jobAcceptedResponseSchema.parse(jobs.enqueue(userId, patientId, visitId, 'briefing', questionsVersion));
}
export function readBriefing(db: BatonDatabase, userId: string, patientId: string, visitId: string) {
  const member = requireMembership(db, userId, patientId); assertAction(member, 'read_briefing');
  const full = allowedKinds(member.scope).includes('full'), visit = visitContext(db, patientId, visitId);
  const set = readPrevisitSet(db, userId, patientId, visitId, 'briefing', visit.briefingVersion);
  if (!set) throw new ApiError('not_found');
  const blocks = assembleBriefingBlocks(set.rows);
  let questions: typeof questionsCompanionSchema._output.mergedQuestions = [];
  if (set.state === 'ready') {
    // The briefing refers to its saved questions version, including when the latest merge changed.
    const merged = readPrevisitSet(db, userId, patientId, visitId, 'questions', set.inputVersion);
    if (!merged || merged.state !== 'ready') throw new Error('Missing briefing questions');
    const mergedBlocks = assembleQuestionsBlocks(merged.rows);
    const ids = blocks.companion?.briefing.questions;
    if (!ids || !mergedBlocks.companion) throw new Error('Missing briefing question ids');
    questions = ids.map((id) => {
      const q = mergedBlocks.companion!.mergedQuestions.find((question) => question.id === id);
      if (!q) throw new Error('Invalid briefing question id');
      return q;
    });
  }
  return stored(briefingResponseSchema, { version: set.version, mode: set.mode, stale: set.inputVersion !== visit.questionsVersion,
    ...(full ? { state: set.state } : {}), blocks, questions,
  });
}
