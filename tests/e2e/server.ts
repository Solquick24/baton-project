import { buildApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/shared/config.js';
import { openDatabase } from '../../apps/api/src/adapters/sqlite/database.js';
import { FixtureLLM, FixtureTranscription } from '../../apps/api/src/adapters/ai/fixture.js';
import { validatedLLM } from '../../apps/api/src/adapters/ai/providers.js';
import { seedDatabase } from '../../scripts/seed.js';
import { pregenerateDatabase } from '../../scripts/pregenerate.js';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Test-only entry point: never loads .env or registers reset endpoints in the product server.
const config = readConfig();
if (process.env.NODE_ENV !== 'test' || !config.enableTestEndpoints || config.sqlitePath !== ':memory:'
  || config.llmMode !== 'fixture' || config.sttMode !== 'fixture') throw new Error('Isolated fixture settings required');
if (!config.uploadDir.startsWith(join(tmpdir(), 'baton-e2e-'))) throw new Error('Separate upload directory required');
globalThis.fetch = async () => { throw new Error('External HTTP disabled in fixture E2E'); };
const db = openDatabase(':memory:');
const provider = validatedLLM(new FixtureLLM(config.fixturesDir));
let calls = 0, sttCalls = 0;
const transcription = new FixtureTranscription(config.fixturesDir);
let departmentIsolated = true;
const app = await buildApp({ config, db, llm: { async generate(input) {
  calls++;
  const serialized = JSON.stringify(input.input);
  departmentIsolated &&= !['v_os_01', 'ob_03', 'rx_os_01', '가상록소정'].some(term => serialized.includes(term));
  const result = await provider.generate(input);
  return result;
} }, stt: { async transcribe(input) { sttCalls++; return transcription.transcribe(input); } } });
app.post<{ Body: { pregenerate?: boolean } }>('/api/__test/reset', async req => {
  await app.baton.runner.stop();
  seedDatabase(db, { fixturesDir: config.fixturesDir });
  if (req.body?.pregenerate !== false) await pregenerateDatabase(db, config.fixturesDir);
  calls = 0; sttCalls = 0; departmentIsolated = true;
  app.baton.runner.start();
  return { mode: 'fixture' };
});
app.get('/api/__test/ai-calls', async () => ({ llm: calls, stt: sttCalls, departmentIsolated }));
// Deterministic interruption boundary for browser failure/retry UI. Actual disk reopen is tested through buildApp APIs.
app.post('/api/__test/pause-jobs', async () => { await app.baton.runner.stop(); return { paused: true }; });
app.post('/api/__test/interrupt-job', async () => {
  const claimed=app.baton.jobs.claim();
  if (!claimed) throw new Error('No queued test job');
  app.baton.jobs.recoverRunning(); app.baton.runner.start();
  return { jobId: claimed.id };
});
seedDatabase(db, { fixturesDir: config.fixturesDir });
await app.listen({ host: '127.0.0.1', port: config.port });
let closing = false;
async function close() { if (closing) return; closing = true; await app.close(); db.close(); rmSync(config.uploadDir, { recursive: true, force: true }); }
process.once('SIGTERM', () => { void close(); });
process.once('SIGINT', () => { void close(); });
