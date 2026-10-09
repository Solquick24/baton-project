import { randomUUID } from 'node:crypto';
import { modeSchema } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { loadGenerationInput } from '../../adapters/sqlite/generation-repository.js';
import type { LLMProvider } from '../../adapters/ai/providers.js';
import { ProviderError } from '../../adapters/ai/providers.js';
import type { StoredJob, JobCompletion } from '../../modules/jobs/service.js';
import { ApiError } from '../../shared/errors.js';
import { patientRestrictedValues } from '../safety/block-leak-check.js';
import { validatePrevisit } from '../safety/output-validator.js';

export async function generatePrevisit(db: BatonDatabase, llm: LLMProvider, job: StoredJob, section: 'questions' | 'briefing', instruction: string): Promise<JobCompletion> {
  const input = loadGenerationInput(db, job.requestedBy, job.patientId, job.visitId, section);
  const result = await llm.generate({ input, attempt: job.attempt, instruction });
  const mode = modeSchema.safeParse(result.mode);
  if (result.section !== section || !mode.success) throw new ProviderError('validation_failed');
  const restricted = patientRestrictedValues(db, job.patientId);
  const validated = validatePrevisit(section, result.blocks, input, restricted);
  const version = (db.prepare('SELECT COALESCE(MAX(version),0)+1 version FROM block_sets WHERE patientId=? AND visitId=? AND section=?').get(job.patientId, job.visitId, section) as { version: number }).version;
  return { mode: mode.data, resultVersion: version, resultState: validated.state, persist() {
    const current = loadGenerationInput(db, job.requestedBy, job.patientId, job.visitId, section);
    if (JSON.stringify(input) !== JSON.stringify(current) || JSON.stringify(restricted) !== JSON.stringify(patientRestrictedValues(db, job.patientId))) throw new ApiError('conflict', 'stale_input');
    const id = randomUUID();
    db.prepare('INSERT INTO block_sets (id,patientId,visitId,section,version,inputVersion,state,mode,createdBy,createdAt,issues) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, job.patientId, job.visitId, section, version, job.inputVersion, validated.state, mode.data, job.requestedBy, new Date().toISOString(), JSON.stringify(validated.issues));
    for (const kind of ['schedule', 'companion', 'full'] as const) db.prepare('INSERT INTO visit_blocks (blockSetId,kind,payload) VALUES (?,?,?)').run(id, kind, JSON.stringify(validated.blocks[kind]));
    // Latest completed ready OR blocked result; never substitute an older ready result.
    const pointer = section === 'questions' ? 'questionsVersion' : 'briefingVersion';
    db.prepare(`UPDATE visits SET ${pointer}=? WHERE patientId=? AND id=?`).run(version, job.patientId, job.visitId);
  } };
}
