/**
 * Signed session cookies.
 *
 * Uses Web Crypto (HMAC-SHA256) rather than node:crypto so the exact same code
 * verifies sessions in middleware, which runs on the Edge runtime.
 *
 * Token format: `<payload-b64url>.<signature-b64url>`
 */

export const SESSION_COOKIE = 'responder_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  email: string;
  name: string | null;
  /** Unix seconds. */
  exp: number;
};

function secret(): string {
  const value = process.env.AUTH_SECRET || process.env.ENCRYPTION_KEY;
  if (!value || value.length < 16) {
    throw new Error(
      'AUTH_SECRET (or ENCRYPTION_KEY) must be set to at least 16 characters to sign sessions.',
    );
  }
  return value;
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns an ArrayBuffer-backed view, which is what Web Crypto requires. */
function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  maxAgeSeconds = SESSION_MAX_AGE,
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const sig = await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Returns the payload when the signature is valid and unexpired, else null. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await key(),
      b64urlDecode(sig),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (!payload?.userId || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
