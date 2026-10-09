import { z } from 'zod';
export * from './core.js';
export * from './blocks.js';
export * from './api.js';

// Preserve the Phase 1 health contract for the existing web entry point.
export const healthResponseSchema = z.object({ status: z.literal('ok') }).strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;
