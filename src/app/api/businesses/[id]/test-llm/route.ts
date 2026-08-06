import { apiError, apiOk } from '@/lib/api';
import { getBusinessOrThrow } from '@/lib/business';
import { testLLMConnection } from '@/lib/llm';
import { logEvent } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const business = await getBusinessOrThrow(id);
    const result = await testLLMConnection(business);
    await logEvent({
      event: 'llm.test_ok',
      message: `LLM reachable: ${result.provider}/${result.model}`,
      businessId: id,
    });
    return apiOk(result);
  } catch (err) {
    return apiError(err);
  }
}
