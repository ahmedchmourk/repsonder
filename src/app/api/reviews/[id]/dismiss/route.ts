import { revalidatePath } from 'next/cache';
import { apiError, apiOk } from '@/lib/api';
import { dismissReview } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/** Mark a review as handled without publishing anything. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    let reason: string | undefined;
    try {
      reason = ((await request.json()) as { reason?: string }).reason;
    } catch {
      // Body is optional.
    }
    await dismissReview(id, reason);
    revalidatePath('/');
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
