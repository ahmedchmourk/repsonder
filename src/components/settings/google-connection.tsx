'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Link2, Loader2, RefreshCw, Unlink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { AbsoluteTime } from '@/components/time-ago';
import { DiagnoseAccess } from './diagnose-access';
import { postJson, putJson } from '@/lib/client';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/lib/google';
import type { LocationDTO } from '@/lib/queries';

export function GoogleConnectionCard({
  businessId,
  businessName,
  status,
  locations,
}: {
  businessId: string;
  businessName: string;
  status: ConnectionStatus;
  locations: LocationDTO[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<'disconnect' | 'sync' | 'connect' | null>(null);
  const [uri, setUri] = React.useState(status.redirectUri);
  const connectHref = `/api/auth/google/start?businessId=${businessId}`;

  React.useEffect(() => setUri(status.redirectUri), [status.redirectUri]);

  const uriChanged = uri.trim() !== status.redirectUri;

  /**
   * Saves the typed redirect URI first, then starts the consent flow — the value
   * used to build the consent URL must be the one Google has registered.
   */
  async function saveAndConnect() {
    setBusy('connect');
    try {
      if (uriChanged) {
        await putJson(`/api/businesses/${businessId}`, { googleRedirectUri: uri.trim() });
      }
      window.location.href = connectHref;
    } catch (err) {
      toast({
        title: 'Could not save the redirect URI',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    try {
      await postJson(`/api/auth/google/disconnect?businessId=${businessId}`);
      toast({ title: 'Google account disconnected', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not disconnect',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function syncLocations() {
    setBusy('sync');
    try {
      const result = await postJson<{ count: number }>(
        `/api/locations/sync?businessId=${businessId}`,
      );
      toast({ title: `Synced ${result.count} location(s)`, variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not sync locations',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Google Business Profile</CardTitle>
            <CardDescription>
              OAuth 2.0 with offline access, using {businessName}&apos;s own client credentials.
            </CardDescription>
          </div>
          {status.connected ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3" aria-hidden />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="size-3" aria-hidden />
              Not connected
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status.connected ? (
          <>
            <p className="text-sm">
              <span className="font-semibold">{status.email ?? 'Connected account'}</span>
              {status.hasRefreshToken ? (
                <span className="text-muted-foreground"> · refresh token stored (encrypted)</span>
              ) : (
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {' '}
                  · refresh token missing, reconnect required
                </span>
              )}
            </p>

            <details className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                Token details
              </summary>
              <dl className="mt-2.5 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
                <Row label="Connected at">
                  {status.connectedAt ? <AbsoluteTime value={status.connectedAt} /> : '—'}
                </Row>
                <Row label="Access token expires">
                  {status.accessTokenExpiresAt ? (
                    <AbsoluteTime value={status.accessTokenExpiresAt} />
                  ) : (
                    '—'
                  )}
                </Row>
                <Row label="Scopes" className="sm:col-span-2">
                  <span className="break-all font-mono text-xs">{status.scope ?? '—'}</span>
                </Row>
              </dl>
            </details>
          </>
        ) : null}

        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3.5">
          <Label htmlFor="redirectUri" className="micro-label">
            Authorized redirect URI
          </Label>
          <Input
            id="redirectUri"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
            placeholder={status.supportedRedirectUris[0]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Type the URI exactly as it is registered on the OAuth client in Google Cloud. A mismatch
            is what causes <code className="font-mono">redirect_uri_mismatch</code>. This app answers
            on both of these:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {status.supportedRedirectUris.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setUri(option)}
                className={cn(
                  'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                  uri.trim() === option
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {option.replace(/^https?:\/\/[^/]+/, '')}
              </button>
            ))}
          </div>
          {uriChanged ? (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Unsaved — it is saved automatically when you connect.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {status.connected ? (
            <>
              <Button variant="secondary" onClick={syncLocations} disabled={busy !== null} size="sm">
                {busy === 'sync' ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw aria-hidden />
                )}
                Sync locations
              </Button>
              <Button variant="secondary" onClick={saveAndConnect} disabled={busy !== null} size="sm">
                {busy === 'connect' ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Link2 aria-hidden />
                )}
                Re-authorize
              </Button>
              <Button variant="ghost" onClick={disconnect} disabled={busy !== null} size="sm">
                {busy === 'disconnect' ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Unlink aria-hidden />
                )}
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={saveAndConnect} disabled={busy !== null} size="sm">
              {busy === 'connect' ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Link2 aria-hidden />
              )}
              {uriChanged ? 'Save URI & connect' : 'Connect Google account'}
            </Button>
          )}
        </div>

        {status.connected ? <DiagnoseAccess businessId={businessId} /> : null}

        <div>
          <p className="micro-label">Locations ({locations.length})</p>
          {locations.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              None yet. Connect the account and press “Sync locations”.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-card px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{loc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {loc.address ?? loc.googleName}
                    </p>
                  </div>
                  <Badge variant="secondary">{loc.reviewCount} reviews</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
