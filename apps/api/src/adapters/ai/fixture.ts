import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { z } from 'zod';
import { jobErrorSchema, transcriptSchema, type Mode } from '@baton/contracts';
import { ProviderError, type RawLLMProvider, type LLMRequest, type TranscriptionProvider } from './providers.js';

const ruleSchema = z.strictObject({ visitId: z.string(), file: z.string(), whenNoteIncludes: z.string().optional(), failOnAttempts: z.array(z.number().int().positive()).optional(), errorCode: jobErrorSchema.optional() });
const manifestSchema = z.strictObject({ _note: z.string(), pipelines: z.strictObject({ transcribe: z.array(ruleSchema), merge_questions: z.array(ruleSchema), briefing: z.array(ruleSchema), structure: z.array(ruleSchema) }) });
function readFixture(directory: string, pipeline: 'transcribe' | 'merge_questions' | 'briefing' | 'structure', visitId: string, notes: string, attempt: number): unknown {
  try {
    const base = realpathSync(resolve(directory, 'expected'));
    const manifest = manifestSchema.parse(JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8')));
    const rule = manifest.pipelines[pipeline].find((r) => r.visitId === visitId && (!r.whenNoteIncludes || notes.includes(r.whenNoteIncludes)));
    if (!rule) throw new ProviderError(pipeline === 'transcribe' ? 'stt_unavailable' : 'ai_unavailable');
    if (rule.failOnAttempts?.includes(attempt)) throw new ProviderError(rule.errorCode ?? 'ai_unavailable');
    const path = realpathSync(resolve(base, rule.file));
    const rel = relative(base, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new ProviderError('validation_failed');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) { throw error instanceof ProviderError ? error : new ProviderError('validation_failed'); }
}
export class FixtureLLM implements RawLLMProvider {
  readonly mode: Mode = 'fixture';
  constructor(private readonly directory: string) {}
  async generateRaw(request: LLMRequest): Promise<unknown> {
    const pipeline = { questions: 'merge_questions', briefing: 'briefing', record: 'structure' } as const;
    const notes = 'notes' in request.input ? request.input.notes.map((n) => n.text).join('\n') : '';
    return readFixture(this.directory, pipeline[request.input.purpose], request.input.visitId, notes, request.attempt);
  }
}
export class FixtureTranscription implements TranscriptionProvider {
  constructor(private readonly directory: string) {}
  async transcribe(input: { patientId: string; visitId: string; attempt: number }) {
    const schema = z.strictObject({ _note: z.string(), segments: transcriptSchema.shape.segments });
    const parsed = schema.safeParse(readFixture(this.directory, 'transcribe', input.visitId, '', input.attempt));
    if (!parsed.success) throw new ProviderError('validation_failed');
    return { mode: 'fixture' as const, segments: parsed.data.segments };
  }
}
