import Fastify, { LogController } from 'fastify';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { healthResponseSchema } from '@baton/contracts';
import { readConfig, type AppConfig } from './shared/config.js';

export async function buildApp(options: { config?: AppConfig; logger?: boolean } = {}) {
  const config = options.config ?? readConfig();
  const app = Fastify({
    logger: options.logger ? {
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    } : false,
    // Request logging is deliberately disabled until the safe logger in T017.
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1_048_576,
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { algorithm: 'HS256', iss: 'baton-local', aud: 'baton-web', expiresIn: '8h' },
    verify: { algorithms: ['HS256'], allowedIss: 'baton-local', allowedAud: 'baton-web' },
  });
  await app.register(multipart, { limits: { files: 1, fileSize: 20 * 1024 * 1024 } });
  app.get('/api/health', async () => healthResponseSchema.parse({ status: 'ok' }));
  // Patient/auth routes and persistence are intentionally left for Phase 2.
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    error: { code: 'not_found', message: '찾을 수 없어요.', requestId: request.id },
  }));
  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode : undefined;
    const status = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    reply.code(status).send({ error: {
      code: status < 500 ? 'bad_request' : 'internal',
      message: status < 500 ? '요청을 확인해 주세요.' : '처리하지 못했어요.', requestId: request.id,
    } });
  });
  return app;
}
