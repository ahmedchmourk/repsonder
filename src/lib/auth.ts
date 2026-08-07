import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { hashPassword, verifyPassword } from './password';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from './session';

/** Accounts created automatically on first boot so the team can sign straight in. */
const SEED_USERS = [
  { email: 'ahmed.chmourk@octicode.com', name: 'Ahmed' },
  { email: 'kamal@octicode.com', name: 'Kamal' },
  { email: 'yaaqoub@octicode.com', name: 'Yaaqoub' },
];

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? '111';

/**
 * Creates the initial accounts if they do not exist. Existing users are left
 * alone, so changing a password here will not be undone on the next restart.
 */
export async function ensureSeedUsers(): Promise<void> {
  for (const user of SEED_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing) continue;
    await prisma.user.create({
      data: { ...user, passwordHash: hashPassword(SEED_PASSWORD) },
    });
    console.log(`[responder] created sign-in account ${user.email}`);
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalised } });

  // Same message either way, so the form cannot be used to discover addresses.
  const invalid = { ok: false as const, error: 'That email and password do not match.' };
  if (!user) return invalid;
  if (!verifyPassword(password, user.passwordHash)) return invalid;

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Keyed to the deployment's own scheme rather than NODE_ENV: a production
    // build served over plain HTTP (IP:port, or before TLS is issued) would
    // otherwise set a Secure cookie the browser silently discards, making login
    // appear to succeed and then bounce straight back to the login screen.
    secure: (process.env.APP_BASE_URL ?? '').startsWith('https://'),
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Middleware already blocks anonymous requests. */
export async function currentUser(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}
