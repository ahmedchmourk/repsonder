import { revalidatePath } from 'next/cache';
import { apiError, apiOk } from '@/lib/api';
import { syncLocations } from '@/lib/google';
import { getBusinessOrThrow, getCurrentBusiness } from '@/lib/business';

export const dynamic = 'force-dynamic';

/** Re-read the connected account's locations from Google. */
export async function POST(request: Request) {
  try {
    const requestedId = new URL(request.url).searchParams.get('businessId');
    const business = requestedId
      ? await getBusinessOrThrow(requestedId)
      : await getCurrentBusiness();
    if (!business) throw new Error('Business not found');

    const locations = await syncLocations(business);
    revalidatePath('/');
    return apiOk({ count: locations.length, locations: locations.length });
  } catch (err) {
    return apiError(err);
  }
}
