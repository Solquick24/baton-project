import { type BlockKind, type Mode, type VisitView } from '@baton/contracts';
import type { BatonDatabase } from './database.js';
import { requireMembership, canShareDraft } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { ApiError } from '../../shared/errors.js';
import { assembleRecordBlocks, assembleVisit, parseIssues } from '../../shared/response-assembler.js';

export function readVisit(db: BatonDatabase, userId: string, patientId: string, visitId: string, view: 'published' | 'draft' = 'published'): VisitView {
  if (view !== 'published' && view !== 'draft') throw new ApiError('bad_request');
  const member = requireMembership(db, userId, patientId);
  const v = db.prepare(`SELECT v.id,v.patientId,v.date,v.time,v.dept,v.status,v.recordDraftVersion,v.recordPublishedVersion,v.recordInputVersion,
    h.id hospitalId,h.name hospitalName,u.id companionId,u.name companionName
    FROM visits v JOIN hospitals h ON h.id=v.hospitalId LEFT JOIN users u ON u.id=v.companionUserId WHERE v.id=? AND v.patientId=?`).get(visitId, patientId) as {
    id: string; patientId: string; date: string; time: string | null; dept: string; status: string;
    recordDraftVersion: number | null; recordPublishedVersion: number | null; recordInputVersion: number;
    hospitalId: string; hospitalName: string; companionId: string | null; companionName: string | null;
  } | undefined;
  if (!v) throw new ApiError('not_found');
  const meta = { id: v.id, patientId: v.patientId, date: v.date, time: v.time, dept: v.dept, status: v.status,
    hospital: { id: v.hospitalId, name: v.hospitalName }, companion: v.companionId ? { userId: v.companionId, name: v.companionName } : null };
  const version = view === 'published' ? v.recordPublishedVersion : v.recordDraftVersion;
  if (version === null) {
    if (view === 'draft') throw new ApiError('not_found');
    return assembleVisit(meta);
  }
  const set = db.prepare(`SELECT id,version,mode,state,createdBy,inputVersion FROM block_sets WHERE visitId=? AND patientId=? AND section='record' AND version=?`).get(visitId, patientId, version) as { id: string; version: number; mode: Mode; state: 'generating' | 'ready' | 'blocked' | 'failed'; createdBy: string; inputVersion: number } | undefined;
  if (!set) throw new ApiError('not_found');
  if (view === 'draft' && !canShareDraft(member, set.createdBy)) throw new ApiError('forbidden');
  if (view === 'published' && set.state !== 'ready') throw new ApiError('not_found');
  if (set.state === 'failed' || set.state === 'generating') throw new ApiError('not_found');
  const baseKinds = allowedKinds(member.scope);
  const kinds = set.state === 'blocked' ? baseKinds.filter((kind) => kind === 'full') : baseKinds;
  const placeholders = kinds.map(() => '?').join(',');
  const rows = kinds.length ? db.prepare(`SELECT kind,payload FROM visit_blocks WHERE blockSetId=? AND kind IN (${placeholders}) ORDER BY CASE kind WHEN 'schedule' THEN 0 WHEN 'companion' THEN 1 ELSE 2 END`).all(set.id, ...kinds) as Array<{ kind: BlockKind; payload: string }> : [];
  const base = { version: set.version, mode: set.mode, blocks: assembleRecordBlocks(rows) };
  const record: NonNullable<VisitView['record']> = view === 'draft' ? {
    ...base, view, inputVersion: set.inputVersion, stale: set.inputVersion !== v.recordInputVersion, state: set.state,
    shareable: set.state === 'ready' && set.inputVersion === v.recordInputVersion && canShareDraft(member, set.createdBy),
    issues: parseIssues(db.prepare(`SELECT j.value FROM block_sets b,json_each(b.issues) j WHERE b.id=? AND json_extract(j.value,'$.blockKind') IN (${baseKinds.map(() => '?').join(',')})`).all(set.id, ...baseKinds) as Array<{ value: string }>),
  } : { ...base, view };
  return assembleVisit(meta, record);
}
