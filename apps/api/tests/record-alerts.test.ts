import { afterEach, expect, it } from 'vitest';
import { compareMedicationFacts } from '../src/modules/alerts/comparison.js';
import { expected } from './phase3-helpers.js';
import { phase5 } from './phase5-helpers.js';
let ctx: Awaited<ReturnType<typeof phase5>> | undefined;
afterEach(async () => { await ctx?.close(); ctx = undefined; });
it('compares only the same drugKey and treats timing as sorted sets without selecting the correct source', () => {
  const fact = expected('alerts.json').alerts[0].references[0].fact;
  expect(compareMedicationFacts({ ...fact, timing: ['morning', 'evening', 'morning'] }, { ...fact, timing: ['evening', 'morning'] })).toEqual([]);
  expect(compareMedicationFacts(fact, { ...fact, drugKey: 'other_virtual_drug', dose: '9정' })).toEqual([]);
  expect(compareMedicationFacts({ ...fact, dose: null }, fact)).toEqual([{ field: 'dose', left: null, right: '0.5정' }]);
});
it('creates exactly zero new alerts for the normal ready structure fixture', async () => {
  ctx = await phase5(); expect((await ctx.structure()).resultState).toBe('ready');
  expect(ctx.db.prepare("SELECT count(*) n FROM alerts WHERE kind='record_vs_prescription'").get()).toEqual({ n: expected('alerts.json').afterStructure.newAlerts });
});
it('compares grounded record facts, protects unpublished alerts/counts and rejects editing a record as an observation', async () => {
  ctx = await phase5();
  // Inject a conflicting virtual prescription before the snapshot; transcript remains 0.5정.
  ctx.db.prepare("UPDATE prescriptions SET items=?,text=? WHERE id='rx_im_03'").run(JSON.stringify([{ drugKey: 'batodipine', drugName: '바토디핀정 5mg', dose: '1정', timing: ['morning'] }]), '바토디핀정 5mg 아침 1정');
  expect(await ctx.structure()).toMatchObject({ status: 'succeeded', resultState: 'ready' });
  const rows = ctx.db.prepare("SELECT id FROM alerts WHERE kind='record_vs_prescription'").all() as { id: string }[];
  expect(rows).toHaveLength(1); const id = rows[0]!.id, url = `/api/patients/p_01/alerts/${id}/resolve`;
  expect((await ctx.request('u_a', '/api/patients/p_01/alerts')).json().alerts).toHaveLength(1);
  expect((await ctx.request('u_a', '/api/patients/p_01/home?dept=내과')).json().openAlertCount).toBe(1);
  expect((await ctx.request('u_a', url, 'POST', { action: 'confirm_hospital' })).statusCode).toBe(404);
  const full = (await ctx.request('u_patient', '/api/patients/p_01/alerts')).json().alerts.find((a: any) => a.id === id);
  expect(full).toMatchObject({ kind: 'record_vs_prescription', differences: [{ field: 'dose', left: '0.5정', right: '1정' }] });
  expect(full.references.map((r: any) => r.type)).toEqual(['record', 'prescription']);
  expect((await ctx.request('u_patient', url, 'POST', { action: 'edit_note', fact: full.references[0].fact })).json().error.reason).toBe('unsupported_action');
  const draft = (await ctx.request('u_b', `${ctx.base}?view=draft`)).json().record;
  expect(draft.blocks.companion.medChanges[0].needsCheck).toBe(true); expect(draft.shareable).toBe(true);
  expect((await ctx.structure()).resultVersion).toBe(1);
  expect(ctx.db.prepare("SELECT count(*) n FROM alerts WHERE kind='record_vs_prescription'").get()).toEqual({ n: 1 });
  expect((await ctx.request('u_b', `${ctx.base}/share`, 'POST', { draftVersion: 1, inputVersion: 1, idempotencyKey: '00000000-0000-4000-8000-000000000044' })).statusCode).toBe(200);
  expect((await ctx.request('u_a', '/api/patients/p_01/alerts')).json().alerts).toHaveLength(2);
});
