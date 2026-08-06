import { revalidatePath } from 'next/cache';
import { apiError, apiOk } from '@/lib/api';
import { regenerateDraft } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/** Ask the LLM for a fresh draft. Refused for escalated reviews. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const draft = await regenerateDraft(id);
    revalidatePath('/');
    return apiOk({ content: draft.content, version: draft.version, model: draft.model });
  } catch (err) {
    return apiError(err);
  }
}
