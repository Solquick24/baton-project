import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`;
}
export function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, hash, extra] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !hash || extra) return false;
  const expected = Buffer.from(hash, 'base64');
  const saltBytes = Buffer.from(salt, 'base64');
  if (expected.length !== 64 || saltBytes.length !== 16) return false;
  const actual = scryptSync(password, saltBytes, 64);
  return timingSafeEqual(actual, expected);
}
