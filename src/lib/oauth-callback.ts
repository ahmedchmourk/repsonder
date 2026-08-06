import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeAndStore, syncLocations } from './google';
import { getBusinessOrThrow, selectBusiness } from './business';
import { errorMessage, logEvent } from './logger';
import { appBaseUrl } from './redirect-uri';

/**
 * The OAuth callback, shared by both routes this app serves:
 *   /api/auth/google/callback   (default)
 *   /api/auth/callback/google   (NextAuth-style, what many people register)
 *
 * Either can be registered in Google Cloud; whichever the business has stored is
 * the one used to build the consent URL and to exchange the code.
 */
export async function handleGoogleCallback(request: Request): Promise<NextResponse> {
  const base = appBaseUrl();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const back = (params: Record<string, string>) =>
    NextResponse.redirect(
      `${base}/?${new URLSearchParams({ view: 'settings', ...params }).toString()}`,
    );

  if (oauthError) {
    await logEvent({
      event: 'oauth.denied',
      level: 'WARN',
      message: `Google returned an error: ${oauthError}`,
    });
    return back({ error: `Google denied the request: ${oauthError}` });
  }

  const jar = await cookies();
  const raw = jar.get('responder_oauth')?.value;
  jar.delete('responder_oauth');

  if (!code) return back({ error: 'Google did not return an authorization code.' });
  if (!raw) return back({ error: 'The connection attempt expired — please start again.' });

  let expectedState: string | undefined;
  let businessId: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { state?: string; businessId?: string };
    expectedState = parsed.state;
    businessId = parsed.businessId;
  } catch {
    return back({ error: 'The connection attempt was malformed — please start again.' });
  }

  if (!state || !expectedState || state !== expectedState) {
    return back({ error: 'OAuth state mismatch — please start the connection again.' });
  }
  if (!businessId) return back({ error: 'No business was attached to this connection attempt.' });

  try {
    const business = await getBusinessOrThrow(businessId);
    const { email } = await exchangeCodeAndStore(business, code);

    // Make sure the dashboard lands on the business we just connected.
    await selectBusiness(business.id);

    // Pull locations straight away so the dashboard has something to work with.
    // A failure here is not fatal to the connection itself.
    let locationNote = '';
    try {
      const locations = await syncLocations(business);
      locationNote = `${locations.length} location(s) found.`;
    } catch (err) {
      // syncLocations already logged the translated reason; just carry it to the UI.
      locationNote = `Connected, but locations could not be listed: ${errorMessage(err)}`;
    }

    return back({
      connected: '1',
      message: `${business.name} connected${email ? ` as ${email}` : ''}. ${locationNote}`.trim(),
    });
  } catch (err) {
    const msg = errorMessage(err);
    await logEvent({
      event: 'oauth.exchange_failed',
      level: 'ERROR',
      message: msg,
      businessId: businessId ?? null,
    });
    return back({ error: msg });
  }
}
