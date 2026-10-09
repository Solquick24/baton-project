import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../apps/api/src/adapters/sqlite/database.js';
import { loadGenerationInput } from '../apps/api/src/adapters/sqlite/generation-repository.js';
import { patientRestrictedValues, fullRestrictedValues, hasRestrictedValue, stringValues } from '../apps/api/src/ai/safety/block-leak-check.js';
import { validatePrevisit, validateRecord } from '../apps/api/src/ai/safety/output-validator.js';
import { FixtureTranscription } from '../apps/api/src/adapters/ai/fixture.js';
import { seedDatabase } from './seed.js';
import { pregenerateDatabase } from './pregenerate.js';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));
const read = (file: string) => JSON.parse(readFileSync(resolve(fixtures, file), 'utf8'));
/** Small deterministic validator evaluation; never a live model-quality score. No .env or development DB. */
export async function evaluateFixtures() {
  const db = openDatabase(':memory:');
  try {
    seedDatabase(db, { fixturesDir: fixtures });
    await pregenerateDatabase(db, fixtures);
    const tr = await new FixtureTranscription(fixtures).transcribe({ patientId:'p_01', visitId:'v_im_03', attempt:1 });
    // Validator input setup only; this is not a product STT success claim.
    db.prepare('INSERT INTO transcripts VALUES (?,?,?,?,?,?,?)').run('tr_eval','p_01','v_im_03',null,'fixture',JSON.stringify(tr.segments),new Date().toISOString());
    const restricted = patientRestrictedValues(db,'p_01');
    const cases = read('expected/validation.json').cases.map((c: {file:string;expectedState:string;expectedIssues:unknown}) => {
      const section = c.file.startsWith('structure/') ? 'record' : c.file.startsWith('briefing/') ? 'briefing' : 'questions';
      const raw = read(`expected/${c.file}`), input = loadGenerationInput(db,'u_b','p_01','v_im_03',section);
      const result = section === 'record' ? validateRecord(raw,input,restricted) : validatePrevisit(section,raw,input,restricted);
      const restrictedValues = [...restricted,...fullRestrictedValues(raw.full)];
      const leaks = (b: unknown) => stringValues(b).some(v => hasRestrictedValue(v,restrictedValues));
      const beforeLeak = leaks([raw.schedule,raw.companion]);
      // blocked low blocks are withheld, not sanitized and exposed.
      const afterLeak = result.state === 'ready' && leaks([result.blocks.schedule,result.blocks.companion]);
      const matches = result.state === c.expectedState && JSON.stringify(result.issues) === JSON.stringify(c.expectedIssues);
      return { file:c.file, expectedState:c.expectedState, actualState:result.state, issues:result.issues, matches, beforeLeak, afterLeak };
    });
    const alerts = db.prepare('SELECT patientId,visitId,dept,kind,"references",differences,summary,status FROM alerts ORDER BY visitId').all() as Array<Record<string,string>>;
    const actualAlerts = alerts.map(a => ({...a,references:JSON.parse(a.references!),differences:JSON.parse(a.differences!)}));
    const gold = read('expected/alerts.json');
    const alertsMatch = JSON.stringify(actualAlerts) === JSON.stringify(gold.alerts);
    const seedSets=read('seed/records.json').blockSets;
    let grounded=0,totalFacts=0;
    for (const set of seedSets) {
      const refs=set.blocks.full.sourceRefs as Array<{itemId:string}>;
      function walk(v: unknown) {
        if(Array.isArray(v)){v.forEach(walk);return;}
        if(!v || typeof v!=='object') return;
        const row=v as Record<string,unknown>;
        if(typeof row.id==='string' && typeof row.needsCheck==='boolean') {
          totalFacts++; if(refs.some(r=>r.itemId===row.id) || row.needsCheck===true && (row.text===null || row.value===null || row.date===null)) grounded++;
        }
        Object.values(row).forEach(walk);
      }
      walk(set.blocks);
    }
    // Separate challenge, excluded from n=4. This deliberately demonstrates a semantic limitation.
    const paraphrase=read('expected/structure/v_im_03.json');
    // Korean paraphrase of the full-only virtual diagnosis, not an exact restricted token.
    paraphrase.companion.easySummary[0].text='케이 원이라는 가상의 질환에 관한 설명이 있었어요.';
    const challenge=validateRecord(paraphrase,loadGenerationInput(db,'u_b','p_01','v_im_03','record'),restricted);
    return { mode:'fixture', scope:'T065 reduced validator evaluation', validation:{passed:cases.filter((c:{matches:boolean})=>c.matches).length,total:cases.length,cases},
      leakage:{unit:'fixture cases containing restricted exact values in low blocks',before:{numerator:cases.filter((c:{beforeLeak:boolean})=>c.beforeLeak).length,denominator:cases.length},after:{numerator:cases.filter((c:{afterLeak:boolean})=>c.afterLeak).length,denominator:cases.length},blockedPositive:{detected:cases.filter((c:{beforeLeak:boolean;actualState:string})=>c.beforeLeak && c.actualState==='blocked').length,total:cases.filter((c:{beforeLeak:boolean})=>c.beforeLeak).length}},
      alerts:{detected:actualAlerts.length,expected:gold.alerts.length,exactMatch:alertsMatch},
      seedEvidence:{covered:grounded,total:totalFacts,definition:'item sourceRef present or null core value with needsCheck; not semantic entailment'},
      separateChallenges:[{id:'paraphrase-diagnosis',denominator:1,expected:'blocked',actual:challenge.state,passed:challenge.state==='blocked',limitation:'Known paraphrase leakage is not reliably detected by exact-string/source-anchor rules; excluded from the four golden fixtures.'}],
      notPerformed:['20-document extraction evaluation','live OpenAI quality/medical accuracy','real STT accuracy','document correction rate'] };
  } finally { db.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if(process.env.LLM_MODE!=='fixture' || process.env.STT_MODE!=='fixture') throw new Error('Run with LLM_MODE=fixture STT_MODE=fixture');
  globalThis.fetch=async()=>{throw new Error('External HTTP disabled for reduced evaluation');};
  const report=await evaluateFixtures();
  assert.equal(report.validation.passed,4); assert.equal(report.validation.total,4); assert.equal(report.alerts.exactMatch,true);
  const json=JSON.stringify(report,null,2)+'\n';
  const index=process.argv.indexOf('--report'); if(index>=0) {if(!process.argv[index+1]) throw new Error('Missing report path');writeFileSync(resolve(process.argv[index+1]!),json);}
  process.stdout.write(json);
}
