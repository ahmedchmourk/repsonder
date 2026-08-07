import { Badge } from '@/components/ui/badge';
import { RunJobButton } from '@/components/run-job-button';
import { TimeAgo } from '@/components/time-ago';
import type { CronRunDTO } from '@/lib/queries';

/** Background job status. Advanced-only — the main screens never mention cron. */
export function CronStatusCard({
  scheduler,
  runs,
}: {
  scheduler: {
    enabled: boolean;
    started: boolean;
    ingestExpression: string;
    publishExpression: string;
    running: { ingest: boolean; publish: boolean };
  };
  runs: CronRunDTO[];
}) {
  const lastIngest = runs.find((r) => r.job === 'ingest');
  const lastPublish = runs.find((r) => r.job === 'publish');

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="micro-label">Background jobs</p>
        <Badge variant={scheduler.started && scheduler.enabled ? 'success' : 'warning'}>
          {scheduler.enabled ? (scheduler.started ? 'running' : 'idle') : 'disabled'}
        </Badge>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold">Check for new reviews</dt>
          <dd className="font-mono text-xs text-muted-foreground">{scheduler.ingestExpression}</dd>
          <dd className="text-xs text-muted-foreground">
            {lastIngest ? (
              <>
                last <TimeAgo value={lastIngest.startedAt} /> · {lastIngest.status.toLowerCase()}
              </>
            ) : (
              'never run'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold">Send due replies</dt>
          <dd className="font-mono text-xs text-muted-foreground">{scheduler.publishExpression}</dd>
          <dd className="text-xs text-muted-foreground">
            {lastPublish ? (
              <>
                last <TimeAgo value={lastPublish.startedAt} /> · {lastPublish.status.toLowerCase()}
              </>
            ) : (
              'never run'
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <RunJobButton job="publish" label="Send due replies now" variant="secondary" size="sm" />
      </div>

      {runs.length > 0 ? (
        <ul className="space-y-1 border-t border-border pt-2.5">
          {runs.slice(0, 5).map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-2 text-xs">
              <Badge
                variant={
                  run.status === 'SUCCESS'
                    ? run.errorCount > 0
                      ? 'warning'
                      : 'success'
                    : 'destructive'
                }
              >
                {run.job}
              </Badge>
              <TimeAgo value={run.startedAt} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                {run.job === 'ingest'
                  ? `${run.reviewsFetched} fetched · ${run.reviewsNew} new`
                  : `${run.repliesPublished} published`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
