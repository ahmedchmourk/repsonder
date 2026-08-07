import { AutoReplyCard } from '@/components/review/auto-reply-card';
import { ApprovalCard } from '@/components/review/approval-card';
import { EscalationCard } from '@/components/review/escalation-card';
import { EmptyState } from '@/components/empty-state';
import { RunJobButton } from '@/components/run-job-button';
import { SetupNotice } from '@/components/setup-notice';
import { StatStrip } from '@/components/stat-strip';
import { ViewSwitcher } from '@/components/view-switcher';
import { CreateBusinessForm } from '@/components/business/create-business-form';
import { SettingsPanel } from '@/components/settings/settings-panel';
import { getConnectionStatus } from '@/lib/google';
import { computeScheduledFor } from '@/lib/pipeline';
import { getCurrentBusiness, listBusinesses } from '@/lib/business';
import { friendlySyncProblem } from '@/lib/humanize';
import { parseView } from '@/lib/views';
import {
  getAutoRepliedReviews,
  getDashboardStats,
  getEscalatedReviews,
  getLastSyncFailure,
  getLocations,
  getPendingApprovalReviews,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; new?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const wantsNewBusiness = params.new === '1';

  const [business, businesses] = await Promise.all([getCurrentBusiness(), listBusinesses()]);

  // Nothing exists yet — the only thing to do is add an organisation.
  if (!business) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">
            Let&apos;s get you set up
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Add the organisation whose Google reviews you want handled. Once it&apos;s connected,
            Responder writes the easy replies for you and flags the ones that need you.
          </p>
        </div>
        <CreateBusinessForm />
      </div>
    );
  }

  const businessId = business.id;
  const currentDto = businesses.find((b) => b.id === businessId)!;

  const [stats, connection, locations] = await Promise.all([
    getDashboardStats(businessId),
    getConnectionStatus(business),
    getLocations(businessId),
  ]);

  const setupItems: string[] = [];
  if (!connection.connected) {
    setupItems.push(`Connect ${business.name} to Google to start receiving reviews.`);
  } else if (!connection.hasRefreshToken) {
    setupItems.push('Your Google connection needs renewing — open Setup and reconnect.');
  } else if (locations.length === 0) {
    // Never surface Google's raw wording here — it is long and technical.
    setupItems.push(
      friendlySyncProblem(await getLastSyncFailure(businessId)) ??
        'No locations loaded yet. Open Setup and refresh them.',
    );
  }
  if (!business.active) {
    setupItems.push('This organisation is paused, so nothing is being checked.');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">{business.name}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {stats.total === 0
              ? 'No reviews yet — they appear here automatically.'
              : `${stats.total} review${stats.total === 1 ? '' : 's'}, sorted for you.`}
          </p>
        </div>
        <RunJobButton job="ingest" label="Check for new reviews" />
      </div>

      <SetupNotice items={setupItems} />

      <StatStrip
        stats={[
          {
            label: 'Average rating',
            value: stats.averageRating === null ? '—' : stats.averageRating.toFixed(1),
          },
          { label: 'Replied for you', value: stats.autoReplied },
          {
            label: 'Waiting for you',
            value: stats.pendingApproval,
            tone: stats.pendingApproval > 0 ? 'warning' : 'default',
          },
          {
            label: 'Needs a person',
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
          showCreateForm={wantsNewBusiness}
        />
      ) : null}
    </div>
  );
}

function PanelHint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

async function AutoPanel({ businessId }: { businessId: string }) {
  const reviews = await getAutoRepliedReviews(businessId);
  return (
    <div className="space-y-3">
      <PanelHint>
        Happy customers. We wrote and sent the thank-you — nothing for you to do.
      </PanelHint>
      {reviews.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="When someone leaves a 4 or 5 star review, we reply for you and show it here."
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
      <PanelHint>
        Mixed reviews. We drafted a reply — read it, change anything you like, then send.
      </PanelHint>
      {reviews.length === 0 ? (
        <EmptyState
          title="Nothing waiting on you"
          description="Middling reviews arrive here with a ready-made reply for you to approve."
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
        Unhappy or sensitive reviews. We deliberately did not write anything — these deserve your
        own words.
      </PanelHint>
      {reviews.length === 0 ? (
        <EmptyState
          title="Nothing needs you right now"
          description="Low ratings and anything sensitive land here so a person can respond."
        />
      ) : (
        reviews.map((review) => <EscalationCard key={review.id} review={review} />)
      )}
    </div>
  );
}
