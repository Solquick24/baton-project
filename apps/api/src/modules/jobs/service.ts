import { randomUUID } from 'node:crypto';
import { jobSchema, jobKindSchema, inputVersionSchema, type Job, type JobKind, type JobError, type Mode } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { requireMembership, assertAction } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { ApiError } from '../../shared/errors.js';

export type StoredJob = Job & { patientId: string; requestedBy: string; inputVersion: number; uploadId: string | null };
export type JobCompletion = { mode: Mode; resultVersion: number | null; resultState: 'ready' | 'blocked' | null; persist?: () => void };
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
  enqueue(userId: string, patientId: string, visitId: string, kind: JobKind, inputVersion: number, uploadId?: string): { jobId: string } {
    jobKindSchema.parse(kind); inputVersionSchema.parse(inputVersion);
    const m = requireMembership(this.db, userId, patientId);
    assertAction(m, 'generate');
    if (kind === 'transcribe') assertAction(m, 'upload_audio');
    return this.db.transaction(() => {
      if (kind === 'transcribe') {
        if (!uploadId) throw new ApiError('bad_request');
        if (!this.db.prepare('SELECT id FROM uploads WHERE id=? AND visitId=? AND patientId=?').get(uploadId, visitId, patientId)) throw new ApiError('not_found');
      } else if (uploadId !== undefined) throw new ApiError('bad_request');
      const previous = (kind === 'transcribe'
        ? this.db.prepare('SELECT * FROM jobs WHERE visitId=? AND patientId=? AND kind=? AND uploadId=? ORDER BY attempt DESC LIMIT 1').get(visitId, patientId, kind, uploadId)
        : this.db.prepare('SELECT * FROM jobs WHERE visitId=? AND patientId=? AND kind=? AND inputVersion=? ORDER BY attempt DESC LIMIT 1').get(visitId, patientId, kind, inputVersion)) as StoredJob | undefined;
      if (previous && previous.status !== 'failed') {
        if (kind !== 'transcribe') this.assertCurrentInput({ patientId, visitId, kind, inputVersion });
        this.get(userId, previous.id); // Does not expose another companion's jobId.
        return { jobId: previous.id };
      }
      this.assertCurrentInput({ patientId, visitId, kind, inputVersion });
      const id = randomUUID(), now = new Date().toISOString();
      this.db.prepare('INSERT INTO jobs (id,patientId,visitId,requestedBy,kind,inputVersion,uploadId,status,attempt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, patientId, visitId, userId, kind, inputVersion, uploadId ?? null, 'queued', (previous?.attempt ?? 0) + 1, now, now);
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
    if (job.kind === 'transcribe' && (!job.uploadId || !this.db.prepare('SELECT id FROM uploads WHERE id=? AND visitId=? AND patientId=?').get(job.uploadId, job.visitId, job.patientId))) throw new ApiError('not_found');
    this.assertCurrentInput(job);
  }
  complete(job: StoredJob, result: JobCompletion) {
    this.db.transaction(() => {
      assertAction(requireMembership(this.db, job.requestedBy, job.patientId), job.kind === 'transcribe' ? 'upload_audio' : 'generate');
      if (job.kind !== 'transcribe') this.assertCurrentInput(job);
      result.persist?.(); // Validated result, pointer and job completion share this transaction.
      if (job.kind === 'transcribe') {
        // T039 worker must store the transcript and advance inputVersion once, atomically.
        this.assertCurrentInput({ ...job, inputVersion: job.inputVersion + 1 });
        if (!job.uploadId || result.resultVersion !== null || result.resultState !== null || !this.db.prepare('SELECT id FROM transcripts WHERE patientId=? AND visitId=? AND uploadId=? AND mode=? AND createdAt>=?').get(job.patientId, job.visitId, job.uploadId, result.mode, job.createdAt)) throw new Error('Missing transcription');
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
