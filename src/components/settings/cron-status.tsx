import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RunJobButton } from '@/components/run-job-button';
import { TimeAgo } from '@/components/time-ago';
import type { CronRunDTO } from '@/lib/queries';

export function CronStatusCard({
  scheduler,
  runs,
  cronSecretConfigured,
  baseUrl,
}: {
  scheduler: {
    enabled: boolean;
    started: boolean;
    ingestExpression: string;
    publishExpression: string;
    running: { ingest: boolean; publish: boolean };
  };
  runs: CronRunDTO[];
  cronSecretConfigured: boolean;
  baseUrl: string;
}) {
  const lastIngest = runs.find((r) => r.job === 'ingest');
  const lastPublish = runs.find((r) => r.job === 'publish');

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Scheduled processing</CardTitle>
            <CardDescription>
              Reviews are fetched every 24 hours, and each reply is held 24 hours after ingestion.
            </CardDescription>
          </div>
          {scheduler.enabled ? (
            <Badge variant={scheduler.started ? 'success' : 'warning'}>
              {scheduler.started ? 'Running' : 'Idle'}
            </Badge>
          ) : (
            <Badge variant="outline">Disabled</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <JobRow
            label="Ingest"
            expression={scheduler.ingestExpression}
            run={lastIngest}
            running={scheduler.running.ingest}
          />
          <JobRow
            label="Publisher"
            expression={scheduler.publishExpression}
            run={lastPublish}
            running={scheduler.running.publish}
          />
        </dl>

        <div className="flex flex-wrap gap-2">
          <RunJobButton job="ingest" label="Run ingest" size="sm" />
          <RunJobButton job="publish" label="Run publisher" variant="secondary" size="sm" />
        </div>

        <details className="group rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Run from an external scheduler instead
          </summary>
          <div className="mt-2.5 space-y-2 text-xs text-muted-foreground">
            <p className="leading-relaxed">
              Set <code className="font-mono">ENABLE_CRON=false</code>, then POST to these with the
              secret as <code className="font-mono">x-cron-secret</code>,{' '}
              <code className="font-mono">Authorization: Bearer …</code>, or{' '}
              <code className="font-mono">?secret=</code>.
            </p>
            <ul className="space-y-0.5 font-mono">
              <li className="truncate">POST {baseUrl}/api/cron/ingest</li>
              <li className="truncate">POST {baseUrl}/api/cron/publish</li>
            </ul>
            {cronSecretConfigured ? (
              <Badge variant="success">CRON_SECRET is set</Badge>
            ) : (
              <Badge variant="destructive">CRON_SECRET missing — endpoints return 503</Badge>
            )}
          </div>
        </details>

        {runs.length > 0 ? (
          <details className="group rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
              Recent runs ({runs.length})
            </summary>
            <ul className="mt-2.5 space-y-1.5">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <Badge
                    variant={
                      run.status === 'SUCCESS'
                        ? run.errorCount > 0
                          ? 'warning'
                          : 'success'
                        : run.status === 'FAILED'
                          ? 'destructive'
                          : 'info'
                    }
                  >
                    {run.job}
                  </Badge>
                  <TimeAgo value={run.startedAt} className="text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {run.job === 'ingest'
                      ? `${run.reviewsFetched} fetched · ${run.reviewsNew} new · ${run.reviewsProcessed} routed`
                      : `${run.repliesPublished} published`}
                  </span>
                  {run.error ? (
                    <span className="w-full truncate text-red-600 dark:text-red-400">
                      {run.error}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function JobRow({
  label,
  expression,
  run,
  running,
}: {
  label: string;
  expression: string;
  run: CronRunDTO | undefined;
  running: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold">{expression}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">
        {run ? (
          <>
            <TimeAgo value={run.startedAt} /> · {run.status.toLowerCase()}
          </>
        ) : (
          'never run'
        )}
        {running ? ' · running now' : ''}
      </dd>
    </div>
  );
}
