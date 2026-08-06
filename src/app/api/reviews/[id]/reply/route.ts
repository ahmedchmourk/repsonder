import { revalidatePath } from 'next/cache';
import { apiError, apiOk, readJson } from '@/lib/api';
import { sendManualReply } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/** Publish a human-written reply to an escalated review. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await readJson<{ content?: string }>(request);

    if (typeof body.content !== 'string') {
      throw new Error('The reply cannot be empty.');
    }

    await sendManualReply({ reviewId: id, content: body.content });

    revalidatePath('/');
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
