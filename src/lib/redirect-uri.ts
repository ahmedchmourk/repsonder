/**
 * OAuth redirect URI handling.
 *
 * Google requires the `redirect_uri` used to start the flow to match the token
 * exchange byte-for-byte, and to be registered on the OAuth client. People
 * commonly register the NextAuth-style path (`/api/auth/callback/google`), so the
 * app serves both shapes and lets each business store whichever it registered.
 */

/** Callback paths this app actually serves. Both are wired to the same handler. */
export const CALLBACK_PATHS = [
  '/api/auth/google/callback',
  '/api/auth/callback/google',
] as const;

export const DEFAULT_CALLBACK_PATH = CALLBACK_PATHS[0];

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function defaultRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${appBaseUrl()}${DEFAULT_CALLBACK_PATH}`;
}

/** Every URI this app can receive a callback on — shown in the UI as valid options. */
export function supportedRedirectUris(): string[] {
  const base = appBaseUrl();
  return CALLBACK_PATHS.map((path) => `${base}${path}`);
}

export class InvalidRedirectUriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRedirectUriError';
  }
}

/**
 * Validates a user-typed redirect URI. The path must be one this app serves —
 * otherwise Google would send the browser somewhere with no handler and the
 * connection would fail with a confusing 404 instead of a clear message.
 */
export function normalizeRedirectUri(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidRedirectUriError(
      `"${value}" is not a valid absolute URL. Use something like ${supportedRedirectUris()[0]}`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidRedirectUriError('The redirect URI must start with http:// or https://');
  }

  const path = url.pathname.replace(/\/+$/, '');
  if (!CALLBACK_PATHS.includes(path as (typeof CALLBACK_PATHS)[number])) {
    throw new InvalidRedirectUriError(
      `This app only serves ${CALLBACK_PATHS.join(' or ')}. "${url.pathname}" would 404. Register one of those in Google Cloud instead.`,
    );
  }

  // Drop any query/hash — Google rejects redirect URIs carrying them.
  return `${url.origin}${path}`;
}
