import type { FastifyRequest } from 'fastify';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { ApiError } from '../shared/errors.js';

export async function authenticate(request: FastifyRequest, db: BatonDatabase): Promise<string> {
  try {
    const claims = await request.jwtVerify<{ sub?: unknown }>();
    if (typeof claims.sub !== 'string' || !claims.sub || !db.prepare('SELECT id FROM users WHERE id=?').get(claims.sub)) throw new Error('Invalid identity');
    return claims.sub;
  } catch { throw new ApiError('unauthorized'); }
}
