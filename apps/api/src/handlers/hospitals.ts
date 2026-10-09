import type { FastifyInstance } from 'fastify';
import { hospitalResponseSchema } from '@baton/contracts';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { authenticate } from '../auth/session.js';
import { ApiError } from '../shared/errors.js';

export function registerHospitals(app: FastifyInstance, db: BatonDatabase) {
  app.get<{ Params: { hid: string } }>('/api/hospitals/:hid', async req => {
    await authenticate(req, db);
    const row = db.prepare('SELECT id,name,address,phone,mapImage,floorImage,guideSteps,experiences,notice FROM hospitals WHERE id=?').get(req.params.hid) as Record<string, string> | undefined;
    if (!row) throw new ApiError('not_found');
    return hospitalResponseSchema.parse({ ...row, guideSteps: JSON.parse(row.guideSteps!), experiences: JSON.parse(row.experiences!) });
  });
}
