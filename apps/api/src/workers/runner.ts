import type { JobKind } from '@baton/contracts';
import { JobsService, type JobCompletion, type StoredJob } from '../modules/jobs/service.js';
import { ProviderError, safeFailureStage, type FailureStage } from '../adapters/ai/providers.js';
import { ApiError } from '../shared/errors.js';

export type JobHandlers = Partial<Record<JobKind, (job: StoredJob) => Promise<JobCompletion>>>;
export class JobRunner {
  private active: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(readonly service: JobsService, private readonly handlers: JobHandlers = {},
    private readonly onFailure?: (event: { event: 'ai_job_failed'; kind: JobKind; code: string; stage: FailureStage }) => void) {}
  async runNext(): Promise<boolean> {
    if (this.active) return false;
    const run = async () => {
      const job = this.service.claim();
      if (!job) return false;
      try {
        this.service.assertRunnable(job);
        const handler = this.handlers[job.kind];
        if (!handler) throw new Error('Pipeline not implemented');
        this.service.complete(job, await handler(job));
      } catch (error) {
        const code = error instanceof ProviderError ? error.code : error instanceof ApiError && error.reason === 'stale_input' ? 'stale_input' : 'internal';
        this.service.fail(job.id, code);
        // Fixed enums only: no exception, IDs, prompt, quotes, payload, or credentials.
        this.onFailure?.({ event: 'ai_job_failed', kind: job.kind, code, stage: safeFailureStage(error) });
      }
      return true;
    };
    this.active = run();
    try { return await this.active; }
    finally { this.active = null; }
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.runNext().catch(() => { /* Unexpected DB failures never log raw data. */ }); }, 250);
    this.timer.unref();
  }
  async stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; if (this.active) await this.active; }
}
