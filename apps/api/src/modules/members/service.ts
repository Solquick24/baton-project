import { randomUUID } from 'node:crypto';
import { changeScopeRequestSchema, changeScopeResponseSchema, memberSchema, membersResponseSchema, shareLogsResponseSchema } from '@baton/contracts';
import type { z } from 'zod';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';
import { assertAction, requireMembership } from '../../auth/permissions.js';
import { ApiError } from '../../shared/errors.js';

type MemberRow = Omit<z.infer<typeof memberSchema>, 'active'> & { active: number };
/** Called inside the record share transaction after current draft authorization. */
export function appendPublishLog(db: BatonDatabase, actorId: string, patientId: string, visitId: string, version: number, at: string) {
  db.prepare(`INSERT INTO share_logs (id,patientId,targetUserId,actorId,action,oldScope,newScope,visitId,version,at)
    VALUES (?,?,NULL,?,'publish',NULL,NULL,?,?,?)`).run(randomUUID(), patientId, actorId, visitId, version, at);
}
const memberColumns = 'm.userId,u.name,m.relation,m.role,m.scope,m.active';
function manager(db: BatonDatabase, actorId: string, patientId: string) {
  assertAction(requireMembership(db, actorId, patientId), 'manage_scopes');
}
function member(db: BatonDatabase, patientId: string, userId: string) {
  const row = db.prepare(`SELECT ${memberColumns} FROM members m JOIN users u ON u.id=m.userId WHERE m.patientId=? AND m.userId=?`).get(patientId, userId) as MemberRow | undefined;
  if (!row) throw new ApiError('not_found');
  return memberSchema.parse({ ...row, active: row.active === 1 });
}
export function members(db: BatonDatabase, actorId: string, patientId: string) {
  manager(db, actorId, patientId);
  const rows = db.prepare(`SELECT ${memberColumns} FROM members m JOIN users u ON u.id=m.userId WHERE m.patientId=? ORDER BY m.userId`).all(patientId) as MemberRow[];
  return membersResponseSchema.parse({ members: rows.map(row => ({ ...row, active: row.active === 1 })) });
}
export function changeScope(db: BatonDatabase, actorId: string, patientId: string, userId: string, input: unknown) {
  return db.transaction(() => {
    // Authority, current target, update, audit and response validation share one transaction.
    manager(db, actorId, patientId);
    const { scope } = changeScopeRequestSchema.parse(input);
    const target = member(db, patientId, userId);
    if (!target.active) throw new ApiError('not_found');
    if (target.role === 'patient') throw new ApiError('bad_request');
    if (target.scope !== scope) {
      db.prepare('UPDATE members SET scope=? WHERE patientId=? AND userId=? AND active=1').run(scope, patientId, userId);
      db.prepare(`INSERT INTO share_logs (id,patientId,targetUserId,actorId,action,oldScope,newScope,visitId,version,at)
        VALUES (?,?,?,?,'scope_change',?,?,NULL,NULL,?)`).run(randomUUID(), patientId, userId, actorId, target.scope, scope, new Date().toISOString());
    }
    return changeScopeResponseSchema.parse({ member: member(db, patientId, userId) });
  }).immediate();
}
export function shareLogs(db: BatonDatabase, actorId: string, patientId: string, targetUserId?: string) {
  manager(db, actorId, patientId);
  // Historical logs remain readable for an inactive member; scope changes cannot reactivate them.
  if (targetUserId !== undefined) member(db, patientId, targetUserId);
  const rows = db.prepare(`SELECT l.id,l.targetUserId,l.actorId,u.name actorName,l.action,l.oldScope,l.newScope,l.visitId,l.version,l.at
    FROM share_logs l JOIN users u ON u.id=l.actorId WHERE l.patientId=?
    ${targetUserId === undefined ? '' : "AND l.targetUserId=? AND l.action IN ('start','scope_change','stop')"}
    ORDER BY julianday(l.at) DESC,l.id DESC`).all(patientId, ...(targetUserId === undefined ? [] : [targetUserId])) as Array<{
      id: string; targetUserId: string | null; actorId: string; actorName: string; action: string;
      oldScope: string | null; newScope: string | null; visitId: string | null; version: number | null; at: string;
    }>;
  return shareLogsResponseSchema.parse({ logs: rows.map(row => ({
    id: row.id, targetUserId: row.targetUserId, actor: { userId: row.actorId, name: row.actorName },
    action: row.action, oldScope: row.oldScope, newScope: row.newScope, visitId: row.visitId, version: row.version, at: row.at,
  })) });
}
