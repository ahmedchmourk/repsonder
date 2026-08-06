import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { apiError, apiOk } from '@/lib/api';
import { runIngest, runPublishDue } from '@/lib/pipeline';
import { getBusinessOrThrow, getCurrentBusiness } from '@/lib/business';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * UI-facing manual triggers. These run for **one** business (the selected one, or
 * `?businessId=`), unlike /api/cron/* which sweeps every connected business.
 * No shared secret is needed because they are only reachable from the dashboard.
 */
export async function POST(request: Request, ctx: { params: Promise<{ job: string }> }) {
  const { job } = await ctx.params;

  try {
    const requestedId = new URL(request.url).searchParams.get('businessId');
    const business = requestedId
      ? await getBusinessOrThrow(requestedId)
      : await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Create a business first.' }, { status: 409 });
    }

    if (job === 'ingest') {
      const result = await runIngest(business, 'manual');
      revalidatePath('/');
      return apiOk({ job, ...result });
    }

    if (job === 'publish') {
      const result = await runPublishDue(business, 'manual');
      revalidatePath('/');
      return apiOk({ job, ...result });
    }

    return NextResponse.json({ error: `Unknown job "${job}".` }, { status: 404 });
  } catch (err) {
    return apiError(err);
  }
}
