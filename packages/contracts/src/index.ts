import { z } from 'zod';

// Phase 1 connectivity only. Patient/block contracts are implemented in T008.
export const healthResponseSchema = z.object({ status: z.literal('ok') }).strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;
