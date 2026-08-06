import type { Business } from '@prisma/client';
import { getAuthorizedClient } from './google';
import { errorMessage, logEvent } from './logger';

/**
 * Google access diagnostics.
 *
 * Distinguishing the failure modes matters, because Google reports two very
 * different problems in confusingly similar ways:
 *
 *  - API not enabled on the project  → 403 SERVICE_DISABLED
 *  - project not allowlisted for the → 429 "Quota exceeded", but with
 *    Business Profile APIs             `quota_limit_value: "0"`
 *
 * The second one cannot be fixed in the console — it clears when the access
 * request is approved. Everything here uses raw `fetch` so the full error body
 * (including the quota metadata) is available.
 */

export type CheckStatus =
  | 'OK'
  | 'NOT_ENABLED'
  | 'ACCESS_NOT_GRANTED'
  | 'AUTH'
  | 'NO_ACCESS_TO_BUSINESS'
  | 'SKIPPED'
  | 'ERROR';

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Google's own "enable this API" link, when it supplies one. */
  actionUrl?: string;
};

export type Diagnosis = {
  checkedAt: string;
  overall:
    | 'READY'
    | 'WAITING_FOR_APPROVAL'
    | 'API_NOT_ENABLED'
    | 'NEEDS_RECONNECT'
    | 'NO_BUSINESS_ACCESS'
    | 'ERROR';
  summary: string;
  checks: Check[];
  accountCount: number;
  locationCount: number;
};

type Classified = { status: CheckStatus; detail: string; actionUrl?: string };

function classify(httpStatus: number, body: string): Classified {
  let parsed: {
    error?: { message?: string; status?: string; details?: unknown[] };
  } | null = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Non-JSON (usually an HTML error page).
  }

  const err = parsed?.error;
  const message = err?.message ?? body.slice(0, 300).replace(/\s+/g, ' ');

  // Quota ceiling of zero == not allowlisted, regardless of the 429 wording.
  let quotaLimit: string | undefined;
  if (Array.isArray(err?.details)) {
    for (const d of err.details) {
      const v = (d as { metadata?: { quota_limit_value?: unknown } })?.metadata?.quota_limit_value;
      if (typeof v === 'string') quotaLimit = v;
    }
  }
  if (quotaLimit === '0' || /"quota_limit_value":\s*"0"/.test(body)) {
    return {
      status: 'ACCESS_NOT_GRANTED',
      detail:
        'The API is enabled, but this project has a quota of 0 requests/minute — Google has not approved the Business Profile API access request yet.',
    };
  }

  if (/SERVICE_DISABLED|has not been used in project|API has not been used/i.test(message)) {
    const url = /https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"')]+/.exec(message)?.[0];
    return {
      status: 'NOT_ENABLED',
      detail: 'This API is not enabled on the Google Cloud project.',
      actionUrl: url,
    };
  }

  if (httpStatus === 401 || /UNAUTHENTICATED|invalid_grant|invalid credentials/i.test(message)) {
    return {
      status: 'AUTH',
      detail: `Google rejected the credentials — reconnect the account. (${message.slice(0, 160)})`,
    };
  }

  if (httpStatus === 403) {
    return {
      status: 'NO_ACCESS_TO_BUSINESS',
      detail: `Permission denied: ${message.slice(0, 200)}`,
    };
  }

  return { status: 'ERROR', detail: `HTTP ${httpStatus}: ${message.slice(0, 220)}` };
}

async function callGoogle(
  token: string,
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; json: unknown; classified: Classified | null }> {
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, json: null, classified: classify(res.status, text) };
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { ok: true, json, classified: null };
}

export async function diagnoseGoogleAccess(business: Business): Promise<Diagnosis> {
  const checks: Check[] = [];
  let accountCount = 0;
  let locationCount = 0;

  // --- 1. Credentials ------------------------------------------------------
  let token: string | null = null;
  try {
    const auth = await getAuthorizedClient(business);
    token = (await auth.getAccessToken()).token ?? null;
    if (!token) throw new Error('Google returned no access token.');
    checks.push({
      id: 'credentials',
      label: 'OAuth credentials',
      status: 'OK',
      detail: 'Access token obtained — client ID, secret and refresh token are all valid.',
    });
  } catch (err) {
    checks.push({
      id: 'credentials',
      label: 'OAuth credentials',
      status: 'AUTH',
      detail: errorMessage(err),
    });
    return finish(checks, 0, 0);
  }

  // --- 2. Account Management API -------------------------------------------
  let firstAccount: string | null = null;
  {
    const r = await callGoogle(
      token,
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20',
    );
    if (r.ok) {
      const accounts = (r.json as { accounts?: { name?: string }[] }).accounts ?? [];
      accountCount = accounts.length;
      firstAccount = accounts[0]?.name ?? null;
      checks.push({
        id: 'accountManagement',
        label: 'My Business Account Management API',
        status: accountCount > 0 ? 'OK' : 'NO_ACCESS_TO_BUSINESS',
        detail:
          accountCount > 0
            ? `${accountCount} Business Profile account(s) visible.`
            : 'The API works, but this Google account manages no Business Profile accounts. Make sure it is an owner or manager of a verified business at business.google.com.',
      });
    } else {
      checks.push({
        id: 'accountManagement',
        label: 'My Business Account Management API',
        ...r.classified!,
      });
    }
  }

  // --- 3. Business Information API (needs an account) ----------------------
  let firstLocation: string | null = null;
  if (firstAccount) {
    const r = await callGoogle(
      token,
      `https://mybusinessbusinessinformation.googleapis.com/v1/${firstAccount}/locations?readMask=name,title&pageSize=100`,
    );
    if (r.ok) {
      const locations = (r.json as { locations?: { name?: string }[] }).locations ?? [];
      locationCount = locations.length;
      firstLocation = locations[0]?.name ?? null;
      checks.push({
        id: 'businessInformation',
        label: 'My Business Business Information API',
        status: locationCount > 0 ? 'OK' : 'NO_ACCESS_TO_BUSINESS',
        detail:
          locationCount > 0
            ? `${locationCount} location(s) found.`
            : 'The API works, but the account has no locations. Reviews can only be fetched for a verified location.',
      });
    } else {
      checks.push({
        id: 'businessInformation',
        label: 'My Business Business Information API',
        ...r.classified!,
      });
    }
  } else {
    checks.push({
      id: 'businessInformation',
      label: 'My Business Business Information API',
      status: 'SKIPPED',
      detail: 'Skipped — no Business Profile account to list locations for.',
    });
  }

  // --- 4. Legacy v4 API: the only source of reviews ------------------------
  if (firstAccount && firstLocation) {
    const accountId = firstAccount.split('/').pop();
    const locationId = firstLocation.split('/').pop();
    const r = await callGoogle(
      token,
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=1`,
    );
    if (r.ok) {
      const total = (r.json as { totalReviewCount?: number }).totalReviewCount ?? 0;
      checks.push({
        id: 'reviews',
        label: 'Google My Business API v4 (reviews)',
        status: 'OK',
        detail: `Reviews are readable — ${total} review(s) on the first location.`,
      });
    } else {
      checks.push({
        id: 'reviews',
        label: 'Google My Business API v4 (reviews)',
        ...r.classified!,
      });
    }
  } else {
    checks.push({
      id: 'reviews',
      label: 'Google My Business API v4 (reviews)',
      status: 'SKIPPED',
      detail: 'Skipped — needs a location, which the previous checks did not return.',
    });
  }

  const diagnosis = finish(checks, accountCount, locationCount);

  await logEvent({
    event: 'google.diagnosed',
    level: diagnosis.overall === 'READY' ? 'INFO' : 'WARN',
    message: diagnosis.summary,
    businessId: business.id,
    metadata: { checks: diagnosis.checks.map((c) => ({ id: c.id, status: c.status })) },
  });

  return diagnosis;
}

function finish(checks: Check[], accountCount: number, locationCount: number): Diagnosis {
  const has = (s: CheckStatus) => checks.some((c) => c.status === s);

  let overall: Diagnosis['overall'];
  let summary: string;

  if (has('AUTH')) {
    overall = 'NEEDS_RECONNECT';
    summary = 'Google rejected the stored credentials. Press Re-authorize to reconnect.';
  } else if (has('ACCESS_NOT_GRANTED')) {
    overall = 'WAITING_FOR_APPROVAL';
    summary =
      'Still waiting on Google. The APIs are enabled but the project has a 0/minute quota, which clears when the Business Profile API access request is approved.';
  } else if (has('NOT_ENABLED')) {
    overall = 'API_NOT_ENABLED';
    summary =
      'One or more Business Profile APIs are not enabled on the Google Cloud project. Enable them, then run this again.';
  } else if (has('ERROR')) {
    overall = 'ERROR';
    summary = 'Something unexpected came back from Google — see the failing check below.';
  } else if (has('NO_ACCESS_TO_BUSINESS') || accountCount === 0 || locationCount === 0) {
    overall = 'NO_BUSINESS_ACCESS';
    summary =
      'Google access works, but no verified Business Profile location is reachable from this account.';
  } else {
    overall = 'READY';
    summary = `Everything works — ${accountCount} account(s), ${locationCount} location(s). You can sync locations and fetch reviews.`;
  }

  return {
    checkedAt: new Date().toISOString(),
    overall,
    summary,
    checks,
    accountCount,
    locationCount,
  };
}
