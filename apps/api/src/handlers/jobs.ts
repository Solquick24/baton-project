import type { FastifyInstance } from 'fastify';
import { idSchema } from '@baton/contracts';
import { authenticate } from '../auth/session.js';
import type { JobsService } from '../modules/jobs/service.js';

export function registerJobs(app: FastifyInstance, jobs: JobsService) {
  app.get<{ Params: { jobId: string } }>('/api/jobs/:jobId', async (request) => {
    return jobs.get(await authenticate(request, jobs.db), idSchema.parse(request.params.jobId));
  });
}
