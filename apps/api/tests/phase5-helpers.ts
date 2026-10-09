import { vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { FixtureLLM, FixtureTranscription } from '../src/adapters/ai/fixture.js';
import { validatedLLM, type LLMProvider } from '../src/adapters/ai/providers.js';
import { pregenerateDatabase } from '../../../scripts/pregenerate.js';
import { fixtureDatabase, fixturesDir } from './helpers.js';

// T040 test preconditions only: prepared transcript row, not a fake T039 HTTP success.
export async function phase5(provider?: LLMProvider) {
  const statements: string[] = [], db = fixtureDatabase((sql) => statements.push(sql));
  await pregenerateDatabase(db, fixturesDir);
  const transcription = await new FixtureTranscription(fixturesDir).transcribe({ patientId: 'p_01', visitId: 'v_im_03', attempt: 1 });
  db.prepare('INSERT INTO transcripts VALUES (?,?,?,?,?,?,?)').run('tr_phase5', 'p_01', 'v_im_03', null, 'fixture', JSON.stringify(transcription.segments), new Date().toISOString());
  db.prepare("UPDATE visits SET recordInputVersion=1 WHERE id='v_im_03'").run();
  const generate = vi.fn((provider ?? validatedLLM(new FixtureLLM(fixturesDir))).generate);
  const app = await buildApp({ db, llm: { generate }, jobHandlers: {
    structure: async (job) => (await import('../src/ai/pipelines/structure.js')).generateRecord(db, { generate }, job),
  } });
  await app.ready(); await app.baton.runner.stop();
  const base = '/api/patients/p_01/visits/v_im_03';
  const request = (user: string, url: string, method: 'GET' | 'POST' = 'GET', payload?: unknown) => app.inject({ method, url,
    headers: { authorization: `Bearer ${app.jwt.sign({ sub: user })}` }, ...(payload === undefined ? {} : { payload: payload as object }),
  });
  function note(text: string) {
    db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?)').run(`note_${Date.now()}_${Math.random()}`, 'p_01', 'v_im_03', 'u_b', text, new Date().toISOString());
    db.prepare("UPDATE visits SET recordInputVersion=recordInputVersion+1 WHERE id='v_im_03'").run();
  }
  async function structure() {
    const v = db.prepare("SELECT recordInputVersion FROM visits WHERE id='v_im_03'").get() as { recordInputVersion: number };
    const result = app.baton.jobs.enqueue('u_b', 'p_01', 'v_im_03', 'structure', v.recordInputVersion);
    await app.baton.runner.runNext();
    return (await request('u_b', `/api/jobs/${result.jobId}`)).json();
  }
  return { db, app, request, base, generate, statements, structure, note, async close() { await app.close(); db.close(); } };
}
