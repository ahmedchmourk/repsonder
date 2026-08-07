import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Signs out and returns to the login screen.
 *
 * The cookie is cleared on the redirect response itself rather than through
 * `cookies()` from next/headers: mutations made that way are not reliably
 * attached to a `NextResponse.redirect`, which left the session cookie in place.
 * The login page then saw a valid session and bounced straight back to the
 * dashboard, so signing out appeared to do nothing.
 */
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 });

  // Expire it explicitly — `delete` alone can be dropped by intermediate caches.
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.APP_BASE_URL ?? '').startsWith('https://'),
    path: '/',
    maxAge: 0,
  });

  return response;
}
