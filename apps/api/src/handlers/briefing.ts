import type { FastifyInstance } from 'fastify';
import { generateBriefingRequestSchema } from '@baton/contracts';
import { authenticate } from '../auth/session.js';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import type { JobsService } from '../modules/jobs/service.js';
import { readBriefing, requestBriefing } from '../modules/briefing/service.js';
export function registerBriefing(app: FastifyInstance, db: BatonDatabase, jobs: JobsService) {
  const path = '/api/patients/:pid/visits/:vid/briefing';
  app.get<{ Params: { pid: string; vid: string } }>(path, async (req) => readBriefing(db, await authenticate(req, db), req.params.pid, req.params.vid));
  app.post<{ Params: { pid: string; vid: string } }>(path, async (req, reply) => {
    const userId = await authenticate(req, db), input = generateBriefingRequestSchema.parse(req.body);
    return reply.code(202).send(requestBriefing(jobs, userId, req.params.pid, req.params.vid, input.questionsVersion));
  });
}
