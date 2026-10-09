import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const apiDirectory = fileURLToPath(new URL('../../', import.meta.url));
const booleanSetting = (fallback: 'true' | 'false') =>
  z.enum(['true', 'false']).default(fallback).transform((value) => value === 'true');

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  JWT_SECRET: z.string().refine((value) => value.trim().length >= 32),
  SQLITE_PATH: z.string().min(1).default('./data/baton.sqlite'),
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
  FIXTURES_DIR: z.string().min(1).default('../../fixtures'),
  DEMO_TODAY: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }).default('2026-03-12'),
  LLM_MODE: z.enum(['fixture', 'live']).default('fixture'),
  LLM_PROVIDER: z.enum(['openai', 'bedrock']).default('openai'),
  OPENAI_API_KEY: z.string().trim().default(''),
  OPENAI_MODEL: z.string().trim().default(''),
  STT_MODE: z.enum(['fixture', 'live']).default('fixture'),
  LIVE_FALLBACK_TO_FIXTURE: booleanSetting('true'),
  ENABLE_TEST_ENDPOINTS: booleanSetting('false'),
  AWS_REGION: z.string().min(1).default('ap-northeast-2'),
  AWS_PROFILE: z.string().default(''),
  BEDROCK_MODEL_ID: z.string().min(1).default('anthropic.claude-sonnet-5'),
  TRANSCRIBE_STAGING_BUCKET: z.string().default(''),
});

/** Existing process settings take precedence over .env; tests never load local secrets. */
export function loadApiEnv() {
  const envFile = resolve(apiDirectory, '.env');
  if (process.env.NODE_ENV !== 'test' && existsSync(envFile)) process.loadEnvFile(envFile);
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    // Do not log supplied values, credentials, or Zod's full input object.
    throw new Error(`환경 설정을 확인해 주세요: ${keys.join(', ')}`);
  }
  const values = parsed.data;
  if (values.LLM_MODE === 'live' && values.LLM_PROVIDER === 'openai') {
    const missing = (['OPENAI_API_KEY', 'OPENAI_MODEL'] as const).filter((key) => !values[key]);
    if (missing.length) throw new Error(`OpenAI live 환경 설정을 확인해 주세요: ${missing.join(', ')}`);
  }
  const localPath = (value: string) => isAbsolute(value) ? value : resolve(apiDirectory, value);
  return {
    port: values.API_PORT,
    jwtSecret: values.JWT_SECRET,
    sqlitePath: values.SQLITE_PATH === ':memory:' ? ':memory:' : localPath(values.SQLITE_PATH),
    uploadDir: localPath(values.UPLOAD_DIR),
    fixturesDir: localPath(values.FIXTURES_DIR),
    demoToday: values.DEMO_TODAY,
    llmMode: values.LLM_MODE,
    llmProvider: values.LLM_PROVIDER,
    openaiApiKey: values.OPENAI_API_KEY,
    openaiModel: values.OPENAI_MODEL,
    sttMode: values.STT_MODE,
    liveFallbackToFixture: values.LIVE_FALLBACK_TO_FIXTURE,
    enableTestEndpoints: values.ENABLE_TEST_ENDPOINTS,
    awsRegion: values.AWS_REGION,
    awsProfile: values.AWS_PROFILE,
    bedrockModelId: values.BEDROCK_MODEL_ID,
    transcribeStagingBucket: values.TRANSCRIBE_STAGING_BUCKET,
  };
}

export type AppConfig = ReturnType<typeof readConfig>;
