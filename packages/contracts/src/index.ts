import { z } from 'zod';
export * from './core.js';
export * from './blocks.js';
export * from './api.js';

// Preserve the Phase 1 health contract for the existing web entry point.
export const healthResponseSchema = z.object({ status: z.literal('ok') }).strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;

// Keep frontend DTO names as aliases of the validated shared contracts.
export type { LoginResponse as LoginRes } from './core.js';
export type {
  HomeResponse as HomeRes, MePatientsResponse as MePatientsRes,
  QuestionsResponse as QuestionsRes, BriefingResponse as BriefingRes,
} from './api.js';
export type SourceRef = z.infer<typeof import('./blocks.js').sourceRefSchema>;
export type MergedQuestion = import('./blocks.js').QuestionsCompanionBlock['mergedQuestions'][number];
export type Item = import('./blocks.js').BriefingFullBlock['briefing']['watch'][number];
