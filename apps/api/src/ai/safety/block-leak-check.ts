import type { BatonDatabase } from '../../adapters/sqlite/database.js';

export const normalizeRestricted = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s/gu, '');
export function fullRestrictedValues(full: unknown): string[] {
  if (!full || typeof full !== 'object') return [];
  const row = full as Record<string, unknown>, values: string[] = [];
  for (const field of ['diagnosis', 'doctorExplanation', 'medReasons', 'answers', 'changeReasons']) {
    if (Array.isArray(row[field])) for (const item of row[field]) if (typeof item?.text === 'string') values.push(item.text);
  }
  if (Array.isArray(row.labResults)) for (const item of row.labResults) {
    if (typeof item?.name === 'string') values.push(item.name);
    if (typeof item?.value === 'string') values.push(item.value + (typeof item.unit === 'string' ? item.unit : ''));
  }
  if (row.briefing) values.push(...fullRestrictedValues(row.briefing));
  return values;
}
/** Internal validation only. Never imported by external GET repositories. */
export function patientRestrictedValues(db: BatonDatabase, patientId: string) {
  const rows = db.prepare("SELECT vb.payload FROM visit_blocks vb JOIN block_sets bs ON bs.id=vb.blockSetId WHERE bs.patientId=? AND vb.kind='full'").all(patientId) as Array<{ payload: string }>;
  return rows.flatMap((row) => fullRestrictedValues(JSON.parse(row.payload)));
}
export function hasRestrictedValue(text: string, values: readonly string[]) {
  const target = normalizeRestricted(text);
  return values.some((value) => { const normalized = normalizeRestricted(value); return normalized.length >= 3 && target.includes(normalized); });
}
