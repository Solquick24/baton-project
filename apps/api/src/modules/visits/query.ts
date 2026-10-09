import { homeResponseSchema, mePatientsResponseSchema, timelineResponseSchema } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { readVisit } from '../../adapters/sqlite/visit-repository.js';
import { requireMembership, canManageScopes } from '../../auth/permissions.js';
import { allowedKinds } from '../../auth/block-policy.js';
import { ApiError } from '../../shared/errors.js';
import { countOpenAlerts } from '../alerts/service.js';

export function myPatients(db: BatonDatabase, userId: string) {
  const rows = db.prepare('SELECT p.id,p.name,p.userId FROM patients p JOIN members m ON m.patientId=p.id WHERE m.userId=? AND m.active=1 ORDER BY p.id').all(userId) as Array<{ id: string; name: string; userId: string }>;
  for (const row of rows) requireMembership(db, userId, row.id);
  return mePatientsResponseSchema.parse({ self: { patientId: rows.find((row) => row.userId === userId)?.id ?? null },
    linked: rows.filter((row) => row.userId !== userId).map((row) => ({ patientId: row.id, name: row.name })),
  });
}
function department(db: BatonDatabase, patientId: string, requested: string | undefined, required: boolean) {
  const rows = db.prepare('SELECT DISTINCT dept FROM visits WHERE patientId=? ORDER BY dept').all(patientId) as Array<{ dept: string }>;
  const depts = rows.map((row) => row.dept);
  if ((required && requested === undefined) || (requested !== undefined && !depts.includes(requested))) throw new ApiError('bad_request');
  return { depts, dept: requested ?? depts[0] };
}
function published(db: BatonDatabase, userId: string, patientId: string, dept: string, limit?: number) {
  const rows = db.prepare(`SELECT v.id FROM visits v JOIN block_sets b ON b.visitId=v.id AND b.patientId=v.patientId AND b.section='record' AND b.version=v.recordPublishedVersion AND b.state='ready'
    WHERE v.patientId=? AND v.dept=? ORDER BY v.date DESC,v.time DESC,v.id DESC ${limit === undefined ? '' : 'LIMIT ?'}`).all(patientId, dept, ...(limit === undefined ? [] : [limit])) as Array<{ id: string }>;
  return rows.map((row) => readVisit(db, userId, patientId, row.id));
}
export function timeline(db: BatonDatabase, userId: string, patientId: string, requested?: string) {
  requireMembership(db, userId, patientId);
  const { dept } = department(db, patientId, requested, true);
  return timelineResponseSchema.parse({ items: dept === undefined ? [] : published(db, userId, patientId, dept) });
}
export function home(db: BatonDatabase, userId: string, patientId: string, today: string, requested?: string) {
  const membership = requireMembership(db, userId, patientId);
  const kinds = allowedKinds(membership.scope);
  const { depts, dept } = department(db, patientId, requested, false);
  const patient = db.prepare('SELECT id,name FROM patients WHERE id=?').get(patientId);
  const next = dept === undefined ? undefined : db.prepare("SELECT id,questionsVersion,briefingVersion FROM visits WHERE patientId=? AND dept=? AND date>=? AND status='upcoming' ORDER BY date,time,id LIMIT 1").get(patientId, dept, today) as { id: string; questionsVersion: number | null; briefingVersion: number | null } | undefined;
  const nextVisit = next ? { meta: readVisit(db, userId, patientId, next.id).meta,
    ...(kinds.includes('companion') ? {
      questionCount: (db.prepare(`SELECT count(*) n FROM questions WHERE patientId=? AND visitId=? ${kinds.includes('full') ? '' : "AND visibility='companion'"}`).get(patientId, next.id) as { n: number }).n,
      briefingReady: Boolean(db.prepare("SELECT id FROM block_sets WHERE patientId=? AND visitId=? AND section='briefing' AND version=? AND state='ready'").get(patientId, next.id, next.briefingVersion)),
    } : {}),
  } : null;
  return homeResponseSchema.parse({ patient, me: { role: membership.role, canManageScopes: canManageScopes(membership) }, depts, nextVisit,
    ...(kinds.includes('full') ? { openAlertCount: dept === undefined ? 0 : countOpenAlerts(db, membership, dept) } : {}),
    recent: dept === undefined ? [] : published(db, userId, patientId, dept, 5),
  });
}
