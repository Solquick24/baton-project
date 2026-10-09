import { randomUUID } from 'node:crypto';
import { modeSchema, recordBlocksSchema } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { loadGenerationInput } from '../../adapters/sqlite/generation-repository.js';
import { ProviderError, type LLMProvider } from '../../adapters/ai/providers.js';
import type { StoredJob, JobCompletion } from '../../modules/jobs/service.js';
import { detectRecordAlerts } from '../../modules/alerts/comparison.js';
import { ApiError } from '../../shared/errors.js';
import { patientRestrictedValues } from '../safety/block-leak-check.js';
import { validateRecord } from '../safety/output-validator.js';
import { structureInstruction } from '../prompts/structure.js';

/** T040 worker; public enqueue/notes/audio routes remain dependent on T039/T042. */
export async function generateRecord(db: BatonDatabase, llm: LLMProvider, job: StoredJob): Promise<JobCompletion> {
  if (job.kind !== 'structure') throw new ProviderError('validation_failed');
  const input = loadGenerationInput(db, job.requestedBy, job.patientId, job.visitId, 'record');
  if (!('transcript' in input)) throw new ProviderError('validation_failed');
  const result = await llm.generate({ input, attempt: job.attempt, instruction: structureInstruction });
  const mode = modeSchema.safeParse(result.mode);
  if (!mode.success || result.section !== 'record') throw new ProviderError('validation_failed');
  const restricted = patientRestrictedValues(db, job.patientId), validated = validateRecord(result.blocks, input, restricted);
  const transcript = input.transcript ? { transcriptId: input.transcript.id, uploadId: input.transcript.uploadId, mode: input.transcript.mode, segments: input.transcript.segments } : null;
  const blocks = recordBlocksSchema.parse({ ...validated.blocks, full: { ...validated.blocks.full, transcript } });
  const version = (db.prepare("SELECT COALESCE(MAX(version),0)+1 version FROM block_sets WHERE patientId=? AND visitId=? AND section='record'").get(job.patientId, job.visitId) as { version: number }).version;
  return { mode: mode.data, resultVersion: version, resultState: validated.state, persist() {
    if (JSON.stringify(input) !== JSON.stringify(loadGenerationInput(db, job.requestedBy, job.patientId, job.visitId, 'record')) || JSON.stringify(restricted) !== JSON.stringify(patientRestrictedValues(db, job.patientId))) throw new ApiError('conflict', 'stale_input');
    const id = randomUUID(), now = new Date().toISOString();
    if (validated.state === 'ready') detectRecordAlerts(db, job.patientId, job.visitId, version, blocks, now);
    recordBlocksSchema.parse(blocks);
    db.prepare('INSERT INTO block_sets (id,patientId,visitId,section,version,inputVersion,state,mode,createdBy,createdAt,issues) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, job.patientId, job.visitId, 'record', version, job.inputVersion, validated.state, mode.data, job.requestedBy, now, JSON.stringify(validated.issues));
    for (const kind of ['schedule', 'companion', 'full'] as const) db.prepare('INSERT INTO visit_blocks (blockSetId,kind,payload) VALUES (?,?,?)').run(id, kind, JSON.stringify(blocks[kind]));
    db.prepare('UPDATE visits SET recordDraftVersion=? WHERE patientId=? AND id=?').run(version, job.patientId, job.visitId);
    // No publish pointer, status or share log changes here.
  } };
}
