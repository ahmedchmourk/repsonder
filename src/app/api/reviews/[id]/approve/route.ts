import { revalidatePath } from 'next/cache';
import { apiError, apiOk, readJson } from '@/lib/api';
import { approveDraft } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/** Approve a 3.0–3.9★ draft (optionally edited) and publish or queue it. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await readJson<{ content?: string; publishNow?: boolean }>(request);

    if (typeof body.content !== 'string') {
      throw new Error('The reply cannot be empty.');
    }

    const result = await approveDraft({
      reviewId: id,
      content: body.content,
      publishNow: body.publishNow === true,
    });

    revalidatePath('/');
    return apiOk(result);
  } catch (err) {
    return apiError(err);
  }
}
