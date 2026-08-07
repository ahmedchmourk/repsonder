'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Link2, Loader2, MapPin, RefreshCw, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/client';
import { friendlySyncProblem } from '@/lib/humanize';
import type { ConnectionStatus } from '@/lib/google';
import type { LocationDTO } from '@/lib/queries';

/** Connect the Google account and show which locations Responder is watching. */
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
  const [busy, setBusy] = React.useState<'disconnect' | 'sync' | null>(null);

  const connectHref = `/api/auth/google/start?businessId=${businessId}`;

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
      toast({ title: `Found ${result.count} location(s)`, variant: 'success' });
      router.refresh();
    } catch (err) {
      // Google's own wording is a wall of text; show the short version here and
      // keep the full detail in Setup → Advanced → Diagnose.
      const raw = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Could not load your locations',
        description: friendlySyncProblem(raw) ?? raw,
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="soft">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Google Business Profile</CardTitle>
            <CardDescription>
              {status.connected
                ? `Responder is watching reviews for ${businessName}.`
                : 'Connect the Google account that manages your business, and reviews start arriving here.'}
            </CardDescription>
          </div>
          {status.connected ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3" aria-hidden />
              Connected
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status.connected ? (
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{status.email}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {status.connected ? (
            <>
              <Button variant="secondary" onClick={syncLocations} disabled={busy !== null} size="sm">
                {busy === 'sync' ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw aria-hidden />
                )}
                Refresh locations
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
            <Button asChild>
              <a href={connectHref}>
                <Link2 aria-hidden />
                Connect Google account
              </a>
            </Button>
          )}
        </div>

        {locations.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {locations.map((loc) => (
              <li key={loc.id} className="flex items-center gap-3 bg-card px-4 py-3">
                <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{loc.title}</p>
                  {loc.address ? (
                    <p className="truncate text-xs text-muted-foreground">{loc.address}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {loc.reviewCount} review{loc.reviewCount === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
