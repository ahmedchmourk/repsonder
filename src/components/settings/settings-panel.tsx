import { Suspense } from 'react';
import { AdvancedSettings } from './advanced-settings';
import { DiagnoseAccess } from './diagnose-access';
import { FlashMessage } from './flash-message';
import { GoogleConnectionCard } from './google-connection';
import { RedirectUriField } from './redirect-uri-field';
import { BusinessSettingsForm } from '@/components/business/business-settings-form';
import { BusinessTechnicalForm } from '@/components/business/business-technical-form';
import type { ConnectionStatus } from '@/lib/google';
import type { BusinessDTO } from '@/lib/business';
import type { LocationDTO } from '@/lib/queries';

/**
 * Setup, ordered by how often it is touched: connect once, describe the
 * organisation, and never open the third section.
 */
export function SettingsPanel({
  business,
  businessCount,
  connection,
  locations,
}: {
  business: BusinessDTO;
  businessCount: number;
  connection: ConnectionStatus;
  locations: LocationDTO[];
}) {
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <FlashMessage />
      </Suspense>

      <GoogleConnectionCard
        businessId={business.id}
        businessName={business.name}
        status={connection}
        locations={locations}
      />

      <BusinessSettingsForm business={business} />

      <AdvancedSettings>
        <DiagnoseAccess businessId={business.id} />
        <RedirectUriField
          businessId={business.id}
          redirectUri={connection.redirectUri}
          supported={connection.supportedRedirectUris}
        />
        <BusinessTechnicalForm business={business} canDelete={businessCount > 1} />
      </AdvancedSettings>
    </div>
  );
}
