// Guard against accidental AWS calls in Phase 1 tests, regardless of local .env/profile.
import { beforeEach, vi } from 'vitest';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { S3Client } from '@aws-sdk/client-s3';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('테스트에서 실제 외부 HTTP 호출을 사용할 수 없어요.'));
  for (const Client of [BedrockRuntimeClient, TranscribeClient, S3Client]) {
    vi.spyOn(Client.prototype, 'send').mockImplementation(() => {
      throw new Error('테스트에서 실제 AWS 호출을 사용할 수 없어요.');
    });
  }
});
