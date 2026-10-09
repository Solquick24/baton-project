import { z } from 'zod';
import type { Readable } from 'node:stream';
import { questionsBlocksSchema, briefingBlocksSchema, recordGeneratedBlocksSchema, type Section, type Mode, type JobError, type Transcript } from '@baton/contracts';
import type { GenerationInput } from '../sqlite/generation-repository.js';

export const generatedSchemas = { questions: questionsBlocksSchema, briefing: briefingBlocksSchema, record: recordGeneratedBlocksSchema };
export type GeneratedBlocks = z.infer<typeof questionsBlocksSchema> | z.infer<typeof briefingBlocksSchema> | z.infer<typeof recordGeneratedBlocksSchema>;
export type LLMRequest = { input: GenerationInput; attempt: number; instruction: string };
export type LLMResult = { section: Section; mode: Mode; blocks: GeneratedBlocks };
export interface LLMProvider { generate(request: LLMRequest): Promise<LLMResult> }
export interface RawLLMProvider { mode: Mode; generateRaw(request: LLMRequest): Promise<unknown> }
export type TranscriptionRequest = { patientId: string; visitId: string; attempt: number; jobId?: string; uploadId?: string;
  audio?: { stream: Readable; mediaType: string; size: number } };
export interface TranscriptionProvider { transcribe(input: TranscriptionRequest): Promise<{ mode: Mode; segments: Transcript['segments'] }> }
export const failureStages = ['response_format', 'response_incomplete', 'response_refusal', 'provider_transport', 'output_schema', 'source_identity', 'source_quote', 'item_reference', 'input_context', 'medication_identity', 'storage_schema', 'unknown'] as const;
export type FailureStage = typeof failureStages[number];
export class ProviderError extends Error {
  constructor(readonly code: JobError, readonly stage: FailureStage = 'unknown') { super('AI 처리를 완료하지 못했어요.'); }
}
export function safeFailureStage(error: unknown): FailureStage {
  return error instanceof ProviderError && failureStages.includes(error.stage) ? error.stage : 'unknown';
}

/** Same strict server schema and at most one schema retry for BOTH live and fixtures.
 * Does not certify semantic safety or save results; T041 validation is still required by pipelines.
 */
export function validatedLLM(primary: RawLLMProvider, fallback?: RawLLMProvider): LLMProvider {
  async function generateWith(provider: RawLLMProvider, request: LLMRequest): Promise<LLMResult> {
    const schema = generatedSchemas[request.input.purpose];
    if (!schema || !Number.isInteger(request.attempt) || request.attempt < 1) throw new ProviderError('validation_failed');
    let stage: FailureStage = 'output_schema';
    for (let retry = 0; retry < 2; retry++) {
      const raw = await provider.generateRaw(request);
      stage = raw === undefined ? 'response_format' : 'output_schema';
      const parsed = schema.safeParse(raw);
      if (parsed.success) return { section: request.input.purpose, mode: provider.mode, blocks: parsed.data };
    }
    throw new ProviderError('validation_failed', stage);
  }
  return { async generate(request) {
    try { return await generateWith(primary, request); }
    catch (error) {
      if (primary.mode === 'live' && fallback) return generateWith(fallback, request);
      throw error instanceof ProviderError ? error : new ProviderError('ai_unavailable');
    }
  } };
}
