import { revalidatePath } from 'next/cache';
import { apiError, apiOk } from '@/lib/api';
import { escalateReview } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/** Push a review out of the approval queue and into human escalation. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    let reason: string | undefined;
    try {
      reason = ((await request.json()) as { reason?: string }).reason;
    } catch {
      // Body is optional.
    }
    await escalateReview(id, reason ?? 'Escalated manually from the dashboard');
    revalidatePath('/');
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
