import { randomUUID } from 'node:crypto';
import { medFactSchema, alertSchema, type MedFact, type Alert, type StoredRecordBlocks } from '@baton/contracts';
import type { BatonDatabase } from '../../adapters/sqlite/database.js';

const timings = { morning: '아침', lunch: '점심', evening: '저녁', bedtime: '취침 전' };
const timingText = (fact: MedFact) => fact.timing === null ? null : [...new Set(fact.timing)].sort().map((t) => timings[t]).join('·');
/** Pure comparison only; neither source is declared correct. */
export function compareMedicationFacts(left: MedFact, right: MedFact): Alert['differences'] {
  medFactSchema.parse(left); medFactSchema.parse(right);
  if (left.drugKey !== right.drugKey) return [];
  const differences: Alert['differences'] = [];
  if (left.dose !== right.dose) differences.push({ field: 'dose', left: left.dose, right: right.dose });
  const a = timingText(left), b = timingText(right);
  if (a !== b) differences.push({ field: 'timing', left: a, right: b });
  return differences;
}
export function comparisonSummary(drug: string, differences: Alert['differences'], origin: '가족 메모' | '정리 결과') {
  return differences.length ? `${drug} ${differences.map((d) => `${d.field === 'dose' ? '복용량' : '복용 시간'}이 다릅니다(${origin}: ${d.left ?? '미확인'} / 약봉투: ${d.right ?? '미확인'})`).join(' · ')}` : `${drug} 비교 항목에 차이가 없습니다`;
}
/** Called only for a validated ready record, inside its completion transaction. */
export function detectRecordAlerts(db: BatonDatabase, patientId: string, visitId: string, version: number, blocks: StoredRecordBlocks, createdAt: string) {
  const visit = db.prepare('SELECT dept FROM visits WHERE patientId=? AND id=?').get(patientId, visitId) as { dept: string } | undefined;
  if (!visit) throw new Error('Missing comparison visit');
  const prescriptions = db.prepare('SELECT id,text,items FROM prescriptions WHERE patientId=? AND visitId=? ORDER BY id').all(patientId, visitId) as Array<{ id: string; text: string; items: string }>;
  for (const detail of blocks.full.medDetails) for (const prescription of prescriptions) {
    const { medChangeId, ...left } = detail;
    const right = (JSON.parse(prescription.items) as unknown[]).map((r) => medFactSchema.parse(r)).find((r) => r.drugKey === left.drugKey);
    if (!right) continue;
    const differences = compareMedicationFacts(left, right);
    if (!differences.length) continue;
    const previous = db.prepare(`SELECT id FROM alerts WHERE patientId=? AND visitId=? AND kind='record_vs_prescription'
      AND json_extract("references",'$[0].version')=? AND json_extract("references",'$[0].itemId')=? AND json_extract("references",'$[1].id')=?`).get(patientId, visitId, version, medChangeId, prescription.id) as { id: string } | undefined;
    const id = previous?.id ?? randomUUID();
    const alert = alertSchema.parse({ id, patientId, visitId, dept: visit.dept, kind: 'record_vs_prescription', references: [
      { type: 'record', visitId, version, itemId: medChangeId, quote: blocks.full.sourceRefs.find((r) => r.itemId === medChangeId)?.quote ?? null, fact: left },
      { type: 'prescription', id: prescription.id, quote: prescription.text, fact: right },
    ], differences, summary: comparisonSummary(left.drugName, differences, '정리 결과'), status: 'open', history: [{ action: 'detected', by: null, at: createdAt, note: null }] });
    if (!previous) db.prepare('INSERT INTO alerts (id,patientId,visitId,dept,kind,"references",differences,summary,status,history) VALUES (?,?,?,?,?,?,?,?,?,?)').run(alert.id, patientId, visitId, alert.dept, alert.kind, JSON.stringify(alert.references), JSON.stringify(alert.differences), alert.summary, alert.status, JSON.stringify(alert.history));
    blocks.companion.medChanges.find((r) => r.id === medChangeId)!.needsCheck = true;
    if (!blocks.full.needsCheckDetails.some((r) => r.itemId === medChangeId && r.alertId === id)) blocks.full.needsCheckDetails.push({ itemId: medChangeId, reason: 'conflict', alertId: id });
  }
}
