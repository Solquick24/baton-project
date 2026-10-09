import type { Mode } from '@baton/contracts';
import type { BatonDatabase } from './database.js';
import { requireMembership } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { ApiError } from '../../shared/errors.js';

export function visitContext(db: BatonDatabase, patientId: string, visitId: string) {
  const row = db.prepare('SELECT id,dept,questionsInputVersion,questionsVersion,briefingVersion FROM visits WHERE id=? AND patientId=?').get(visitId, patientId) as {
    id: string; dept: string; questionsInputVersion: number; questionsVersion: number | null; briefingVersion: number | null;
  } | undefined;
  if (!row) throw new ApiError('not_found');
  return row;
}
/** External saved-result reads only. No imports from generation, provider or safety repositories. */
export function readPrevisitSet(db: BatonDatabase, userId: string, patientId: string, visitId: string, section: 'questions' | 'briefing', version: number | null) {
  const member = requireMembership(db, userId, patientId), allowed = allowedKinds(member.scope);
  if (!allowed.includes('companion')) throw new ApiError('not_found');
  if (version === null) return null;
  const set = db.prepare("SELECT id,version,inputVersion,mode,state FROM block_sets WHERE patientId=? AND visitId=? AND section=? AND version=? AND state IN ('ready','blocked')").get(patientId, visitId, section, version) as {
    id: string; version: number; inputVersion: number; mode: Mode; state: 'ready' | 'blocked';
  } | undefined;
  if (!set || set.state === 'blocked' && !allowed.includes('full')) return null;
  const kinds = allowed.filter((kind) => kind !== 'schedule' && (set.state !== 'blocked' || kind === 'full'));
  const rows = db.prepare(`SELECT kind,payload FROM visit_blocks WHERE blockSetId=? AND kind IN (${kinds.map(() => '?').join(',')}) ORDER BY CASE kind WHEN 'companion' THEN 0 ELSE 1 END`).all(set.id, ...kinds) as Array<{ kind: string; payload: string }>;
  if (rows.length !== kinds.length) throw new Error('Missing completed blocks');
  return { ...set, rows };
}
