import type { FastifyInstance } from 'fastify';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { openSourceFile } from '../adapters/local/files.js';
import { authenticate } from '../auth/session.js';
import { assertAction, requireMembership } from '../auth/permissions.js';
import { ApiError } from '../shared/errors.js';

const audioTypes = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac']);
export function registerSources(app: FastifyInstance, db: BatonDatabase, uploadDir: string) {
  app.get<{ Params: { pid: string; uploadId: string } }>('/api/patients/:pid/sources/:uploadId', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const userId = await authenticate(req, db);
    assertAction(requireMembership(db, userId, req.params.pid), 'read_source');
    const upload = db.prepare(`SELECT u.storagePath,u.mediaType,u.size FROM uploads u
      JOIN visits v ON v.id=u.visitId AND v.patientId=u.patientId WHERE u.id=? AND u.patientId=?`).get(req.params.uploadId, req.params.pid) as {
      storagePath: string; mediaType: string; size: number;
    } | undefined;
    if (!upload) throw new ApiError('not_found');
    const source = await openSourceFile(uploadDir, upload.storagePath, upload.size);
    // Filesystem awaits may outlive a scope change; recheck before sending any bytes.
    try { assertAction(requireMembership(db, userId, req.params.pid), 'read_source'); }
    catch (error) { source.stream.destroy(); throw error; }
    return reply.header('Content-Type', audioTypes.has(upload.mediaType) ? upload.mediaType : 'application/octet-stream')
      .header('Content-Length', source.size).header('X-Content-Type-Options', 'nosniff')
      .header('Content-Disposition', 'attachment; filename="source"').send(source.stream);
  });
}
