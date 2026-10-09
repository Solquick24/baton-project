import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { mergedQuestionsViewSchema, briefingResponseSchema, noteRequestSchema, recordInputResponseSchema, shareRequestSchema, alertsResponseSchema, homeResponseSchema } from '@baton/contracts';
import { fixtureDatabase, fixturesDir } from './helpers.js';
import { requireMembership, canResolveAlerts, assertAction } from '../src/auth/permissions.js';
import { ApiError } from '../src/shared/errors.js';

const json = (path: string) => JSON.parse(readFileSync(resolve(fixturesDir, path), 'utf8'));
it('enforces full-only blocked questions/briefing and requires full completion metadata', () => {
  const q = json('expected/merge-questions/v_im_03.json');
  const b = json('expected/briefing/v_im_03.json');
  const base = { version: 1, mode: 'fixture', stale: false };
  expect(mergedQuestionsViewSchema.safeParse({ ...base, blocks: { companion: q.companion } }).success).toBe(true);
  expect(mergedQuestionsViewSchema.safeParse({ ...base, state: 'blocked', blocks: { full: q.full } }).success).toBe(true);
  expect(mergedQuestionsViewSchema.safeParse({ ...base, blocks: { full: q.full } }).success).toBe(false);
  expect(mergedQuestionsViewSchema.safeParse({ ...base, state: 'blocked', blocks: { companion: q.companion, full: q.full } }).success).toBe(false);
  const blocked = { ...base, state: 'blocked', blocks: { full: b.full }, questions: [] };
  expect(briefingResponseSchema.safeParse(blocked).success).toBe(true);
  expect(briefingResponseSchema.safeParse({ ...blocked, questions: q.companion.mergedQuestions }).success).toBe(false);
  expect(briefingResponseSchema.safeParse({ ...blocked, blocks: { companion: b.companion, full: b.full } }).success).toBe(false);
});
it('validates trimmed note limits, draft share identity and minimal record-input without raw data', () => {
  expect(noteRequestSchema.parse({ text: '  가상 메모  ' })).toEqual({ text: '가상 메모' });
  for (const text of ['  ', 'a'.repeat(2001)]) expect(noteRequestSchema.safeParse({ text }).success).toBe(false);
  expect(noteRequestSchema.safeParse({ text: 'a'.repeat(2000) }).success).toBe(true);
  expect(shareRequestSchema.safeParse({ draftVersion: 1, inputVersion: 0, idempotencyKey: 'be251a71-6e9f-4b89-bf2e-37b3dd78c7e3' }).success).toBe(true);
  expect(shareRequestSchema.safeParse({ draftVersion: 1, inputVersion: 0, idempotencyKey: 'not-a-uuid' }).success).toBe(false);
  expect(shareRequestSchema.safeParse({ draftVersion: 1, idempotencyKey: 'be251a71-6e9f-4b89-bf2e-37b3dd78c7e3' }).success).toBe(false);
  expect(recordInputResponseSchema.safeParse({ recordInputVersion: 0, canUploadAudio: false }).success).toBe(true);
  expect(recordInputResponseSchema.safeParse({ recordInputVersion: 0, canUploadAudio: false, uploads: [] }).success).toBe(false);
});
it('validates code-derived alerts and rejects scope metadata in the ordinary home contract', () => {
  const db = fixtureDatabase();
  try {
    const rows = db.prepare('SELECT * FROM alerts').all() as Array<Record<string, unknown>>;
    const alerts = rows.map((r) => ({ ...r, references: JSON.parse(r.references as string), differences: JSON.parse(r.differences as string), history: JSON.parse(r.history as string) }));
    expect(alertsResponseSchema.safeParse({ alerts, canResolve: true }).success).toBe(true);
    expect(alertsResponseSchema.safeParse({ alerts }).success).toBe(false);
    const home = { patient: { id: 'p_01', name: '가상 환자' }, me: { role: 'guardian', canManageScopes: false }, depts: [], nextVisit: null, recent: [] };
    expect(homeResponseSchema.safeParse(home).success).toBe(true);
    expect(homeResponseSchema.safeParse({ ...home, me: { ...home.me, scope: 'companion' } }).success).toBe(false);
  } finally { db.close(); }
});
it('separates full alert resolution from delegation-based scope management', () => {
  const db = fixtureDatabase();
  try {
    db.prepare('UPDATE patients SET delegated=0').run();
    const lead = requireMembership(db, 'u_a', 'p_01');
    expect(canResolveAlerts(lead)).toBe(true); expect(() => assertAction(lead, 'resolve_alerts')).not.toThrow();
    expect(() => assertAction(lead, 'manage_scopes')).toThrow(ApiError);
    db.prepare("UPDATE members SET scope='full' WHERE userId='u_b'").run();
    const guardian = requireMembership(db, 'u_b', 'p_01');
    expect(canResolveAlerts(guardian)).toBe(false); expect(() => assertAction(guardian, 'resolve_alerts')).toThrow(ApiError);
    db.prepare("UPDATE members SET scope='companion' WHERE userId='u_a'").run();
    const restricted = requireMembership(db, 'u_a', 'p_01');
    expect(canResolveAlerts(restricted)).toBe(false);
    expect(() => assertAction(restricted, 'resolve_alerts')).toThrow('찾을 수 없어요.');
  } finally { db.close(); }
});
