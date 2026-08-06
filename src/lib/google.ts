import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { Business } from '@prisma/client';
import { prisma } from './prisma';
import { decrypt, encrypt } from './crypto';
import { GOOGLE_SCOPES, STAR_RATING_MAP } from './constants';
import { credentialsFor } from './business';
import { defaultRedirectUri, supportedRedirectUris } from './redirect-uri';
import { errorMessage, logEvent } from './logger';

/**
 * Google Business Profile integration, scoped to one Business at a time — each
 * business brings its own OAuth client ID/secret and its own grant.
 *
 * Two API families are involved:
 *  - Account/location metadata: the modern `mybusinessaccountmanagement` and
 *    `mybusinessbusinessinformation` v1 APIs (available in `googleapis`).
 *  - Reviews and replies: only exposed by the legacy **My Business API v4**
 *    (`https://mybusiness.googleapis.com/v4/...`), which has no discovery doc
 *    in `googleapis`, so we call it over `fetch` with the OAuth access token.
 */

const V4_BASE = 'https://mybusiness.googleapis.com/v4';

export class GoogleNotConnectedError extends Error {
  constructor(businessName?: string) {
    super(
      `Google Business Profile is not connected${businessName ? ` for "${businessName}"` : ''}. Connect it from Settings.`,
    );
    this.name = 'GoogleNotConnectedError';
  }
}

/**
 * Raised when the Google Cloud project has not been granted access to the
 * Business Profile APIs.
 *
 * Google signals this with a *misleading* error: `429 RESOURCE_EXHAUSTED,
 * "Quota exceeded ... Requests per minute"` — but the accompanying metadata says
 * `quota_limit_value: "0"`. The project is not being throttled; its ceiling is
 * zero until the access request is approved. Retrying or backing off never helps,
 * so it is worth naming the real cause.
 */
export class GoogleAccessNotGrantedError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'GoogleAccessNotGrantedError';
  }
}

/** Pulls `quota_limit_value` out of a googleapis error, when present. */
function quotaLimitValue(err: unknown): string | null {
  const details = (err as { response?: { data?: { error?: { details?: unknown } } } })?.response
    ?.data?.error?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      const v = (d as { metadata?: { quota_limit_value?: unknown } })?.metadata?.quota_limit_value;
      if (typeof v === 'string') return v;
    }
  }
  return null;
}

/**
 * Converts Google's confusing gate errors into something actionable. Anything
 * unrecognised is returned untouched.
 */
export function translateGoogleError(err: unknown): unknown {
  const msg = errorMessage(err);
  if (!/mybusiness[a-z]*\.googleapis\.com/i.test(msg)) return err;

  const limit = quotaLimitValue(err);
  const zeroQuota = limit === '0' || /"quota_limit_value":\s*"0"/.test(msg);

  if (zeroQuota) {
    return new GoogleAccessNotGrantedError(
      'Google has not granted this project access to the Business Profile APIs yet — its quota is literally 0 requests/minute, which Google confusingly reports as "Quota exceeded". ' +
        'Submit (or wait for) the access request at https://developers.google.com/my-business/content/prereqs#request-access, and make sure the Google My Business API, My Business Account Management API and My Business Business Information API are all enabled on the project. Retrying will not help until then.',
    );
  }

  if (/SERVICE_DISABLED|has not been used in project|API has not been used/i.test(msg)) {
    return new GoogleAccessNotGrantedError(
      'One of the Business Profile APIs is not enabled on this Google Cloud project. Enable the Google My Business API, My Business Account Management API and My Business Business Information API, then try again.',
    );
  }

  return err;
}

/** The redirect URI this business uses: its own if set, otherwise the default. */
export function redirectUriFor(business: Business): string {
  return business.googleRedirectUri?.trim() || defaultRedirectUri();
}

export function createOAuthClient(business: Business): OAuth2Client {
  const { googleClientId, googleClientSecret } = credentialsFor(business);
  // The same value must be used to build the consent URL and to exchange the
  // code, or Google rejects the exchange.
  return new google.auth.OAuth2(googleClientId, googleClientSecret, redirectUriFor(business));
}

/** Consent URL. `access_type=offline` + `prompt=consent` guarantees a refresh token. */
export function buildAuthUrl(business: Business, state: string): string {
  return createOAuthClient(business).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [...GOOGLE_SCOPES, 'openid', 'email'],
    state,
  });
}

export async function exchangeCodeAndStore(
  business: Business,
  code: string,
): Promise<{ email: string | null }> {
  const client = createOAuthClient(business);
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token) throw new Error('Google did not return an access token.');
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const info = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
    email = info.data.email ?? null;
  } catch {
    // Non-fatal: the business.manage scope is what actually matters.
  }

  const existing = await prisma.oAuthAccount.findUnique({ where: { businessId: business.id } });

  // Google only returns a refresh token on the first consent; keep the old one
  // if this exchange didn't include a new one.
  const refreshToken = tokens.refresh_token
    ? encrypt(tokens.refresh_token)
    : existing?.refreshToken ?? null;

  const shared = {
    googleEmail: email ?? existing?.googleEmail ?? null,
    accessToken: encrypt(tokens.access_token),
    refreshToken,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
  };

  await prisma.oAuthAccount.upsert({
    where: { businessId: business.id },
    create: { businessId: business.id, ...shared },
    update: shared,
  });

  await logEvent({
    event: 'oauth.connected',
    message: `Connected Google account${email ? ` (${email})` : ''}`,
    businessId: business.id,
    metadata: { hasRefreshToken: Boolean(refreshToken) },
  });

  return { email };
}

/**
 * An OAuth2 client hydrated from the stored tokens, wired to persist any
 * silently refreshed access token back to the database.
 */
export async function getAuthorizedClient(business: Business): Promise<OAuth2Client> {
  const account = await prisma.oAuthAccount.findUnique({ where: { businessId: business.id } });
  if (!account) throw new GoogleNotConnectedError(business.name);

  const client = createOAuthClient(business);
  client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    expiry_date: account.expiryDate ? account.expiryDate.getTime() : undefined,
    scope: account.scope ?? undefined,
    token_type: account.tokenType ?? undefined,
  });

  client.on('tokens', (tokens) => {
    void (async () => {
      try {
        await prisma.oAuthAccount.update({
          where: { businessId: business.id },
          data: {
            ...(tokens.access_token ? { accessToken: encrypt(tokens.access_token) } : {}),
            ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
            ...(tokens.expiry_date ? { expiryDate: new Date(tokens.expiry_date) } : {}),
          },
        });
      } catch (err) {
        console.error('[responder] failed to persist refreshed token', errorMessage(err));
      }
    })();
  });

  return client;
}

export async function disconnectGoogle(business: Business): Promise<void> {
  const account = await prisma.oAuthAccount.findUnique({ where: { businessId: business.id } });
  if (account?.refreshToken) {
    try {
      await createOAuthClient(business).revokeToken(decrypt(account.refreshToken));
    } catch {
      // Token may already be revoked upstream; deleting locally is enough.
    }
  }
  await prisma.oAuthAccount.deleteMany({ where: { businessId: business.id } });
  await logEvent({
    event: 'oauth.disconnected',
    message: 'Disconnected Google account',
    businessId: business.id,
  });
}

export type ConnectionStatus = {
  connected: boolean;
  email: string | null;
  scope: string | null;
  hasRefreshToken: boolean;
  accessTokenExpiresAt: string | null;
  connectedAt: string | null;
  /** The URI this business will use, and every URI this app can serve. */
  redirectUri: string;
  supportedRedirectUris: string[];
};

export async function getConnectionStatus(business: Business): Promise<ConnectionStatus> {
  const account = await prisma.oAuthAccount.findUnique({ where: { businessId: business.id } });
  return {
    connected: Boolean(account),
    email: account?.googleEmail ?? null,
    scope: account?.scope ?? null,
    hasRefreshToken: Boolean(account?.refreshToken),
    accessTokenExpiresAt: account?.expiryDate?.toISOString() ?? null,
    connectedAt: account?.createdAt.toISOString() ?? null,
    redirectUri: redirectUriFor(business),
    supportedRedirectUris: supportedRedirectUris(),
  };
}

// ---------------------------------------------------------------------------
// Accounts & locations (modern v1 APIs)
// ---------------------------------------------------------------------------

export type RemoteLocation = {
  googleName: string;
  accountName: string;
  title: string;
  address: string | null;
};

export async function listRemoteLocations(business: Business): Promise<RemoteLocation[]> {
  const auth = await getAuthorizedClient(business);
  const accountMgmt = google.mybusinessaccountmanagement({ version: 'v1', auth });
  const businessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth });

  try {
    const accounts: { name: string }[] = [];
    let accountPageToken: string | undefined;
    do {
      const res = await accountMgmt.accounts.list({ pageSize: 20, pageToken: accountPageToken });
      for (const acc of res.data.accounts ?? []) {
        if (acc.name) accounts.push({ name: acc.name });
      }
      accountPageToken = res.data.nextPageToken ?? undefined;
    } while (accountPageToken);

    if (accounts.length === 0) {
      throw new Error(
        'Google returned no Business Profile accounts for this login. Make sure the account you authorised is an owner or manager of a verified business at business.google.com.',
      );
    }

    const locations: RemoteLocation[] = [];
    for (const account of accounts) {
      let pageToken: string | undefined;
      do {
        const res = await businessInfo.accounts.locations.list({
          parent: account.name,
          readMask: 'name,title,storefrontAddress',
          pageSize: 100,
          pageToken,
        });
        for (const loc of res.data.locations ?? []) {
          if (!loc.name) continue;
          const addr = loc.storefrontAddress;
          const addressLine = addr
            ? [...(addr.addressLines ?? []), addr.locality, addr.administrativeArea, addr.postalCode]
                .filter(Boolean)
                .join(', ')
            : null;
          locations.push({
            googleName: loc.name,
            accountName: account.name,
            title: loc.title ?? loc.name,
            address: addressLine || null,
          });
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    }

    return locations;
  } catch (err) {
    throw translateGoogleError(err);
  }
}

/** Upsert this business's locations into the local DB. */
export async function syncLocations(business: Business) {
  let remote: RemoteLocation[];
  try {
    remote = await listRemoteLocations(business);
  } catch (err) {
    // Record the *translated* reason so the dashboard can show something useful
    // instead of Google's misleading quota wording.
    await logEvent({
      event: 'locations.sync_failed',
      level: 'ERROR',
      message: errorMessage(err),
      businessId: business.id,
    });
    throw err;
  }

  for (const loc of remote) {
    await prisma.location.upsert({
      where: { businessId_googleName: { businessId: business.id, googleName: loc.googleName } },
      create: {
        businessId: business.id,
        googleName: loc.googleName,
        accountName: loc.accountName,
        title: loc.title,
        address: loc.address,
      },
      update: { accountName: loc.accountName, title: loc.title, address: loc.address },
    });
  }
  await logEvent({
    event: 'locations.synced',
    message: `Synced ${remote.length} location(s) from Google`,
    businessId: business.id,
  });
  return prisma.location.findMany({
    where: { businessId: business.id },
    orderBy: { title: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Reviews & replies (legacy v4 API over fetch)
// ---------------------------------------------------------------------------

export type RemoteReview = {
  name: string;
  reviewId: string;
  reviewerName: string;
  reviewerPhotoUrl: string | null;
  starRating: number;
  comment: string | null;
  createTime: string;
  updateTime: string;
  reviewReply: { comment: string; updateTime: string } | null;
};

/** "locations/123" + "accounts/456" → "accounts/456/locations/123" */
function v4LocationPath(accountName: string, googleLocationName: string): string {
  const locationId = googleLocationName.split('/').pop();
  const accountId = accountName.split('/').pop();
  return `accounts/${accountId}/locations/${locationId}`;
}

async function v4Request<T>(
  auth: OAuth2Client,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Could not obtain a Google access token (re-connect in Settings).');

  const res = await fetch(`${V4_BASE}/${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    // Keep the body in the message so translateGoogleError can spot a zero quota.
    throw translateGoogleError(
      new Error(
        `mybusiness.googleapis.com v4 ${init?.method ?? 'GET'} /${path} failed (${res.status}): ${text.slice(0, 800)}`,
      ),
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function fetchReviewsForLocation(
  business: Business,
  accountName: string,
  googleLocationName: string,
): Promise<RemoteReview[]> {
  const auth = await getAuthorizedClient(business);
  const base = v4LocationPath(accountName, googleLocationName);

  const out: RemoteReview[] = [];
  let pageToken: string | undefined;

  do {
    const qs = new URLSearchParams({ pageSize: '50' });
    if (pageToken) qs.set('pageToken', pageToken);

    const data = await v4Request<{
      reviews?: Array<{
        name?: string;
        reviewId?: string;
        reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
        starRating?: string;
        comment?: string;
        createTime?: string;
        updateTime?: string;
        reviewReply?: { comment?: string; updateTime?: string };
      }>;
      nextPageToken?: string;
    }>(auth, `${base}/reviews?${qs.toString()}`);

    for (const r of data.reviews ?? []) {
      if (!r.name || !r.reviewId) continue;
      out.push({
        name: r.name,
        reviewId: r.reviewId,
        reviewerName: r.reviewer?.isAnonymous
          ? 'A Google user'
          : r.reviewer?.displayName ?? 'A Google user',
        reviewerPhotoUrl: r.reviewer?.profilePhotoUrl ?? null,
        starRating: STAR_RATING_MAP[r.starRating ?? 'STAR_RATING_UNSPECIFIED'] ?? 0,
        comment: r.comment ?? null,
        createTime: r.createTime ?? new Date().toISOString(),
        updateTime: r.updateTime ?? r.createTime ?? new Date().toISOString(),
        reviewReply: r.reviewReply?.comment
          ? {
              comment: r.reviewReply.comment,
              updateTime: r.reviewReply.updateTime ?? new Date().toISOString(),
            }
          : null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

/** PUT the reply to Google. `reviewGoogleName` is the full v4 resource name. */
export async function publishReplyToGoogle(
  business: Business,
  reviewGoogleName: string,
  comment: string,
): Promise<void> {
  const auth = await getAuthorizedClient(business);
  await v4Request(auth, `${reviewGoogleName}/reply`, { method: 'PUT', body: { comment } });
}

export async function deleteReplyOnGoogle(
  business: Business,
  reviewGoogleName: string,
): Promise<void> {
  const auth = await getAuthorizedClient(business);
  await v4Request(auth, `${reviewGoogleName}/reply`, { method: 'DELETE' });
}
