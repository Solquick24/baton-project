import type { FastifyInstance } from 'fastify';
import { mergeQuestionsRequestSchema } from '@baton/contracts';
import { authenticate } from '../auth/session.js';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import type { JobsService } from '../modules/jobs/service.js';
import { createQuestion, listQuestions, mergeQuestions } from '../modules/questions/service.js';

export function registerQuestions(app: FastifyInstance, db: BatonDatabase, jobs: JobsService) {
  const base = '/api/patients/:pid/visits/:vid/questions';
  app.get<{ Params: { pid: string; vid: string } }>(base, async (req) => listQuestions(db, await authenticate(req, db), req.params.pid, req.params.vid));
  app.post<{ Params: { pid: string; vid: string } }>(base, async (req, reply) => reply.code(201).send(createQuestion(db, await authenticate(req, db), req.params.pid, req.params.vid, req.body)));
  app.post<{ Params: { pid: string; vid: string } }>(`${base}/merge`, async (req, reply) => {
    const userId = await authenticate(req, db), input = mergeQuestionsRequestSchema.parse(req.body);
    return reply.code(202).send(mergeQuestions(jobs, userId, req.params.pid, req.params.vid, input.inputVersion));
  });
}
