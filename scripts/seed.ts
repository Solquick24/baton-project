import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { idSchema as id, dateSchema, dateTimeSchema, timeSchema, roleSchema, scopeSchema, medFactSchema, seedRecordSchema, inputVersionSchema, versionSchema, type MedFact } from '@baton/contracts';
import { openDatabase, type BatonDatabase } from '../apps/api/src/adapters/sqlite/database.js';
import { loadApiEnv, readConfig } from '../apps/api/src/shared/config.js';
import { hashPassword } from '../apps/api/src/shared/password.js';

const str = z.string();
const root = <S extends z.ZodRawShape>(shape: S) => z.strictObject({ _note: str, ...shape });
const user = z.strictObject({ id, email: z.email(), name: str, testOnly: z.boolean() });
const patient = z.strictObject({ id, name: str, userId: id, leadUserId: id, delegated: z.boolean(), recordingAllowed: z.boolean() });
const member = z.strictObject({ patientId: id, userId: id, role: roleSchema, scope: scopeSchema, active: z.boolean(), relation: str });
const shareLog = z.strictObject({ id, patientId: id, targetUserId: id.nullable(), actorId: id, action: z.enum(['start', 'scope_change', 'stop', 'publish']), oldScope: scopeSchema.nullable(), newScope: scopeSchema.nullable(), visitId: id.nullable(), version: versionSchema.nullable(), at: dateTimeSchema });
const visit = z.strictObject({ id, patientId: id, dept: str.min(1), hospitalId: id, date: dateSchema, time: timeSchema.nullable(), companionUserId: id.nullable(), status: z.enum(['upcoming', 'done']), recordInputVersion: inputVersionSchema, recordDraftVersion: versionSchema.nullable(), recordPublishedVersion: versionSchema.nullable(), questionsInputVersion: inputVersionSchema, questionsVersion: versionSchema.nullable(), briefingVersion: versionSchema.nullable() });
const observation = z.strictObject({ id, patientId: id, dept: str.min(1), authorId: id, text: str, fact: medFactSchema.nullable(), date: dateSchema, revision: versionSchema, supersedesId: id.nullable() });
const prescription = z.strictObject({ id, patientId: id, visitId: id, uploadId: id.nullable(), source: z.literal('seed'), items: z.array(medFactSchema), text: str });
const question = z.strictObject({ id, patientId: id, visitId: id, authorId: id, text: str.min(1).max(200), visibility: z.enum(['companion', 'full']), createdAt: dateTimeSchema });
const hospital = z.strictObject({ id, name: str, address: str, phone: str, mapImage: str, floorImage: str,
  guideSteps: z.array(z.strictObject({ order: versionSchema, place: str, floor: str })),
  experiences: z.array(z.strictObject({ id, order: z.array(str), waitBand: z.enum(['10분 이내', '30분', '1시간 이상']), tip: str })), notice: str,
});
function load<S extends z.ZodType>(directory: string, file: string, schema: S): z.output<S> {
  return schema.parse(JSON.parse(readFileSync(resolve(directory, 'seed', file), 'utf8')));
}

/** Trusted, schema-validated fixture rows only. Values are bound; identifiers are local. */
function insert(db: BatonDatabase, table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  if (![table, ...columns].every((key) => /^[a-zA-Z_]+$/.test(key))) throw new Error('Invalid seed identifier');
  const values = Object.values(row).map((v) => typeof v === 'boolean' ? Number(v) : v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
  db.prepare(`INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...values);
}
const timings: Record<string, string> = { morning: '아침', lunch: '점심', evening: '저녁', bedtime: '취침 전' };
const timingText = (fact: MedFact) => fact.timing === null ? null : [...new Set(fact.timing)].sort().map((t) => timings[t]).join('·');

export function assertSeedOptions(options: { pregenerate?: boolean }) {
  if (options.pregenerate) throw new Error('--pregenerate는 T023(질문 통합)·T024(브리핑) 파이프라인 구현 후 사용할 수 있어요. DB는 변경하지 않았습니다.');
}
/** Rebuilds base fixtures atomically. Pregeneration requires T023/T024. */
export function seedDatabase(db: BatonDatabase, options: { fixturesDir: string; pregenerate?: boolean }) {
  assertSeedOptions(options);
  const dir = options.fixturesDir;
  const accounts = load(dir, 'accounts.json', root({ demoPassword: str, users: z.array(user) }));
  const patients = load(dir, 'patient.json', root({ patients: z.array(patient), members: z.array(member), shareLogs: z.array(shareLog) }));
  const hospitals = load(dir, 'hospital.json', root({ hospitals: z.array(hospital) }));
  const visits = load(dir, 'visits.json', root({ visits: z.array(visit) })).visits;
  const records = load(dir, 'records.json', root({ blockSets: z.array(seedRecordSchema) })).blockSets;
  const observations = load(dir, 'observations.json', root({ observations: z.array(observation) })).observations;
  const prescriptions = load(dir, 'prescriptions.json', root({ prescriptions: z.array(prescription) })).prescriptions;
  const questions = load(dir, 'questions.json', root({ questions: z.array(question) })).questions;
  const passwords = new Map(accounts.users.map((u) => [u.id, hashPassword(accounts.demoPassword)]));
  return db.transaction(() => {
    for (const table of ['visit_blocks', 'block_sets', 'jobs', 'share_requests', 'share_logs', 'transcripts', 'prescriptions', 'questions', 'notes', 'alerts', 'observations', 'uploads', 'visits', 'members', 'patients', 'hospitals', 'users']) db.exec(`DELETE FROM ${table}`);
    for (const u of accounts.users) insert(db, 'users', { ...u, passwordHash: passwords.get(u.id) });
    for (const h of hospitals.hospitals) insert(db, 'hospitals', h);
    for (const p of patients.patients) insert(db, 'patients', p);
    for (const m of patients.members) insert(db, 'members', m);
    for (const v of visits) insert(db, 'visits', v);
    for (const r of records) {
      const v = visits.find((v) => v.id === r.visitId);
      if (!v) throw new Error('시드 진료 연결을 확인해 주세요.');
      const setId = `seed_${r.visitId}_${r.version}`;
      insert(db, 'block_sets', { id: setId, patientId: v.patientId, visitId: r.visitId, section: r.section, version: r.version, inputVersion: r.inputVersion, state: r.state, mode: r.mode, createdBy: r.createdBy, createdAt: r.createdAt, issues: r.issues });
      for (const kind of ['schedule', 'companion', 'full'] as const) insert(db, 'visit_blocks', { blockSetId: setId, kind, payload: r.blocks[kind] });
      const transcript = r.blocks.full.transcript;
      if (transcript) insert(db, 'transcripts', { id: transcript.transcriptId, patientId: v.patientId, visitId: v.id, uploadId: transcript.uploadId, mode: transcript.mode, segments: transcript.segments, createdAt: r.createdAt });
    }
    for (const q of questions) insert(db, 'questions', q);
    for (const o of observations) insert(db, 'observations', o);
    for (const p of prescriptions) insert(db, 'prescriptions', p);
    for (const log of patients.shareLogs) insert(db, 'share_logs', log);
    let alertCount = 0;
    for (const o of observations) {
      if (!o.fact) continue;
      const candidates = prescriptions.flatMap((p) => {
        const v = visits.find((v) => v.id === p.visitId && v.patientId === o.patientId && v.dept === o.dept && v.date <= o.date);
        const fact = p.items.find((f) => f.drugKey === o.fact?.drugKey);
        return v && fact ? [{ p, v, fact }] : [];
      }).sort((a, b) => b.v.date.localeCompare(a.v.date));
      const match = candidates[0];
      if (!match) continue;
      const differences: Array<{ field: 'dose' | 'timing'; left: string | null; right: string | null }> = [];
      if (o.fact.dose !== match.fact.dose) differences.push({ field: 'dose', left: o.fact.dose, right: match.fact.dose });
      const left = timingText(o.fact), right = timingText(match.fact);
      if (left !== right) differences.push({ field: 'timing', left, right });
      if (!differences.length) continue;
      const description = differences.map((d) => `${d.field === 'dose' ? '복용량' : '복용 시간'}이 다릅니다(가족 메모: ${d.left ?? '미확인'} / 약봉투: ${d.right ?? '미확인'})`).join(' · ');
      insert(db, 'alerts', { id: randomUUID(), patientId: o.patientId, visitId: match.v.id, dept: o.dept, kind: 'observation_vs_prescription',
        references: [{ type: 'observation', id: o.id, quote: o.text, fact: o.fact }, { type: 'prescription', id: match.p.id, quote: match.p.text, fact: match.fact }],
        differences, summary: `${o.fact.drugName} ${description}`, status: 'open', history: [{ action: 'detected', by: null, at: new Date().toISOString(), note: null }],
      });
      alertCount++;
    }
    return { users: accounts.users.length, visits: visits.length, records: records.length, alerts: alertCount };
  })();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--pregenerate')) throw new Error('사용할 수 없는 seed 옵션이에요.');
    assertSeedOptions({ pregenerate: args.includes('--pregenerate') });
    loadApiEnv();
    const config = readConfig();
    const db = openDatabase(config.sqlitePath);
    try { console.log('기본 가상 시드 생성 완료:', seedDatabase(db, { fixturesDir: config.fixturesDir })); }
    finally { db.close(); }
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('--pregenerate') ? error.message : '기본 시드 생성에 실패했어요. 자료와 DB 설정을 확인해 주세요.');
    process.exitCode = 1;
  }
}
