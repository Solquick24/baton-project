import { randomUUID } from 'node:crypto';
import { jobSchema, jobKindSchema, inputVersionSchema, type Job, type JobKind, type JobError, type Mode } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { requireMembership, assertAction } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { ApiError } from '../../shared/errors.js';

export type StoredJob = Job & { patientId: string; requestedBy: string; inputVersion: number };
export type JobCompletion = { mode: Mode; resultVersion: number | null; resultState: 'ready' | 'blocked' | null };
const sectionFor = { merge_questions: 'questions', briefing: 'briefing', structure: 'record' } as const;
export class JobsService {
  constructor(readonly db: BatonDatabase) {}
  private find(id: string) { return this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as StoredJob | undefined; }
  get(userId: string, id: string): Job {
    const row = this.find(id);
    if (!row) throw new ApiError('not_found');
    try {
      const m = requireMembership(this.db, userId, row.patientId);
      if (row.requestedBy !== userId && !allowedKinds(m.scope).includes('full')) throw new ApiError('not_found');
    } catch { throw new ApiError('not_found'); }
    return jobSchema.parse({ id: row.id, visitId: row.visitId, kind: row.kind, status: row.status, attempt: row.attempt,
      mode: row.mode, resultVersion: row.resultVersion, resultState: row.resultState, errorCode: row.errorCode, createdAt: row.createdAt, updatedAt: row.updatedAt });
  }
  assertCurrentInput(job: Pick<StoredJob, 'patientId' | 'visitId' | 'kind' | 'inputVersion'>) {
    const v = this.db.prepare('SELECT recordInputVersion,questionsInputVersion,questionsVersion FROM visits WHERE id=? AND patientId=?').get(job.visitId, job.patientId) as { recordInputVersion: number; questionsInputVersion: number; questionsVersion: number | null } | undefined;
    if (!v) throw new ApiError('not_found');
    const current = job.kind === 'merge_questions' ? v.questionsInputVersion : job.kind === 'briefing' ? v.questionsVersion : v.recordInputVersion;
    if (current === null) throw new ApiError('conflict', 'not_ready');
    if (current !== job.inputVersion) throw new ApiError('conflict', 'stale_input');
  }
  enqueue(userId: string, patientId: string, visitId: string, kind: JobKind, inputVersion: number): { jobId: string } {
    jobKindSchema.parse(kind); inputVersionSchema.parse(inputVersion);
    const m = requireMembership(this.db, userId, patientId);
    assertAction(m, 'generate');
    if (kind === 'transcribe') assertAction(m, 'upload_audio');
    return this.db.transaction(() => {
      this.assertCurrentInput({ patientId, visitId, kind, inputVersion });
      const previous = this.db.prepare('SELECT * FROM jobs WHERE visitId=? AND patientId=? AND kind=? AND inputVersion=? ORDER BY attempt DESC LIMIT 1').get(visitId, patientId, kind, inputVersion) as StoredJob | undefined;
      if (previous && previous.status !== 'failed') {
        this.get(userId, previous.id); // Does not expose another companion's jobId.
        return { jobId: previous.id };
      }
      const id = randomUUID(), now = new Date().toISOString();
      this.db.prepare('INSERT INTO jobs (id,patientId,visitId,requestedBy,kind,inputVersion,status,attempt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?, ?,?,?)').run(id, patientId, visitId, userId, kind, inputVersion, 'queued', (previous?.attempt ?? 0) + 1, now, now);
      return { jobId: id };
    })();
  }
  recoverRunning() {
    return this.db.prepare("UPDATE jobs SET status='failed',errorCode='internal',mode=NULL,resultVersion=NULL,resultState=NULL,updatedAt=? WHERE status='running'").run(new Date().toISOString()).changes;
  }
  claim(): StoredJob | undefined {
    return this.db.transaction(() => {
      const job = this.db.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY createdAt,id LIMIT 1").get() as StoredJob | undefined;
      if (!job) return undefined;
      this.db.prepare("UPDATE jobs SET status='running',updatedAt=? WHERE id=? AND status='queued'").run(new Date().toISOString(), job.id);
      return { ...job, status: 'running' as const };
    })();
  }
  assertRunnable(job: StoredJob) {
    assertAction(requireMembership(this.db, job.requestedBy, job.patientId), job.kind === 'transcribe' ? 'upload_audio' : 'generate');
    this.assertCurrentInput(job);
  }
  complete(job: StoredJob, result: JobCompletion) {
    this.db.transaction(() => {
      assertAction(requireMembership(this.db, job.requestedBy, job.patientId), job.kind === 'transcribe' ? 'upload_audio' : 'generate');
      if (job.kind === 'transcribe') {
        // T039 worker must store the transcript and advance inputVersion once, atomically.
        this.assertCurrentInput({ ...job, inputVersion: job.inputVersion + 1 });
        if (result.resultVersion !== null || result.resultState !== null || !this.db.prepare('SELECT id FROM transcripts WHERE patientId=? AND visitId=? AND mode=? AND createdAt>=?').get(job.patientId, job.visitId, result.mode, job.createdAt)) throw new Error('Missing transcription');
      } else {
        this.assertCurrentInput(job);
        const set = this.db.prepare('SELECT version FROM block_sets WHERE patientId=? AND visitId=? AND section=? AND version=? AND inputVersion=? AND mode=? AND state=? AND createdBy=?').get(job.patientId, job.visitId, sectionFor[job.kind], result.resultVersion, job.inputVersion, result.mode, result.resultState, job.requestedBy);
        if (!set || result.resultVersion === null || result.resultState === null) throw new Error('Missing validated result');
      }
      const changed = this.db.prepare("UPDATE jobs SET status='succeeded',mode=?,resultVersion=?,resultState=?,errorCode=NULL,updatedAt=? WHERE id=? AND status='running'").run(result.mode, result.resultVersion, result.resultState, new Date().toISOString(), job.id).changes;
      if (changed !== 1) throw new Error('Invalid job transition');
    })();
  }
  fail(id: string, error: JobError) {
    this.db.prepare("UPDATE jobs SET status='failed',errorCode=?,mode=NULL,resultVersion=NULL,resultState=NULL,updatedAt=? WHERE id=? AND status='running'").run(error, new Date().toISOString(), id);
  }
}
