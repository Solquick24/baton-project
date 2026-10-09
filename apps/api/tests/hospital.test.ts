import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hospitalResponseSchema } from '@baton/contracts';
import { buildApp } from '../src/app.js';
import { fixtureDatabase, fixturesDir } from './helpers.js';

it('registered hospital API returns the exact static seed to authenticated accounts without AI calls', async () => {
  const db = fixtureDatabase(), generate = vi.fn(), transcribe = vi.fn();
  const app = await buildApp({ db, llm: { generate }, stt: { transcribe } });
  try {
    const expected = JSON.parse(readFileSync(resolve(fixturesDir, 'seed/hospital.json'), 'utf8')).hospitals[0];
    for (const sub of ['u_patient', 'u_a', 'u_b', 'u_c', 'u_x']) {
      const res = await app.inject({ url: '/api/hospitals/h_01', headers: { authorization: `Bearer ${app.jwt.sign({ sub })}` } });
      expect(res.statusCode).toBe(200);
      expect(hospitalResponseSchema.parse(res.json())).toEqual(expected);
    }
    expect(generate).not.toHaveBeenCalled(); expect(transcribe).not.toHaveBeenCalled();
  } finally { await app.close(); db.close(); }
});
it('hospital API requires authentication and safely reports an unknown hospital', async () => {
  const db = fixtureDatabase(), app = await buildApp({ db });
  try {
    expect((await app.inject('/api/hospitals/h_01')).statusCode).toBe(401);
    const res = await app.inject({ url: '/api/hospitals/missing', headers: { authorization: `Bearer ${app.jwt.sign({ sub: 'u_b' })}` } });
    expect(res.statusCode).toBe(404); expect(res.json().error.code).toBe('not_found');
  } finally { await app.close(); db.close(); }
});
