import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/session.js';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { readVisit } from '../adapters/sqlite/visit-repository.js';
import { home, myPatients, timeline } from '../modules/visits/query.js';

const deptQuery = z.strictObject({ dept: z.string().min(1).optional() });
const viewQuery = z.strictObject({ view: z.enum(['published', 'draft']).optional() });
export function registerVisits(app: FastifyInstance, db: BatonDatabase, today: string) {
  app.get('/api/me/patients', async (req) => myPatients(db, await authenticate(req, db)));
  app.get<{ Params: { pid: string } }>('/api/patients/:pid/home', async (req) => home(db, await authenticate(req, db), req.params.pid, today, deptQuery.parse(req.query).dept));
  app.get<{ Params: { pid: string } }>('/api/patients/:pid/timeline', async (req) => timeline(db, await authenticate(req, db), req.params.pid, deptQuery.parse(req.query).dept));
  app.get<{ Params: { pid: string; vid: string } }>('/api/patients/:pid/visits/:vid', async (req) => readVisit(db, await authenticate(req, db), req.params.pid, req.params.vid, viewQuery.parse(req.query).view ?? 'published'));
}
