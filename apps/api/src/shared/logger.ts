import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export const safeLoggerOptions = {
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  serializers: {
    req: () => ({}),
    res: () => ({}),
    err: () => ({ type: 'Error', message: '처리하지 못했어요.', stack: '' }),
  },
};
export const newRequestId = () => randomUUID();
export function installSafeLogging(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    // No URL/params/body/header/error object: originals and credentials stay out of logs.
    app.log.info({ requestId: request.id, statusCode: reply.statusCode, method: request.method }, '요청 처리');
  });
}
