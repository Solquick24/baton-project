import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { TranscribeClient, ListTranscriptionJobsCommand } from '@aws-sdk/client-transcribe';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { loadApiEnv, readConfig } from '../apps/api/src/shared/config.js';

// One small model invocation; other probes are read-only. Never create infrastructure,
// upload objects, start transcription jobs, or modify IAM during this check.
const args = process.argv.slice(2);
if (args.length > 0 && !(args.length === 2 && args[0] === '--report' && args[1])) {
  throw new Error('Usage: npm run check:ai -- [--report path]');
}
loadApiEnv();
const config = readConfig();
if (config.awsProfile) process.env.AWS_PROFILE = config.awsProfile;
const options = { region: config.awsRegion, maxAttempts: 1 };
const bedrock = new BedrockRuntimeClient(options);
const transcribe = new TranscribeClient(options);
const s3 = new S3Client(options);
type Check = { status: 'passed' | 'failed' | 'skipped'; error?: string; detail?: string };
const checks: Record<string, Check> = {};
async function probe(name: string, action: () => Promise<void>) {
  try { await action(); checks[name] = { status: 'passed' }; }
  catch (error) {
    // Service exception name only: full errors may include credentials or request payloads.
    checks[name] = { status: 'failed', error: error instanceof Error ? error.name : 'UnknownError' };
  }
}

try {
  await probe('bedrockConverseToolUse', async () => {
    const response = await bedrock.send(new ConverseCommand({
      modelId: config.bedrockModelId,
      messages: [{ role: 'user', content: [{ text: '연결 확인입니다. check_connection 도구에 status="ok"만 전달하세요. 의료 정보는 없습니다.' }] }],
      inferenceConfig: { maxTokens: 128, temperature: 0 },
      toolConfig: {
        tools: [{ toolSpec: {
          name: 'check_connection', description: 'Return a connection check only.',
          inputSchema: { json: { type: 'object', properties: { status: { type: 'string', enum: ['ok'] } }, required: ['status'], additionalProperties: false } },
        } }],
        toolChoice: { tool: { name: 'check_connection' } },
      },
    }), { abortSignal: AbortSignal.timeout(15_000) });
    const tool = response.output?.message?.content?.find((block) => block.toolUse?.name === 'check_connection')?.toolUse;
    z.object({ status: z.literal('ok') }).strict().parse(tool?.input);
  });
  await probe('transcribeListJobs', async () => {
    await transcribe.send(new ListTranscriptionJobsCommand({ MaxResults: 1 }), { abortSignal: AbortSignal.timeout(15_000) });
  });
  if (config.transcribeStagingBucket) {
    await probe('stagingBucketHead', async () => {
      await s3.send(new HeadBucketCommand({ Bucket: config.transcribeStagingBucket }), { abortSignal: AbortSignal.timeout(15_000) });
    });
  } else {
    checks.stagingBucketHead = { status: 'skipped', detail: '기존 버킷 미설정. 새 버킷은 생성하지 않습니다.' };
  }
  await probe('fixtureFiles', async () => {
    const manifest = JSON.parse(await readFile(resolve(config.fixturesDir, 'expected/manifest.json'), 'utf8')) as unknown;
    const transcript = JSON.parse(await readFile(resolve(config.fixturesDir, 'expected/transcribe/v_im_03.json'), 'utf8')) as unknown;
    if (!manifest || !transcript) throw new Error('MissingFixture');
  });
  const report = {
    checkedAt: new Date().toISOString(), region: config.awsRegion, modelId: config.bedrockModelId,
    checks, liveReady: Object.values(checks).every((check) => check.status === 'passed'),
    fallback: 'LLM_MODE=fixture / STT_MODE=fixture. provider와 저장 전 검증은 T018 이후 구현합니다.',
    transcriptionSample: '음성 파일이 없어 미실시. ListJobs 성공은 STT 변환 성공을 뜻하지 않습니다.',
  };
  if (args[1]) await writeFile(resolve(args[1]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.liveReady) process.exitCode = 1;
} finally {
  bedrock.destroy(); transcribe.destroy(); s3.destroy();
}
