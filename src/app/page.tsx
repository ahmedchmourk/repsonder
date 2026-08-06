import { AutoReplyCard } from '@/components/review/auto-reply-card';
import { ApprovalCard } from '@/components/review/approval-card';
import { EscalationCard } from '@/components/review/escalation-card';
import { EmptyState } from '@/components/empty-state';
import { RunJobButton } from '@/components/run-job-button';
import { SetupNotice } from '@/components/setup-notice';
import { StatStrip } from '@/components/stat-strip';
import { ViewSwitcher } from '@/components/view-switcher';
import { BusinessSwitcher } from '@/components/business/business-switcher';
import { CreateBusinessForm } from '@/components/business/create-business-form';
import { SettingsPanel } from '@/components/settings/settings-panel';
import { TimeAgo } from '@/components/time-ago';
import { getConnectionStatus } from '@/lib/google';
import { getSchedulerInfo } from '@/lib/scheduler';
import { computeScheduledFor } from '@/lib/pipeline';
import { getCurrentBusiness, listBusinesses } from '@/lib/business';
import { parseView } from '@/lib/views';
import {
  getActivityLogs,
  getAutoRepliedReviews,
  getCronRuns,
  getDashboardStats,
  getEscalatedReviews,
  getLastSyncFailure,
  getLocations,
  getPendingApprovalReviews,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * The whole app is this one page. `?view=` selects which panel is shown, and the
 * selected business (a cookie) scopes every query.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; new?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const wantsNewBusiness = params.new === '1';

  const [business, businesses] = await Promise.all([getCurrentBusiness(), listBusinesses()]);

  // Nothing exists yet — the only thing to do is create a business.
  if (!business) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">
            Welcome to Responder
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Add the business whose Google reviews you want answered. You&apos;ll need its Google
            OAuth client ID and secret, an LLM API key, and a description of what the business does.
          </p>
        </div>
        <CreateBusinessForm />
      </div>
    );
  }

  const businessId = business.id;
  const currentDto = businesses.find((b) => b.id === businessId)!;

  const [stats, connection, locations, lastRuns] = await Promise.all([
    getDashboardStats(businessId),
    getConnectionStatus(business),
    getLocations(businessId),
    getCronRuns(businessId, 1),
  ]);

  const setupItems: string[] = [];
  if (!connection.connected) {
    setupItems.push(`${business.name} is not connected to Google yet.`);
  } else if (!connection.hasRefreshToken) {
    setupItems.push('The Google connection has no refresh token — reconnect it.');
  }
  if (connection.connected && locations.length === 0) {
    // The generic "no locations" line is useless on its own — the real reason is
    // in the last failed sync, so surface that instead when we have it.
    const lastFailure = await getLastSyncFailure(businessId);
    setupItems.push(
      lastFailure
        ? `Locations could not be synced: ${lastFailure}`
        : 'No locations have been synced yet — open Settings and press “Sync locations”.',
    );
  }
  if (!business.active) {
    setupItems.push('This business is paused — the cron jobs will skip it.');
  }

  const lastRun = lastRuns[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{business.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.total} review{stats.total === 1 ? '' : 's'} · {locations.length} location
            {locations.length === 1 ? '' : 's'}
            {lastRun ? (
              <>
                {' · last '}
                {lastRun.job} <TimeAgo value={lastRun.startedAt} />
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessSwitcher businesses={businesses} currentId={businessId} />
          <RunJobButton job="ingest" label="Fetch reviews" size="sm" />
          <RunJobButton job="publish" label="Send due replies" variant="secondary" size="sm" />
        </div>
      </div>

      <SetupNotice items={setupItems} />

      <StatStrip
        stats={[
          {
            label: 'Avg rating',
            value: stats.averageRating === null ? '—' : stats.averageRating.toFixed(1),
          },
          { label: 'Auto-replied', value: stats.autoReplied },
          {
            label: 'Needs approval',
            value: stats.pendingApproval,
            tone: stats.pendingApproval > 0 ? 'warning' : 'default',
          },
          {
            label: 'Action required',
            value: stats.needsAttention,
            tone: stats.needsAttention > 0 ? 'danger' : 'default',
          },
        ]}
      />

      <ViewSwitcher
        active={view}
        counts={{ approvals: stats.pendingApproval, escalations: stats.needsAttention }}
      />

      {view === 'auto' ? <AutoPanel businessId={businessId} /> : null}
      {view === 'approvals' ? (
        <ApprovalsPanel businessId={businessId} delayHours={business.minReplyDelayHours} />
      ) : null}
      {view === 'escalations' ? <EscalationsPanel businessId={businessId} /> : null}
      {view === 'settings' ? (
        <SettingsPanel
          business={currentDto}
          businessCount={businesses.length}
          connection={connection}
          locations={locations}
          runs={await getCronRuns(businessId, 6)}
          logs={await getActivityLogs(businessId, 10)}
          scheduler={getSchedulerInfo()}
          cronSecretConfigured={Boolean(process.env.CRON_SECRET)}
          baseUrl={process.env.APP_BASE_URL ?? 'http://localhost:3000'}
          showCreateForm={wantsNewBusiness}
        />
      ) : null}
    </div>
  );
}

function PanelHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

async function AutoPanel({ businessId }: { businessId: string }) {
  const reviews = await getAutoRepliedReviews(businessId);
  return (
    <div className="space-y-3">
      <PanelHint>4.0–5.0★ — drafted and published automatically after the 24-hour hold.</PanelHint>
      {reviews.length === 0 ? (
        <EmptyState
          title="Nothing auto-replied yet"
          description="4★ and 5★ reviews land here once ingested."
        />
      ) : (
        reviews.map((review) => <AutoReplyCard key={review.id} review={review} />)
      )}
    </div>
  );
}

async function ApprovalsPanel({
  businessId,
  delayHours,
}: {
  businessId: string;
  delayHours: number;
}) {
  const reviews = await getPendingApprovalReviews(businessId);
  return (
    <div className="space-y-3">
      <PanelHint>3.0–3.9★ — edit the draft if you want, then approve it.</PanelHint>
      {reviews.length === 0 ? (
        <EmptyState
          title="No drafts waiting"
          description="Middling reviews arrive here with a draft that needs your sign-off."
        />
      ) : (
        reviews.map((review) => (
          <ApprovalCard
            key={review.id}
            review={review}
            earliestPublishAt={computeScheduledFor(
              new Date(review.ingestedAt),
              delayHours,
            ).toISOString()}
          />
        ))
      )}
    </div>
  );
}

async function EscalationsPanel({ businessId }: { businessId: string }) {
  const reviews = await getEscalatedReviews(businessId);
  return (
    <div className="space-y-3">
      <PanelHint>
        1.0–2.9★ and sensitive reviews — no draft is generated, you write the reply.
      </PanelHint>
      {reviews.length === 0 ? (
        <EmptyState
          title="Nothing needs your attention"
          description="Low-rated or sensitive reviews appear here."
        />
      ) : (
        reviews.map((review) => <EscalationCard key={review.id} review={review} />)
      )}
    </div>
  );
}
