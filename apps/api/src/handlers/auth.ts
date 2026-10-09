import type { FastifyInstance } from 'fastify';
import { loginRequestSchema, loginResponseSchema } from '@baton/contracts';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { hashPassword, verifyPassword } from '../shared/password.js';
import { ApiError } from '../shared/errors.js';

export function registerAuth(app: FastifyInstance, db: BatonDatabase) {
  // Equal work for absent accounts; no account existence detail in responses.
  const dummyHash = hashPassword('unused-local-dummy');
  app.post('/api/auth/login', async (request) => {
    const input = loginRequestSchema.parse(request.body);
    const user = db.prepare('SELECT id,name,passwordHash FROM users WHERE email=?').get(input.email) as { id: string; name: string; passwordHash: string } | undefined;
    const correct = verifyPassword(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !correct) throw new ApiError('unauthorized');
    return loginResponseSchema.parse({ accessToken: app.jwt.sign({ sub: user.id }), user: { id: user.id, name: user.name } });
  });
}
