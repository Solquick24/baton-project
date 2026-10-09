import { afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { fixtureDatabase, password } from './helpers.js';
import { loginResponseSchema } from '@baton/contracts';

let db: ReturnType<typeof fixtureDatabase>;
let app: Awaited<ReturnType<typeof buildApp>>;
beforeEach(async () => { db = fixtureDatabase(); app = await buildApp({ db });
  // Test-only route: exercises production session/policy without implementing T025/T031/T032.
  app.get<{ Params: { pid: string; action: string } }>('/probe/:pid/:action', async (request) => {
    const { authenticate } = await import('../src/auth/session.js');
    const { requireMembership, assertAction } = await import('../src/auth/permissions.js');
    const userId = await authenticate(request, db);
    const membership = requireMembership(db, userId, request.params.pid);
    assertAction(membership, request.params.action);
    return { ok: true };
  });
});
afterEach(async () => { await app.close(); db.close(); });
const login = (email = 'b@baton.demo', supplied = password) => app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: supplied } });
const probe = (token: string, action = 'read') => app.inject({ url: `/probe/p_01/${action}`, headers: { authorization: `Bearer ${token}` } });
it.each(['patient', 'a', 'b', 'c'])('logs in seeded %s account with sub-only identity and eight-hour token', async (name) => {
  const response = await login(`${name}@baton.demo`);
  expect(response.statusCode).toBe(200);
  const body = loginResponseSchema.parse(response.json());
  expect(Object.keys(body.user).sort()).toEqual(['id', 'name']);
  const decoded = app.jwt.decode(body.accessToken) as Record<string, any>;
  expect(Object.keys(decoded).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sub']);
  expect(decoded.exp - decoded.iat).toBe(8 * 60 * 60);
  expect(await probe(body.accessToken).then((r) => r.statusCode)).toBe(200);
});
it('returns the same safe error for unknown user and wrong password', async () => {
  const a = await login('b@baton.demo', 'wrong-secret');
  const b = await login('missing@baton.demo', 'wrong-secret');
  expect(a.statusCode).toBe(401); expect(b.statusCode).toBe(401);
  expect(a.json().error.message).toBe(b.json().error.message);
  expect(a.body).not.toContain('wrong-secret');
});
it('rejects extra login claims and missing authentication', async () => {
  expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'b@baton.demo', password, scope: 'full' } })).statusCode).toBe(400);
  expect((await app.inject('/probe/p_01/read')).statusCode).toBe(401);
});
it.each(['tampered', 'expired', 'audience', 'issuer', 'none', 'HS384', 'unknown-sub'])('rejects %s JWT', async (caseName) => {
  const token = app.jwt.sign({ sub: caseName === 'unknown-sub' ? 'missing' : 'u_b' },
    caseName === 'expired' ? { expiresIn: -1 } : caseName === 'audience' ? { aud: 'other' } : caseName === 'issuer' ? { iss: 'other' } : caseName === 'HS384' ? { algorithm: 'HS384' } : {});
  const supplied = caseName === 'none' ? `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'u_b' })).toString('base64url')}.`
    : caseName === 'tampered' ? `${token.slice(0, -8)}abcdefgh` : token;
  expect((await probe(supplied)).statusCode).toBe(401);
});
it('refuses nonmembers and inactive members even with valid tokens', async () => {
  expect((await probe(app.jwt.sign({ sub: 'u_x' }))).statusCode).toBe(403);
  db.prepare('UPDATE members SET active=0 WHERE userId=?').run('u_b');
  expect((await probe(app.jwt.sign({ sub: 'u_b' }))).statusCode).toBe(403);
});
it('checks delegation and designated lead afresh, independently of full scope', async () => {
  const a = app.jwt.sign({ sub: 'u_a' }), b = app.jwt.sign({ sub: 'u_b' });
  expect((await probe(a, 'manage_scopes')).statusCode).toBe(403);
  expect((await probe(app.jwt.sign({ sub: 'u_patient' }), 'manage_scopes')).statusCode).toBe(200);
  db.prepare('UPDATE patients SET delegated=1').run();
  expect((await probe(a, 'manage_scopes')).statusCode).toBe(200);
  db.prepare("UPDATE members SET scope='full' WHERE userId='u_b'").run();
  expect((await probe(b, 'manage_scopes')).statusCode).toBe(403);
  db.prepare('UPDATE patients SET delegated=0').run();
  expect((await probe(a, 'manage_scopes')).statusCode).toBe(403);
});
it('uses current DB scope even when a signed token asserts full, and denies unknown actions', async () => {
  const token = app.jwt.sign({ sub: 'u_c', scope: 'full', role: 'patient' });
  expect((await probe(token, 'read_source')).statusCode).toBe(403);
  db.prepare("UPDATE members SET scope='full' WHERE userId='u_c'").run();
  expect((await probe(token, 'read_source')).statusCode).toBe(200);
  expect((await probe(token, 'unknown')).statusCode).toBe(403);
});
