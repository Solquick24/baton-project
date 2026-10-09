import type { FastifyInstance } from 'fastify';
import { jobAcceptedResponseSchema, structureRequestSchema, transcribeRequestSchema } from '@baton/contracts';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import type { JobsService } from '../modules/jobs/service.js';
import { authenticate } from '../auth/session.js';
import { addNote, recordAccess, recordInput, saveAudio, shareRecord } from '../modules/records/service.js';
import { ApiError } from '../shared/errors.js';

export function registerRecords(app: FastifyInstance, db: BatonDatabase, jobs: JobsService, uploadDir: string) {
  type Route = { Params: { pid: string; vid: string } };
  const base = '/api/patients/:pid/visits/:vid';
  app.get<Route>(`${base}/record-input`, async req => recordInput(db, await authenticate(req, db), req.params.pid, req.params.vid));
  app.post<Route>(`${base}/notes`, async (req, reply) => reply.code(201).send(addNote(db, await authenticate(req, db), req.params.pid, req.params.vid, req.body)));
  app.post<Route>(`${base}/structure`, async (req, reply) => {
    const user = await authenticate(req, db), { inputVersion } = structureRequestSchema.parse(req.body);
    return reply.code(202).send(jobAcceptedResponseSchema.parse(jobs.enqueue(user, req.params.pid, req.params.vid, 'structure', inputVersion)));
  });
  app.post<Route>(`${base}/transcribe`, async (req, reply) => {
    const user = await authenticate(req, db), { uploadId } = transcribeRequestSchema.parse(req.body);
    const { visit } = recordAccess(db, user, req.params.pid, req.params.vid, 'upload_audio');
    return reply.code(202).send(jobAcceptedResponseSchema.parse(jobs.enqueue(user, req.params.pid, req.params.vid, 'transcribe', visit.recordInputVersion, uploadId)));
  });
  app.post<Route>(`${base}/audio`, { bodyLimit: 21 * 1024 * 1024 }, async (req, reply) => {
    const user = await authenticate(req, db);
    recordAccess(db, user, req.params.pid, req.params.vid, 'upload_audio');
    let bytes: Buffer | undefined, mediaType = '';
    for await (const part of req.parts()) {
      if (part.type !== 'file' || part.fieldname !== 'file' || bytes !== undefined) throw new ApiError('bad_request');
      mediaType = part.mimetype;
      if (!['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm'].includes(mediaType)) { part.file.resume(); throw new ApiError('bad_request', 'unsupported_media_type'); }
      bytes = await part.toBuffer();
      if (part.file.truncated) throw new ApiError('bad_request', 'file_too_large');
    }
    if (!bytes?.length) throw new ApiError('bad_request');
    return reply.code(201).send(await saveAudio(db, uploadDir, user, req.params.pid, req.params.vid, mediaType, bytes));
  });
  app.post<Route>(`${base}/share`, async req => shareRecord(db, await authenticate(req, db), req.params.pid, req.params.vid, req.body));
}
