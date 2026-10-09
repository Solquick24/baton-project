import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import type { LLMProvider } from '../../adapters/ai/providers.js';
import type { JobHandlers } from '../../workers/runner.js';
import { mergeQuestionsPipeline } from './merge-questions.js';
import { briefingPipeline } from './briefing.js';
export const previsitHandlers = (db: BatonDatabase, llm: LLMProvider): JobHandlers => ({
  merge_questions: (job) => mergeQuestionsPipeline(db, llm, job),
  briefing: (job) => briefingPipeline(db, llm, job),
});
