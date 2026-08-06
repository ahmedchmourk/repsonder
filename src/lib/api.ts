import { NextResponse } from 'next/server';
import { errorMessage } from './logger';
import { GoogleAccessNotGrantedError, GoogleNotConnectedError } from './google';
import { LLMNotConfiguredError } from './llm';
import { InvalidRedirectUriError } from './redirect-uri';
import { safeEqual } from './crypto';

/** Maps thrown errors to sensible HTTP responses. */
export function apiError(err: unknown) {
  const message = errorMessage(err);

  if (err instanceof GoogleNotConnectedError) {
    return NextResponse.json({ error: message, code: 'GOOGLE_NOT_CONNECTED' }, { status: 409 });
  }
  if (err instanceof GoogleAccessNotGrantedError) {
    return NextResponse.json({ error: message, code: 'GOOGLE_ACCESS_NOT_GRANTED' }, { status: 409 });
  }
  if (err instanceof LLMNotConfiguredError) {
    return NextResponse.json({ error: message, code: 'LLM_NOT_CONFIGURED' }, { status: 409 });
  }
  if (err instanceof InvalidRedirectUriError) {
    return NextResponse.json({ error: message, code: 'INVALID_REDIRECT_URI' }, { status: 400 });
  }
  if (/not found/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  // Validation problems the caller can fix, raised from lib/business.ts et al.
  if (
    /already been answered|cannot be empty|must be answered by a human|is required|at least \d+ characters|cannot be less than|Create a business/i.test(
      message,
    )
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.error('[responder] API error:', message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function apiOk(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

/** For input the caller could fix — kept distinct from a genuine 500. */
export function apiBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Guards the /api/cron/* endpoints. The secret can arrive as
 * `x-cron-secret: <secret>`, `Authorization: Bearer <secret>`, or `?secret=`.
 */
export function assertCronAuthorized(request: Request): void {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw Object.assign(new Error('CRON_SECRET is not set — cron endpoints are disabled.'), {
      status: 503,
    });
  }

  const url = new URL(request.url);
  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    url.searchParams.get('secret') ??
    '';

  if (!provided || !safeEqual(provided, expected)) {
    throw Object.assign(new Error('Invalid or missing cron secret.'), { status: 401 });
  }
}

export function unauthorizedResponse(err: unknown) {
  const status = (err as { status?: number })?.status ?? 401;
  return NextResponse.json({ error: errorMessage(err) }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}
