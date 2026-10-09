import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { errorResponseSchema, type errorCodeSchema, type errorReasonSchema } from '@baton/contracts';
import type { z } from 'zod';
import { ProviderError } from '../adapters/ai/providers.js';

type Code = z.infer<typeof errorCodeSchema>;
type Reason = z.infer<typeof errorReasonSchema>;
const statuses: Record<Code, number> = { unauthorized: 401, forbidden: 403, not_found: 404, bad_request: 400, conflict: 409, upstream_error: 502 };
const messages: Record<Code, string> = { unauthorized: '이메일 또는 비밀번호와 로그인을 확인해 주세요.', forbidden: '이 작업을 할 수 없어요.', not_found: '찾을 수 없어요.', bad_request: '요청을 확인해 주세요.', conflict: '내용이 바뀌었어요. 다시 확인해 주세요.', upstream_error: '처리하지 못했어요. 다시 시도해 주세요.' };
export class ApiError extends Error {
  readonly statusCode: number;
  constructor(readonly code: Code, readonly reason?: Reason) { super(messages[code]); this.statusCode = statuses[code]; }
}
export function installErrors(app: FastifyInstance) {
  app.setNotFoundHandler((req, reply) => reply.code(404).send(errorResponseSchema.parse({ error: { code: 'not_found', message: messages.not_found, requestId: req.id } })));
  app.setErrorHandler((error, req, reply) => {
    const inputError = error instanceof ZodError || (typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500);
    const safe = error instanceof ApiError ? error : new ApiError(inputError ? 'bad_request' : 'upstream_error');
    const status = error instanceof ApiError ? error.statusCode : error instanceof ProviderError ? 502 : inputError ? 400 : 500;
    reply.code(status).send(errorResponseSchema.parse({ error: {
      code: safe.code, ...(safe.reason ? { reason: safe.reason } : {}), message: messages[safe.code], requestId: req.id,
    } }));
  });
}
