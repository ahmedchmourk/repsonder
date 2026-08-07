import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/**
 * Everything requires a signed-in user except the login screen, the login API,
 * and the Google OAuth callback (Google redirects there without our cookie
 * context guaranteed, and it validates its own state parameter).
 *
 * The cron endpoints are excluded too — they authenticate with CRON_SECRET.
 */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/google/callback',
  '/api/auth/callback/google',
  '/api/cron',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // API callers get a clean 401 rather than an HTML redirect.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const login = new URL('/login', request.url);
  // Also preserve a query-only destination such as `/?view=settings`, which the
  // OAuth callback redirects to — checking the pathname alone dropped it.
  if (pathname !== '/' || search) login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next internals and static assets so the logo and CSS load on /login.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|icon.svg).*)'],
};
