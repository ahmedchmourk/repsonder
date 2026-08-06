import { Suspense } from 'react';
import { ActivityLogCard } from './activity-log';
import { CronStatusCard } from './cron-status';
import { FlashMessage } from './flash-message';
import { GoogleConnectionCard } from './google-connection';
import { BusinessSettingsForm } from '@/components/business/business-settings-form';
import { CreateBusinessForm } from '@/components/business/create-business-form';
import type { ConnectionStatus } from '@/lib/google';
import type { BusinessDTO } from '@/lib/business';
import type { ActivityLogDTO, CronRunDTO, LocationDTO } from '@/lib/queries';

/** The Settings panel of the dashboard, scoped to the selected business. */
export function SettingsPanel({
  business,
  businessCount,
  connection,
  locations,
  runs,
  logs,
  scheduler,
  cronSecretConfigured,
  baseUrl,
  showCreateForm,
}: {
  business: BusinessDTO;
  businessCount: number;
  connection: ConnectionStatus;
  locations: LocationDTO[];
  runs: CronRunDTO[];
  logs: ActivityLogDTO[];
  scheduler: {
    enabled: boolean;
    started: boolean;
    ingestExpression: string;
    publishExpression: string;
    running: { ingest: boolean; publish: boolean };
  };
  cronSecretConfigured: boolean;
  baseUrl: string;
  showCreateForm: boolean;
}) {
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <FlashMessage />
      </Suspense>

      {showCreateForm ? <CreateBusinessForm compact /> : null}

      <GoogleConnectionCard
        businessId={business.id}
        businessName={business.name}
        status={connection}
        locations={locations}
      />

      <BusinessSettingsForm business={business} canDelete={businessCount > 1} />

      <CronStatusCard
        scheduler={scheduler}
        runs={runs}
        cronSecretConfigured={cronSecretConfigured}
        baseUrl={baseUrl}
      />

      <ActivityLogCard logs={logs} />
    </div>
  );
}
