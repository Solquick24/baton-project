import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { audioUploadResponseSchema, noteRequestSchema, noteResponseSchema, recordInputResponseSchema, shareRequestSchema, shareResponseSchema } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { assertAction, canShareDraft, requireMembership } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { ApiError } from '../../shared/errors.js';
import { appendPublishLog } from '../members/service.js';

export function recordAccess(db: BatonDatabase, userId: string, patientId: string, visitId: string, action = 'generate') {
  const member = requireMembership(db, userId, patientId);
  if (action === 'record_input') {
    if (!allowedKinds(member.scope).includes('companion')) throw new ApiError('not_found');
  } else assertAction(member, action);
  const visit = db.prepare('SELECT recordInputVersion,recordDraftVersion FROM visits WHERE patientId=? AND id=?').get(patientId, visitId) as { recordInputVersion: number; recordDraftVersion: number | null } | undefined;
  if (!visit) throw new ApiError('not_found');
  return { member, visit };
}
export function recordInput(db: BatonDatabase, userId: string, patientId: string, visitId: string) {
  const { member, visit } = recordAccess(db, userId, patientId, visitId, 'record_input');
  return recordInputResponseSchema.parse({ recordInputVersion: visit.recordInputVersion, canUploadAudio: member.recordingAllowed === 1 });
}
export function addNote(db: BatonDatabase, userId: string, patientId: string, visitId: string, body: unknown) {
  return db.transaction(() => {
    recordAccess(db, userId, patientId, visitId, 'write_notes');
    const { text } = noteRequestSchema.parse(body), noteId = randomUUID();
    db.prepare('INSERT INTO notes (id,patientId,visitId,authorId,text,createdAt) VALUES (?,?,?,?,?,?)').run(noteId, patientId, visitId, userId, text, new Date().toISOString());
    db.prepare('UPDATE visits SET recordInputVersion=recordInputVersion+1 WHERE patientId=? AND id=?').run(patientId, visitId);
    return noteResponseSchema.parse({ noteId, recordInputVersion: recordAccess(db, userId, patientId, visitId).visit.recordInputVersion });
  }).immediate();
}
export async function saveAudio(db: BatonDatabase, uploadDir: string, userId: string, patientId: string, visitId: string, mediaType: string, bytes: Buffer) {
  recordAccess(db, userId, patientId, visitId, 'upload_audio');
  const uploadId = randomUUID(), path = join(uploadDir, uploadId);
  await mkdir(uploadDir, { recursive: true, mode: 0o700 });
  let written = false, handle: FileHandle | undefined;
  try {
    handle = await open(path, 'wx', 0o600); written = true;
    await handle.writeFile(bytes); await handle.close(); handle = undefined;
    return db.transaction(() => {
      // Recheck after filesystem awaits, before registering any source.
      recordAccess(db, userId, patientId, visitId, 'upload_audio');
      db.prepare('INSERT INTO uploads (id,patientId,visitId,uploaderId,storagePath,mediaType,size,createdAt) VALUES (?,?,?,?,?,?,?,?)').run(uploadId, patientId, visitId, userId, uploadId, mediaType, bytes.length, new Date().toISOString());
      return audioUploadResponseSchema.parse({ uploadId });
    }).immediate();
  } catch (error) { await handle?.close(); if (written) await unlink(path); throw error; }
}

export function shareRecord(db: BatonDatabase, userId: string, patientId: string, visitId: string, body: unknown) {
  return db.transaction(() => {
    const member = requireMembership(db, userId, patientId), request = shareRequestSchema.parse(body);
    const previous = db.prepare('SELECT visitId,draftVersion,inputVersion,publishedVersion,sharedAt FROM share_requests WHERE patientId=? AND actorId=? AND idempotencyKey=?').get(patientId, userId, request.idempotencyKey) as { visitId: string; draftVersion: number; inputVersion: number; publishedVersion: number; sharedAt: string } | undefined;
    if (previous && (previous.visitId !== visitId || previous.draftVersion !== request.draftVersion || previous.inputVersion !== request.inputVersion)) {
      const original = db.prepare("SELECT createdBy FROM block_sets WHERE patientId=? AND visitId=? AND section='record' AND version=?").get(patientId, previous.visitId, previous.draftVersion) as { createdBy: string } | undefined;
      if (!original || !canShareDraft(member, original.createdBy)) throw new ApiError('forbidden', 'not_author');
      throw new ApiError('conflict', 'idempotency_conflict');
    }
    const visit = db.prepare('SELECT recordDraftVersion,recordInputVersion FROM visits WHERE patientId=? AND id=?').get(patientId, visitId) as { recordDraftVersion: number | null; recordInputVersion: number } | undefined;
    if (!visit) throw new ApiError('not_found');
    const draft = db.prepare("SELECT createdBy,inputVersion,state FROM block_sets WHERE patientId=? AND visitId=? AND section='record' AND version=?").get(patientId, visitId, request.draftVersion) as { createdBy: string; inputVersion: number; state: string } | undefined;
    if (!draft) throw new ApiError('conflict', 'not_ready');
    if (!canShareDraft(member, draft.createdBy)) throw new ApiError('forbidden', 'not_author');
    if (request.draftVersion !== visit.recordDraftVersion || request.inputVersion !== draft.inputVersion || draft.inputVersion !== visit.recordInputVersion) throw new ApiError('conflict', 'stale_input');
    if (draft.state === 'blocked') throw new ApiError('conflict', 'blocked');
    if (draft.state !== 'ready') throw new ApiError('conflict', 'not_ready');
    if (previous) return shareResponseSchema.parse({ publishedVersion: previous.publishedVersion, sharedAt: previous.sharedAt, alreadyPublished: true });
    const published = db.prepare("SELECT at FROM share_logs WHERE patientId=? AND visitId=? AND version=? AND action='publish' ORDER BY at LIMIT 1").get(patientId, visitId, request.draftVersion) as { at: string } | undefined;
    const sharedAt = published?.at ?? new Date().toISOString();
    if (!published) {
      // Only the public pointer changes; the validated immutable blocks are reused.
      db.prepare("UPDATE visits SET recordPublishedVersion=?,status='done' WHERE patientId=? AND id=?").run(request.draftVersion, patientId, visitId);
      appendPublishLog(db, userId, patientId, visitId, request.draftVersion, sharedAt);
    }
    db.prepare('INSERT INTO share_requests (patientId,actorId,idempotencyKey,visitId,draftVersion,inputVersion,publishedVersion,sharedAt) VALUES (?,?,?,?,?,?,?,?)').run(patientId, userId, request.idempotencyKey, visitId, request.draftVersion, request.inputVersion, request.draftVersion, sharedAt);
    return shareResponseSchema.parse({ publishedVersion: request.draftVersion, sharedAt, alreadyPublished: Boolean(published) });
  }).immediate();
}
