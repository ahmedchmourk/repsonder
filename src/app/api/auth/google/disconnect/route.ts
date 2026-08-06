import { revalidatePath } from 'next/cache';
import { apiError, apiOk } from '@/lib/api';
import { disconnectGoogle } from '@/lib/google';
import { getBusinessOrThrow, getCurrentBusiness } from '@/lib/business';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const requestedId = new URL(request.url).searchParams.get('businessId');
    const business = requestedId
      ? await getBusinessOrThrow(requestedId)
      : await getCurrentBusiness();
    if (!business) throw new Error('Business not found');

    await disconnectGoogle(business);
    revalidatePath('/');
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
