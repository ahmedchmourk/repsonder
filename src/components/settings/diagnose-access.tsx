'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CircleSlash,
  Clock,
  ExternalLink,
  Loader2,
  Stethoscope,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { AbsoluteTime } from '@/components/time-ago';
import { postJson } from '@/lib/client';
import { cn } from '@/lib/utils';
import type { Check, CheckStatus, Diagnosis } from '@/lib/diagnose';

const STATUS_META: Record<
  CheckStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info'; icon: React.ElementType }
> = {
  OK: { label: 'ok', variant: 'success', icon: CheckCircle2 },
  ACCESS_NOT_GRANTED: { label: 'awaiting approval', variant: 'warning', icon: Clock },
  NOT_ENABLED: { label: 'not enabled', variant: 'destructive', icon: XCircle },
  AUTH: { label: 'reconnect needed', variant: 'destructive', icon: XCircle },
  NO_ACCESS_TO_BUSINESS: { label: 'no access', variant: 'warning', icon: TriangleAlert },
  SKIPPED: { label: 'skipped', variant: 'secondary', icon: CircleSlash },
  ERROR: { label: 'error', variant: 'destructive', icon: TriangleAlert },
};

const OVERALL_META: Record<
  Diagnosis['overall'],
  { tone: 'ok' | 'warn' | 'bad'; heading: string }
> = {
  READY: { tone: 'ok', heading: 'Ready to go' },
  WAITING_FOR_APPROVAL: { tone: 'warn', heading: 'Waiting on Google approval' },
  API_NOT_ENABLED: { tone: 'bad', heading: 'An API is not enabled' },
  NEEDS_RECONNECT: { tone: 'bad', heading: 'Reconnect required' },
  NO_BUSINESS_ACCESS: { tone: 'warn', heading: 'No reachable business location' },
  ERROR: { tone: 'bad', heading: 'Unexpected response from Google' },
};

/**
 * One-click check of everything between this app and Google's review data, so the
 * approval status can be read without digging through the Cloud console.
 */
export function DiagnoseAccess({ businessId }: { businessId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Diagnosis | null>(null);

  async function run() {
    setBusy(true);
    try {
      const diagnosis = await postJson<Diagnosis>(`/api/businesses/${businessId}/diagnose`);
      setResult(diagnosis);
      toast({
        title: OVERALL_META[diagnosis.overall].heading,
        description: diagnosis.summary,
        variant: diagnosis.overall === 'READY' ? 'success' : 'default',
      });
      // A newly-working connection may mean locations can now be synced.
      if (diagnosis.overall === 'READY') router.refresh();
    } catch (err) {
      toast({
        title: 'Could not run the diagnosis',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  const overall = result ? OVERALL_META[result.overall] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Stethoscope aria-hidden />}
          {busy ? 'Checking Google…' : 'Diagnose Google access'}
        </Button>
        {result ? (
          <span className="text-xs text-muted-foreground">
            checked <AbsoluteTime value={result.checkedAt} />
          </span>
        ) : null}
      </div>

      {result && overall ? (
        <div
          className={cn(
            'space-y-3 rounded-xl border p-3.5',
            overall.tone === 'ok' && 'border-emerald-500/25 bg-emerald-500/10',
            overall.tone === 'warn' && 'border-amber-500/25 bg-amber-500/10',
            overall.tone === 'bad' && 'border-red-500/25 bg-red-500/10',
          )}
        >
          <div>
            <p
              className={cn(
                'font-heading text-sm font-bold tracking-tight',
                overall.tone === 'ok' && 'text-emerald-700 dark:text-emerald-400',
                overall.tone === 'warn' && 'text-amber-700 dark:text-amber-400',
                overall.tone === 'bad' && 'text-red-700 dark:text-red-400',
              )}
            >
              {overall.heading}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/80">{result.summary}</p>
          </div>

          <ul className="space-y-2">
            {result.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>

          {result.overall === 'WAITING_FOR_APPROVAL' ? (
            <p className="border-t border-amber-500/20 pt-2.5 text-xs leading-relaxed text-foreground/80">
              Nothing to change on your side — the quota lifts when Google approves the request. Run
              this again in a day.{' '}
              <a
                className="font-semibold underline underline-offset-2"
                href="https://developers.google.com/my-business/content/prereqs#request-access"
                target="_blank"
                rel="noopener noreferrer"
              >
                Access request form
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;

  return (
    <li className="flex items-start gap-2.5">
      <Icon
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          meta.variant === 'success' && 'text-emerald-500',
          meta.variant === 'warning' && 'text-amber-500',
          meta.variant === 'destructive' && 'text-red-500',
          meta.variant === 'secondary' && 'text-muted-foreground',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold">{check.label}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
        {check.actionUrl ? (
          <a
            href={check.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Enable it in Google Cloud
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </li>
  );
}
