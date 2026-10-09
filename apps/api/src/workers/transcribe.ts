import { randomUUID } from 'node:crypto';
import { validateTranscription } from '../adapters/ai/transcribe.js';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { openSourceFile } from '../adapters/local/files.js';
import { ProviderError, type TranscriptionProvider } from '../adapters/ai/providers.js';
import type { JobCompletion, StoredJob } from '../modules/jobs/service.js';
import { recordAccess } from '../modules/records/service.js';
import { ApiError } from '../shared/errors.js';

export async function transcribeAudio(db: BatonDatabase, stt: TranscriptionProvider, uploadDir: string, job: StoredJob): Promise<JobCompletion> {
  if (job.kind !== 'transcribe' || !job.uploadId) throw new ProviderError('validation_failed');
  const upload = db.prepare('SELECT storagePath,mediaType,size FROM uploads WHERE patientId=? AND visitId=? AND id=?').get(job.patientId, job.visitId, job.uploadId) as { storagePath: string; mediaType: string; size: number } | undefined;
  if (!upload) throw new ApiError('not_found');
  const source = await openSourceFile(uploadDir, upload.storagePath, upload.size);
  let result;
  try {
    recordAccess(db, job.requestedBy, job.patientId, job.visitId, 'upload_audio');
    result = await stt.transcribe({ patientId: job.patientId, visitId: job.visitId, attempt: job.attempt, jobId: job.id, uploadId: job.uploadId,
      audio: { stream: source.stream, mediaType: upload.mediaType, size: source.size } });
  } catch (error) { throw error instanceof ProviderError || error instanceof ApiError ? error : new ProviderError('stt_unavailable'); }
  finally { source.stream.destroy(); }
  const validated = validateTranscription(result);
  return { mode: validated.mode, resultVersion: null, resultState: null, persist() {
    const { visit } = recordAccess(db, job.requestedBy, job.patientId, job.visitId, 'upload_audio');
    if (visit.recordInputVersion !== job.inputVersion) throw new ApiError('conflict', 'stale_input');
    db.prepare('INSERT INTO transcripts (id,patientId,visitId,uploadId,mode,segments,createdAt) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), job.patientId, job.visitId, job.uploadId, validated.mode, JSON.stringify(validated.segments), new Date().toISOString());
    db.prepare('UPDATE visits SET recordInputVersion=recordInputVersion+1 WHERE patientId=? AND id=?').run(job.patientId, job.visitId);
  } };
}
