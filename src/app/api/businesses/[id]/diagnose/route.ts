import { apiError, apiOk } from '@/lib/api';
import { getBusinessOrThrow } from '@/lib/business';
import { diagnoseGoogleAccess } from '@/lib/diagnose';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Runs the Google access checks for one business and returns a structured report. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const business = await getBusinessOrThrow(id);
    return apiOk(await diagnoseGoogleAccess(business));
  } catch (err) {
    return apiError(err);
  }
}
