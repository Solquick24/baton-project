import { expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { TranscribeSTT, transcriptionWithFallback } from '../src/adapters/ai/transcribe.js';
import { FixtureTranscription } from '../src/adapters/ai/fixture.js';
import { ProviderError } from '../src/adapters/ai/providers.js';
import { fixturesDir } from './helpers.js';

const input = () => ({ patientId: 'p_01', visitId: 'v_im_03', jobId: 'virtual-job', uploadId: 'virtual-upload', attempt: 1,
  audio: { stream: Readable.from(Buffer.from('virtual audio')), mediaType: 'audio/wav', size: 13 } });
it('uploads only to the configured staging prefix, polls ko-KR batch, retrieves output with S3 and cleans temporary objects/job', async () => {
  const s3 = vi.mocked(S3Client.prototype.send).mockImplementation(async (command: any) => {
    if (command instanceof GetObjectCommand) return { Body: { async transformToString() { return JSON.stringify({ results: { audio_segments: [{ transcript: '가상 음성 내용입니다.', start_time: '0.1', end_time: '1.5' }] } }); } } } as any;
    return {} as any;
  });
  let polls = 0;
  const aws = vi.mocked(TranscribeClient.prototype.send).mockImplementation(async (command: any) => {
    if (command instanceof GetTranscriptionJobCommand) return { TranscriptionJob: { TranscriptionJobStatus: ++polls === 1 ? 'IN_PROGRESS' : 'COMPLETED' } } as any;
    return {} as any;
  });
  const stt = new TranscribeSTT('existing-staging', 'ap-northeast-2', { wait: async () => {} });
  try {
    expect(await stt.transcribe(input())).toEqual({ mode: 'live', segments: [{ id: 'ts_01', text: '가상 음성 내용입니다.', startMs: 100, endMs: 1500, speaker: null }] });
    const put = s3.mock.calls.find(c => c[0] instanceof PutObjectCommand)![0] as PutObjectCommand;
    expect(put.input).toMatchObject({ Bucket: 'existing-staging', Key: 'baton-staging/p_01/virtual-job/virtual-upload', ContentLength: 13 });
    const start = aws.mock.calls.find(c => c[0] instanceof StartTranscriptionJobCommand)![0] as StartTranscriptionJobCommand;
    expect(start.input).toMatchObject({ LanguageCode: 'ko-KR', MediaFormat: 'wav', OutputBucketName: 'existing-staging', OutputKey: 'baton-staging/p_01/virtual-job/result.json' });
    expect(s3.mock.calls.filter(c => c[0] instanceof DeleteObjectCommand)).toHaveLength(2);
    expect(aws.mock.calls.filter(c => c[0] instanceof DeleteTranscriptionJobCommand)).toHaveLength(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally { stt.destroy(); }
});
it.each(['failed', 'timeout', 'invalid-json', 'cleanup-error'])('safely fails %s without exposing upstream originals', async failure => {
  vi.mocked(S3Client.prototype.send).mockImplementation(async (command: any) => {
    if (failure === 'cleanup-error' && command instanceof DeleteObjectCommand) throw new Error('secret AWS error');
    if (command instanceof GetObjectCommand) return { Body: { async transformToString() { return failure === 'invalid-json' ? 'not json secret' : JSON.stringify({ results: { transcripts: [{ transcript: '가상 전사' }] } }); } } } as any;
    return {} as any;
  });
  vi.mocked(TranscribeClient.prototype.send).mockImplementation(async (command: any) => command instanceof GetTranscriptionJobCommand
    ? { TranscriptionJob: { TranscriptionJobStatus: failure === 'timeout' ? 'IN_PROGRESS' : failure === 'failed' ? 'FAILED' : 'COMPLETED' } } as any : {} as any);
  const stt = new TranscribeSTT('existing-staging', 'ap-northeast-2', { wait: async () => {}, maxPolls: 2 });
  try { await expect(stt.transcribe(input())).rejects.toMatchObject({ code: failure === 'invalid-json' ? 'validation_failed' : 'stt_unavailable', message: 'AI 처리를 완료하지 못했어요.' }); }
  finally { stt.destroy(); }
});
it('does not call AWS without staging config; optional fallback is always mode=fixture and uses the same transcript schema', async () => {
  const stt = new TranscribeSTT('', 'ap-northeast-2');
  try {
    await expect(stt.transcribe(input())).rejects.toMatchObject({ code: 'stt_unavailable' });
    expect(S3Client.prototype.send).not.toHaveBeenCalled(); expect(TranscribeClient.prototype.send).not.toHaveBeenCalled();
    expect(await transcriptionWithFallback(stt, new FixtureTranscription(fixturesDir)).transcribe(input())).toMatchObject({ mode: 'fixture' });
    await expect(transcriptionWithFallback({ async transcribe() { throw new ProviderError('stt_unavailable'); } }).transcribe(input())).rejects.toMatchObject({ code: 'stt_unavailable' });
    await expect(transcriptionWithFallback({ async transcribe() { return { mode: 'live', segments: [{ invalid: true }] } as any; } }).transcribe(input())).rejects.toMatchObject({ code: 'validation_failed' });
  } finally { stt.destroy(); }
});
