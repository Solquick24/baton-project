import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { healthResponseSchema } from '@baton/contracts';
import { buildApp } from '../src/app.js';
import { apiDirectory, readConfig } from '../src/shared/config.js';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const environment = { JWT_SECRET: 'baton-fixture-test-secret-not-for-real-use' };

it('blocks accidental live AWS sends in the fixture test environment', () => {
  const client = new BedrockRuntimeClient({ region: 'ap-northeast-2' });
  try {
    expect(() => client.send(new ConverseCommand({ modelId: 'unused-in-tests' }))).toThrow('실제 AWS 호출');
  } finally { client.destroy(); }
});

describe('configuration boundaries', () => {
  it('uses fixture defaults and paths relative to apps/api', () => {
    const config = readConfig(environment);
    expect(config.llmMode).toBe('fixture');
    expect(config.sttMode).toBe('fixture');
    expect(config.port).toBe(3001);
    expect(config.sqlitePath).toBe(resolve(apiDirectory, 'data/baton.sqlite'));
    expect(config.fixturesDir).toBe(resolve(apiDirectory, '../../fixtures'));
    expect(config.enableTestEndpoints).toBe(false);
  });
  it('preserves memory DB, absolute paths and explicitly false flags', () => {
    const config = readConfig({ ...environment, SQLITE_PATH: ':memory:', UPLOAD_DIR: '/tmp/baton-tests', LIVE_FALLBACK_TO_FIXTURE: 'false' });
    expect(config.sqlitePath).toBe(':memory:');
    expect(config.uploadDir).toBe('/tmp/baton-tests');
    expect(config.liveFallbackToFixture).toBe(false);
  });
  it.each([
    { JWT_SECRET: undefined }, { JWT_SECRET: 'short-secret' },
    { JWT_SECRET: ' '.repeat(32) }, { API_PORT: '0' }, { API_PORT: '65536' },
    { API_PORT: '3001.5' }, { LLM_MODE: 'mock' }, { STT_MODE: 'mock' },
    { LIVE_FALLBACK_TO_FIXTURE: 'yes' }, { DEMO_TODAY: '2026-02-30' },
  ])('rejects invalid settings without printing their values: %j', (invalid) => {
    expect(() => readConfig({ ...environment, ...invalid })).toThrow('환경 설정');
  });
  it('does not expose rejected secret values', () => {
    try { readConfig({ JWT_SECRET: 'sensitive-value' }); }
    catch (error) { expect(String(error)).not.toContain('sensitive-value'); return; }
    throw new Error('Expected invalid secret to be rejected');
  });
});

describe('local API assembly', () => {
  it('returns a strict shared health contract and closes cleanly', async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });
    } finally { await app.close(); }
  });
  it('does not expose internal routes, request paths or local configuration', async () => {
    const app = await buildApp();
    try {
      const response = await app.inject('/api/__internal/config?secret=private');
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('not_found');
      expect(body.error.requestId).toEqual(expect.any(String));
      expect(response.body).not.toContain('private');
      expect(response.body).not.toContain('jwtSecret');
    } finally { await app.close(); }
  });
});

it('loads SQLite native binding and preserves transactions/parameter binding', () => {
  const db = new Database(':memory:');
  try {
    db.pragma('foreign_keys = ON');
    db.exec('CREATE TABLE check_binding (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const insert = db.prepare('INSERT INTO check_binding (id, value) VALUES (?, ?)');
    const value = "virtual'); DROP TABLE check_binding; --";
    insert.run('first', value);
    expect(db.prepare('SELECT value FROM check_binding WHERE id = ?').get('first')).toEqual({ value });
    expect(() => db.transaction(() => { insert.run('second', 'virtual'); insert.run('first', 'duplicate'); })()).toThrow();
    expect(db.prepare('SELECT count(*) AS total FROM check_binding').get()).toEqual({ total: 1 });
  } finally { db.close(); }
});
