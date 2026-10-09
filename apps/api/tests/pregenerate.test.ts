import { expect, it, vi } from 'vitest';
import { seedDatabase } from '../../../scripts/seed.js';
import { openDatabase } from '../src/adapters/sqlite/database.js';
import { FixtureLLM } from '../src/adapters/ai/fixture.js';
import { ProviderError } from '../src/adapters/ai/providers.js';
import { readBriefing } from '../src/modules/briefing/service.js';
import { fixturesDir } from './helpers.js';

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
