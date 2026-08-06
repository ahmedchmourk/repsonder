import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthUrl } from '@/lib/google';
import { getBusinessOrThrow, getCurrentBusiness } from '@/lib/business';
import { errorMessage } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Kicks off the OAuth 2.0 consent flow with offline access, using the OAuth
 * client that belongs to the target business. `?businessId=` selects it;
 * otherwise the currently selected business is used.
 */
export async function GET(request: Request) {
  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  try {
    const requestedId = new URL(request.url).searchParams.get('businessId');
    const business = requestedId
      ? await getBusinessOrThrow(requestedId)
      : await getCurrentBusiness();

    if (!business) {
      throw new Error('Create a business before connecting Google.');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const jar = await cookies();
    // The business id travels in the cookie, not the state param, so a tampered
    // callback cannot point the grant at a different business.
    jar.set('responder_oauth', JSON.stringify({ state, businessId: business.id }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });

    return NextResponse.redirect(buildAuthUrl(business, state));
  } catch (err) {
    return NextResponse.redirect(
      `${base}/?view=settings&error=${encodeURIComponent(errorMessage(err))}`,
    );
  }
}
