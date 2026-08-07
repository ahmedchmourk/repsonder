import crypto from 'node:crypto';

/**
 * Password hashing with scrypt from Node's standard library — no extra
 * dependency, and resistant to GPU cracking in a way plain SHA is not.
 *
 * Format: `scrypt$<N>$<salt-hex>$<hash-hex>`
 */

const COST = 16384; // 2^14
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LEN, { N: COST });
  return `scrypt$${COST}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;

  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length === 0) return false;

  const actual = crypto.scryptSync(password, salt, expected.length, { N: cost });
  // Constant-time so a wrong password cannot be found byte by byte.
  return crypto.timingSafeEqual(actual, expected);
}
