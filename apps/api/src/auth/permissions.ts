import { z } from 'zod';
import { roleSchema, scopeSchema } from '@baton/contracts';
import type { BatonDatabase } from '../adapters/sqlite/database.js';
import { ApiError } from '../shared/errors.js';
import { allowedKinds } from './block-policy.js';

const membershipSchema = z.strictObject({ patientId: z.string(), userId: z.string(), role: roleSchema, scope: scopeSchema,
  active: z.literal(1), patientUserId: z.string(), leadUserId: z.string(), delegated: z.union([z.literal(0), z.literal(1)]), recordingAllowed: z.union([z.literal(0), z.literal(1)]),
});
export type Membership = z.infer<typeof membershipSchema>;
export function requireMembership(db: BatonDatabase, userId: string, patientId: string): Membership {
  const row = db.prepare(`SELECT m.patientId,m.userId,m.role,m.scope,m.active,p.userId patientUserId,p.leadUserId,p.delegated,p.recordingAllowed
    FROM members m JOIN patients p ON p.id=m.patientId WHERE m.patientId=? AND m.userId=? AND m.active=1`).get(patientId, userId);
  const result = membershipSchema.safeParse(row);
  if (!result.success) throw new ApiError('forbidden');
  const m = result.data;
  if (m.role === 'patient' && (m.userId !== m.patientUserId || m.scope !== 'full')) throw new ApiError('forbidden');
  if (m.role === 'lead' && m.userId !== m.leadUserId) throw new ApiError('forbidden');
  return m;
}
export function canManageScopes(m: Membership) {
  return m.role === 'patient' && m.userId === m.patientUserId || m.role === 'lead' && m.userId === m.leadUserId && m.delegated === 1;
}
export function canShareDraft(m: Membership, createdBy: string) {
  return canManageScopes(m) || createdBy === m.userId && allowedKinds(m.scope).includes('companion');
}
export function assertAction(m: Membership, action: string) {
  const has = (kind: 'schedule' | 'companion' | 'full') => allowedKinds(m.scope).includes(kind);
  switch (action) {
    case 'read': if (has('schedule')) return; break;
    case 'manage_scopes': case 'read_share_log': if (canManageScopes(m)) return; break;
    case 'read_source': if (has('full')) return; break;
    case 'read_alerts': if (has('full')) return; throw new ApiError('not_found');
    case 'generate': case 'write_questions': case 'write_notes': if (has('companion')) return; break;
    case 'read_questions': case 'read_briefing': if (has('companion')) return; throw new ApiError('not_found');
    case 'upload_audio': if (!m.recordingAllowed) throw new ApiError('forbidden', 'recording_not_allowed'); if (has('companion')) return; break;
  }
  throw new ApiError('forbidden');
}
