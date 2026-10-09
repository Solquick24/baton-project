import { vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/shared/config.js';
import { fixtureDatabase } from './helpers.js';

export async function phase4(uploadDir?: string) {
  const statements: string[] = [];
  const db = fixtureDatabase(sql => statements.push(sql));
  const generate = vi.fn(async () => { throw new Error('Reads and scope changes must not call AI'); });
  const transcribe = vi.fn(async () => { throw new Error('Reads must not call STT'); });
  const config = readConfig();
  if (uploadDir) config.uploadDir = uploadDir;
  const app = await buildApp({ db, config, llm: { generate }, stt: { transcribe } });
  await app.ready(); await app.baton.runner.stop();
  const tokens = new Map(['u_patient', 'u_a', 'u_b', 'u_c', 'u_x'].map(user => [user, app.jwt.sign({ sub: user })]));
  const request = (user: string, url: string, method: 'GET' | 'PUT' = 'GET', payload?: unknown) => app.inject({
    method, url, headers: { authorization: `Bearer ${tokens.get(user)}` }, ...(payload === undefined ? {} : { payload: payload as object }),
  });
  return { db, app, request, generate, transcribe, statements, async close() { await app.close(); db.close(); } };
}
