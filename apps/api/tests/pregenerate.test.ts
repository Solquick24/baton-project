import { expect, it, vi } from 'vitest';
import { seedDatabase } from '../../../scripts/seed.js';
import { openDatabase } from '../src/adapters/sqlite/database.js';
import { FixtureLLM } from '../src/adapters/ai/fixture.js';
import { ProviderError } from '../src/adapters/ai/providers.js';
import { readBriefing } from '../src/modules/briefing/service.js';
import { fixturesDir } from './helpers.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildApp } from '../src/app.js';

it('pregenerates with the real fixture provider and normal pipelines, then serves stored permitted blocks', async () => {
  const db = openDatabase(':memory:');
  const calls = vi.spyOn(FixtureLLM.prototype, 'generateRaw');
  try {
    expect(await seedDatabase(db, { fixturesDir, pregenerate: true })).toEqual({ users: 5, visits: 4, records: 3, alerts: 1, pregenerated: { questionsVersion: 1, briefingVersion: 1, mode: 'fixture' } });
    expect(calls).toHaveBeenCalledTimes(2);
    expect(readBriefing(db, 'u_b', 'p_01', 'v_im_03').questions).toHaveLength(3);
    expect(db.prepare("SELECT count(*) n FROM jobs WHERE status='succeeded' AND mode='fixture'").get()).toEqual({ n: 2 });
    expect(db.prepare("SELECT recordPublishedVersion FROM visits WHERE id='v_im_03'").get()).toEqual({ recordPublishedVersion: null });
  } finally { db.close(); }
});
it('fails pregeneration honestly when the fixture provider fails, without creating a ready result', async () => {
  const db = openDatabase(':memory:');
  vi.spyOn(FixtureLLM.prototype, 'generateRaw').mockRejectedValue(new ProviderError('ai_unavailable'));
  try {
    await expect(seedDatabase(db, { fixturesDir, pregenerate: true })).rejects.toThrow('Pregeneration validation failed');
    expect(db.prepare("SELECT count(*) n FROM block_sets WHERE section IN ('questions','briefing')").get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT status,errorCode FROM jobs').get()).toEqual({ status: 'failed', errorCode: 'ai_unavailable' });
  } finally { db.close(); }
});
it('reopens a separate pregenerated file DB and serves questions/briefing through registered product APIs without new generation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baton-pregenerate-regression-'));
  const path = join(directory, 'isolated.sqlite'); let db = openDatabase(path);
  try {
    db.close();
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed.ts', '--pregenerate', '--database', path], {
      cwd: resolve(fixturesDir, '..'), env: { ...process.env, NODE_ENV: 'test', LLM_MODE: 'fixture', STT_MODE: 'fixture' }, encoding: 'utf8',
    });
    expect(output).toContain('questionsVersion: 1'); expect(output).toContain('briefingVersion: 1');
    db = openDatabase(path);
    const generate = vi.fn(async () => { throw new Error('GET must not generate'); });
    const app = await buildApp({ db, llm: { generate } });
    try {
      const token = app.jwt.sign({ sub: 'u_b' });
      for (const route of ['questions', 'briefing']) {
        const res = await app.inject({ url: `/api/patients/p_01/visits/v_im_03/${route}`, headers: { authorization: `Bearer ${token}` } });
        expect(res.statusCode).toBe(200);
        expect(Object.keys((route === 'questions' ? res.json().merged : res.json()).blocks)).toEqual(['companion']);
        if (route === 'briefing') expect(res.json().questions).toHaveLength(3);
      }
      expect(generate).not.toHaveBeenCalled();
    } finally { await app.close(); }
  } finally { db.close(); await rm(directory, { recursive: true, force: true }); }
});
