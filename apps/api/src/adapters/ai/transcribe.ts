import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand, type MediaFormat } from '@aws-sdk/client-transcribe';
import { z } from 'zod';
import { modeSchema, transcriptSchema } from '@baton/contracts';
import { ProviderError, type TranscriptionProvider, type TranscriptionRequest } from './providers.js';

export function validateTranscription(raw: unknown) {
  const parsed = z.strictObject({ mode: modeSchema, segments: transcriptSchema.shape.segments.min(1) }).safeParse(raw);
  if (!parsed.success || new Set(parsed.data.segments.map(s => s.id)).size !== parsed.data.segments.length || parsed.data.segments.some(s => !s.text.trim() || (s.startMs !== null && s.endMs !== null && s.endMs < s.startMs))) throw new ProviderError('validation_failed');
  return parsed.data;
}
export function transcriptionWithFallback(primary: TranscriptionProvider, fixture?: TranscriptionProvider): TranscriptionProvider {
  return { async transcribe(input) {
    try { return validateTranscription(await primary.transcribe(input)); }
    catch (error) {
      if (fixture) {
        const result = validateTranscription(await fixture.transcribe(input));
        if (result.mode !== 'fixture') throw new ProviderError('validation_failed');
        return result;
      }
      throw error instanceof ProviderError ? error : new ProviderError('stt_unavailable');
    }
  } };
}

/** Existing Amazon Transcribe batch provider, never provisions a bucket or IAM role.
 * Real calls are opt-in STT_MODE=live. Tests replace both SDK clients' send methods.
 */
export class TranscribeSTT implements TranscriptionProvider {
  private readonly s3: S3Client;
  private readonly client: TranscribeClient;
  constructor(private readonly bucket: string, region: string, private readonly options: { wait?: () => Promise<void>; maxPolls?: number } = {}) {
    this.s3 = new S3Client({ region, maxAttempts: 1 }); this.client = new TranscribeClient({ region, maxAttempts: 1 });
  }
  async transcribe(input: TranscriptionRequest) {
    const formats: Record<string, MediaFormat> = { 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'mp4', 'audio/x-m4a': 'm4a', 'audio/webm': 'webm' };
    if (!this.bucket || !input.audio || !input.jobId || !input.uploadId || !formats[input.audio.mediaType] ||
      ![input.patientId, input.jobId, input.uploadId].every(s => /^[a-zA-Z0-9_-]+$/.test(s))) throw new ProviderError('stt_unavailable');
    const prefix = `baton-staging/${input.patientId}/${input.jobId}`, key = `${prefix}/${input.uploadId}`, output = `${prefix}/result.json`;
    const name = `baton-${input.jobId}`, signal = AbortSignal.timeout(180_000);
    let uploaded = false, started = false, result: ReturnType<typeof validateTranscription> | undefined;
    let failure: ProviderError | undefined;
    try {
      // The registered private source is passed as a stream, never a request-supplied path/URI.
      uploaded = true;
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.audio.stream, ContentType: input.audio.mediaType, ContentLength: input.audio.size }), { abortSignal: signal });
      await this.client.send(new StartTranscriptionJobCommand({ TranscriptionJobName: name, LanguageCode: 'ko-KR', MediaFormat: formats[input.audio.mediaType]!,
        Media: { MediaFileUri: `s3://${this.bucket}/${key}` }, OutputBucketName: this.bucket, OutputKey: output }), { abortSignal: signal });
      started = true;
      for (let poll = 0; poll < (this.options.maxPolls ?? 90); poll++) {
        const response = await this.client.send(new GetTranscriptionJobCommand({ TranscriptionJobName: name }), { abortSignal: signal });
        const status = response.TranscriptionJob?.TranscriptionJobStatus;
        if (status === 'FAILED') throw new ProviderError('stt_unavailable');
        if (status === 'COMPLETED') {
          const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: output }), { abortSignal: signal });
          if (!object.Body || (object.ContentLength ?? 0) > 2 * 1024 * 1024) throw new ProviderError('validation_failed');
          const text = await object.Body.transformToString();
          if (text.length > 2 * 1024 * 1024) throw new ProviderError('validation_failed');
          let raw: unknown;
          try { raw = JSON.parse(text); } catch { throw new ProviderError('validation_failed'); }
          const segment = z.object({ transcript: z.string().trim().min(1), start_time: z.coerce.number().finite().nonnegative(), end_time: z.coerce.number().finite().nonnegative() });
          const payload = z.object({ results: z.object({ audio_segments: z.array(segment).min(1).optional(), transcripts: z.array(z.object({ transcript: z.string().trim().min(1) })).min(1).optional() }) }).safeParse(raw);
          if (!payload.success) throw new ProviderError('validation_failed');
          const data = payload.data.results;
          const segments = data.audio_segments?.map((s, i) => ({ id: `ts_${String(i + 1).padStart(2, '0')}`, text: s.transcript, speaker: null, startMs: Math.round(s.start_time * 1000), endMs: Math.round(s.end_time * 1000) }))
            ?? data.transcripts?.map((s, i) => ({ id: `ts_${String(i + 1).padStart(2, '0')}`, text: s.transcript, speaker: null, startMs: null, endMs: null }));
          result = validateTranscription({ mode: 'live', segments }); break;
        }
        if (status !== 'IN_PROGRESS' && status !== 'QUEUED') throw new ProviderError('stt_unavailable');
        if (poll + 1 < (this.options.maxPolls ?? 90)) await (this.options.wait?.() ?? new Promise(resolve => setTimeout(resolve, 2000)));
      }
      if (!result) throw new ProviderError('stt_unavailable');
    } catch (error) { failure = error instanceof ProviderError ? error : new ProviderError('stt_unavailable'); }
    // Only this job's temporary objects. No raw upstream error is logged or returned.
    const cleanupSignal = AbortSignal.timeout(10_000);
    const cleanup = await Promise.allSettled([
      ...(uploaded ? [this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: cleanupSignal }),
        this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: output }), { abortSignal: cleanupSignal })] : []),
      ...(started ? [this.client.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: name }), { abortSignal: cleanupSignal })] : []),
    ]);
    if (failure) throw failure;
    if (cleanup.some(r => r.status === 'rejected') || !result) throw new ProviderError('stt_unavailable');
    return result;
  }
  destroy() { this.s3.destroy(); this.client.destroy(); }
}
