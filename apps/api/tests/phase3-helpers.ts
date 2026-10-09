import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { FixtureLLM } from '../src/adapters/ai/fixture.js';
import { validatedLLM, type LLMProvider } from '../src/adapters/ai/providers.js';
import { fixtureDatabase, fixturesDir } from './helpers.js';

export const expected = (file: string) => JSON.parse(readFileSync(resolve(fixturesDir, 'expected', file), 'utf8'));
export async function phase3(provider?: LLMProvider) {
  const statements: string[] = [];
  const db = fixtureDatabase((sql) => statements.push(sql));
  const generate = vi.fn((provider ?? validatedLLM(new FixtureLLM(fixturesDir))).generate);
  const app = await buildApp({ db, llm: { generate } });
  await app.ready(); await app.baton.runner.stop();
  const request = (user: string, url: string, method: 'GET' | 'POST' = 'GET', payload?: unknown) => app.inject({
    method, url, headers: { authorization: `Bearer ${app.jwt.sign({ sub: user })}` }, ...(payload === undefined ? {} : { payload: payload as object }),
  });
  const base = '/api/patients/p_01/visits/v_im_03';
  async function merge() {
    const res = await request('u_b', `${base}/questions/merge`, 'POST', { inputVersion: 3 });
    await app.baton.runner.runNext();
    return { response: res, job: await request('u_b', `/api/jobs/${res.json().jobId}`) };
  }
  async function briefing() {
    await merge();
    const res = await request('u_b', `${base}/briefing`, 'POST', { questionsVersion: 1 });
    await app.baton.runner.runNext();
    return { response: res, job: await request('u_b', `/api/jobs/${res.json().jobId}`) };
  }
  return { db, app, request, base, generate, statements, merge, briefing, async close() { await app.close(); db.close(); } };
}
