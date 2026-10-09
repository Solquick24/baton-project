import type { FastifyInstance } from 'fastify';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { authenticate } from '../auth/session.js';
import { changeScope, members, shareLogs } from '../modules/members/service.js';

export function registerMembers(app: FastifyInstance, db: BatonDatabase) {
  app.get<{ Params: { pid: string } }>('/api/patients/:pid/members', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return members(db, await authenticate(req, db), req.params.pid);
  });
  app.put<{ Params: { pid: string; uid: string } }>('/api/patients/:pid/members/:uid/scope', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return changeScope(db, await authenticate(req, db), req.params.pid, req.params.uid, req.body);
  });
  app.get<{ Params: { pid: string; uid: string } }>('/api/patients/:pid/members/:uid/share-log', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return shareLogs(db, await authenticate(req, db), req.params.pid, req.params.uid);
  });
  app.get<{ Params: { pid: string } }>('/api/patients/:pid/share-log', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return shareLogs(db, await authenticate(req, db), req.params.pid);
  });
}
