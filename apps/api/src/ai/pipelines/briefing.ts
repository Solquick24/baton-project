import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import type { LLMProvider } from '../../adapters/ai/providers.js';
import type { StoredJob } from '../../modules/jobs/service.js';
import { generatePrevisit } from './previsit.js';
import { briefingInstruction } from '../prompts/briefing.js';
export const briefingPipeline = (db: BatonDatabase, llm: LLMProvider, job: StoredJob) => generatePrevisit(db, llm, job, 'briefing', briefingInstruction);
