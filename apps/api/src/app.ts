import Fastify, { LogController } from 'fastify';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { healthResponseSchema } from '@baton/contracts';
import { readConfig, type AppConfig } from './shared/config.js';
import { openDatabase, type BatonDatabase } from './adapters/sqlite/database.js';
import { registerAuth } from './handlers/auth.js';
import { installErrors } from './shared/errors.js';
import { installSafeLogging, newRequestId, safeLoggerOptions } from './shared/logger.js';
import { JobsService } from './modules/jobs/service.js';
import { JobRunner, type JobHandlers } from './workers/runner.js';
import { registerJobs } from './handlers/jobs.js';
import { registerVisits } from './handlers/visits.js';
import { registerQuestions } from './handlers/questions.js';
import { registerBriefing } from './handlers/briefing.js';
import { previsitHandlers } from './ai/pipelines/index.js';
import { FixtureLLM, FixtureTranscription } from './adapters/ai/fixture.js';
import { BedrockLLM } from './adapters/ai/bedrock.js';
import { OpenAILLM } from './adapters/ai/openai.js';
import { validatedLLM, type LLMProvider, type TranscriptionProvider } from './adapters/ai/providers.js';

declare module 'fastify' {
  interface FastifyInstance { baton: { db: BatonDatabase; llm: LLMProvider; stt: TranscriptionProvider; jobs: JobsService; runner: JobRunner } }
}

export async function buildApp(options: { config?: AppConfig; logger?: boolean; db?: BatonDatabase; llm?: LLMProvider; stt?: TranscriptionProvider; jobHandlers?: JobHandlers } = {}) {
  const config = options.config ?? readConfig();
  const app = Fastify({
    logger: options.logger ? safeLoggerOptions : false,
    genReqId: newRequestId,
    // Custom safe response logging omits URL, body, headers and originals.
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1_048_576,
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { algorithm: 'HS256', iss: 'baton-local', aud: 'baton-web', expiresIn: '8h' },
    verify: { algorithms: ['HS256'], allowedIss: 'baton-local', allowedAud: 'baton-web' },
  });
  await app.register(multipart, { limits: { files: 1, fileSize: 20 * 1024 * 1024 } });
  const db = options.db ?? openDatabase(config.sqlitePath);
  const fixture = new FixtureLLM(config.fixturesDir);
  const live = !options.llm && config.llmMode === 'live'
    ? config.llmProvider === 'openai' ? new OpenAILLM(config.openaiApiKey, config.openaiModel) : new BedrockLLM(config.bedrockModelId)
    : null;
  const llm = options.llm ?? validatedLLM(live ?? fixture, live && config.liveFallbackToFixture ? fixture : undefined);
  // Live STT adapter belongs to T039; never silently claim it is available.
  const stt = options.stt ?? (config.sttMode === 'fixture' ? new FixtureTranscription(config.fixturesDir) : { async transcribe() { throw new Error('Live 전사는 T039 구현이 필요해요.'); } });
  const jobs = new JobsService(db);
  const runner = new JobRunner(jobs, { ...previsitHandlers(db, llm), ...options.jobHandlers });
  jobs.recoverRunning();
  app.decorate('baton', { db, llm, stt, jobs, runner });
  app.addHook('onReady', async () => { runner.start(); });
  app.addHook('onClose', async () => { await runner.stop(); live?.destroy(); if (!options.db) db.close(); });
  installErrors(app);
  installSafeLogging(app);
  registerAuth(app, db);
  registerJobs(app, jobs);
  registerVisits(app, db, config.demoToday);
  registerQuestions(app, db, jobs);
  registerBriefing(app, db, jobs);
  app.get('/api/health', async () => healthResponseSchema.parse({ status: 'ok' }));
  return app;
}
