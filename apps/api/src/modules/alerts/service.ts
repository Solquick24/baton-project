import { randomUUID } from 'node:crypto';
import { alertSchema, alertsResponseSchema, resolveRequestSchema, resolveResponseSchema, type Alert } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { requireMembership, assertAction, canResolveAlerts, canManageScopes, type Membership } from '../../auth/permissions.js';
import { ApiError } from '../../shared/errors.js';
import { stored } from '../../shared/response-assembler.js';
import { compareMedicationFacts, comparisonSummary } from './comparison.js';

type AlertRow = Omit<Alert, 'references' | 'differences' | 'history'> & { references: string; differences: string; history: string };
const parse = (row: AlertRow) => stored(alertSchema, { ...row, references: JSON.parse(row.references), differences: JSON.parse(row.differences), history: JSON.parse(row.history) });
// A generated record alert must not reveal an unpublished draft to another family member.
const visible = `AND (a.kind='observation_vs_prescription' OR EXISTS (
  SELECT 1 FROM json_each(a."references") r JOIN block_sets b ON b.patientId=a.patientId AND b.visitId=a.visitId AND b.section='record' AND b.version=json_extract(r.value,'$.version')
  JOIN visits v ON v.id=b.visitId AND v.patientId=b.patientId WHERE json_extract(r.value,'$.type')='record' AND b.state='ready'
  AND (v.recordPublishedVersion=b.version OR EXISTS (SELECT 1 FROM share_logs l WHERE l.patientId=b.patientId AND l.visitId=b.visitId AND l.version=b.version AND l.action='publish')
    OR (v.recordDraftVersion=b.version AND (?=1 OR b.createdBy=?)))))`;
const args = (member: Membership) => [Number(canManageScopes(member)), member.userId];
function find(db: BatonDatabase, member: Membership, id: string) {
  const row = db.prepare(`SELECT a.* FROM alerts a WHERE a.patientId=? AND a.id=? ${visible}`).get(member.patientId, id, ...args(member)) as AlertRow | undefined;
  if (!row) throw new ApiError('not_found');
  return parse(row);
}
export function listAlerts(db: BatonDatabase, userId: string, patientId: string) {
  const member = requireMembership(db, userId, patientId); assertAction(member, 'read_alerts');
  const rows = db.prepare(`SELECT a.* FROM alerts a WHERE a.patientId=? ${visible} ORDER BY a.visitId,a.id`).all(patientId, ...args(member)) as AlertRow[];
  return stored(alertsResponseSchema, { alerts: rows.map(parse), canResolve: canResolveAlerts(member) });
}
export function countOpenAlerts(db: BatonDatabase, member: Membership, dept: string) {
  assertAction(member, 'read_alerts');
  return (db.prepare(`SELECT count(*) n FROM alerts a JOIN visits v ON v.id=a.visitId AND v.patientId=a.patientId
    WHERE a.patientId=? AND a.dept=? AND v.dept=? AND a.status<>'resolved' ${visible}`).get(member.patientId, dept, dept, ...args(member)) as { n: number }).n;
}
export function resolveAlert(db: BatonDatabase, userId: string, patientId: string, id: string, body: unknown) {
  const member = requireMembership(db, userId, patientId); assertAction(member, 'resolve_alerts');
  const request = resolveRequestSchema.parse(body);
  return db.transaction(() => {
    const alert = find(db, member, id), now = new Date().toISOString();
    if (request.action === 'edit_note') {
      if (alert.kind !== 'observation_vs_prescription') throw new ApiError('bad_request', 'unsupported_action');
      const [left, right] = alert.references;
      if (left.type !== 'observation' || right.type !== 'prescription' || request.fact.drugKey !== right.fact.drugKey) throw new ApiError('bad_request');
      const old = db.prepare('SELECT * FROM observations WHERE id=? AND patientId=? AND dept=?').get(left.id, patientId, alert.dept) as { id: string; text: string; fact: string; date: string; revision: number } | undefined;
      if (!old) throw new ApiError('not_found');
      if (db.prepare('SELECT id FROM observations WHERE supersedesId=? AND patientId=?').get(old.id, patientId)) throw new ApiError('conflict', 'stale_input');
      const text = request.text?.trim() ?? old.text;
      if (!text) throw new ApiError('bad_request');
      if (JSON.stringify(left.fact) === JSON.stringify(request.fact) && old.text === text) return stored(resolveResponseSchema, { alert });
      const observationId = randomUUID();
      db.prepare('INSERT INTO observations (id,patientId,dept,authorId,text,fact,date,revision,supersedesId) VALUES (?,?,?,?,?,?,?,?,?)').run(observationId, patientId, alert.dept, userId, text, JSON.stringify(request.fact), old.date, old.revision + 1, old.id);
      alert.references = [{ type: 'observation', id: observationId, quote: text, fact: request.fact }, right];
      alert.differences = compareMedicationFacts(request.fact, right.fact);
      alert.summary = comparisonSummary(request.fact.drugName, alert.differences, '가족 메모');
      alert.status = alert.differences.length ? 'open' : 'resolved';
    } else alert.status = request.action === 'confirm_hospital' ? 'awaiting_confirmation' : 'open';
    alert.history.push({ action: request.action, by: userId, at: now, note: request.action === 'edit_note' ? request.text ?? null : request.note ?? null });
    alertSchema.parse(alert);
    db.prepare('UPDATE alerts SET "references"=?,differences=?,summary=?,status=?,history=? WHERE id=? AND patientId=?').run(JSON.stringify(alert.references), JSON.stringify(alert.differences), alert.summary, alert.status, JSON.stringify(alert.history), id, patientId);
    return stored(resolveResponseSchema, { alert });
  })();
}
