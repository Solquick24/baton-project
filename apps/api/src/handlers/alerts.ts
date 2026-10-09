import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth/session.js';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { listAlerts, resolveAlert } from '../modules/alerts/service.js';

export function registerAlerts(app: FastifyInstance, db: BatonDatabase) {
  app.get<{ Params: { pid: string } }>('/api/patients/:pid/alerts', async (req) => listAlerts(db, await authenticate(req, db), req.params.pid));
  app.post<{ Params: { pid: string; aid: string } }>('/api/patients/:pid/alerts/:aid/resolve', async (req) => resolveAlert(db, await authenticate(req, db), req.params.pid, req.params.aid, req.body));
}
