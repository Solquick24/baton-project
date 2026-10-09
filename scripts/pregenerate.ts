import type { BatonDatabase } from '../apps/api/src/adapters/sqlite/database.js';
import { validatedLLM } from '../apps/api/src/adapters/ai/providers.js';
import { FixtureLLM } from '../apps/api/src/adapters/ai/fixture.js';
import { previsitHandlers } from '../apps/api/src/ai/pipelines/index.js';
import { JobsService } from '../apps/api/src/modules/jobs/service.js';
import { JobRunner } from '../apps/api/src/workers/runner.js';
import { requestBriefing } from '../apps/api/src/modules/briefing/service.js';
import { visitContext } from '../apps/api/src/adapters/sqlite/previsit-repository.js';

/** Real fixture provider -> normal worker -> safety validation -> atomic result/job storage. */
export async function pregenerateDatabase(db: BatonDatabase, fixturesDir: string) {
  const llm = validatedLLM(new FixtureLLM(fixturesDir)), jobs = new JobsService(db);
  const runner = new JobRunner(jobs, previsitHandlers(db, llm));
  async function finish(id: string) {
    while (jobs.get('u_b', id).status === 'queued' || jobs.get('u_b', id).status === 'running') {
      if (!await runner.runNext()) throw new Error('Pregeneration worker stopped');
    }
    const job = jobs.get('u_b', id);
    if (job.status !== 'succeeded' || job.resultState !== 'ready' || job.mode !== 'fixture') throw new Error('Pregeneration validation failed');
    return job.resultVersion!;
  }
  try {
    const visit = visitContext(db, 'p_01', 'v_im_03');
    const questionsVersion = await finish(jobs.enqueue('u_b', 'p_01', 'v_im_03', 'merge_questions', visit.questionsInputVersion).jobId);
    const briefingVersion = await finish(requestBriefing(jobs, 'u_b', 'p_01', 'v_im_03', questionsVersion).jobId);
    return { questionsVersion, briefingVersion, mode: 'fixture' as const };
  } finally { await runner.stop(); }
}
