import { revalidatePath } from 'next/cache';
import { apiError, apiOk, readJson } from '@/lib/api';
import { createBusiness, listBusinesses, selectBusiness } from '@/lib/business';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return apiOk({ businesses: await listBusinesses() });
  } catch (err) {
    return apiError(err);
  }
}

/** Create a business and immediately make it the selected one. */
export async function POST(request: Request) {
  try {
    const body = await readJson<{
      name?: string;
      context?: string;
      googleClientId?: string;
      googleClientSecret?: string;
      googleRedirectUri?: string;
      llmProvider?: string;
      llmApiKey?: string;
      llmModel?: string;
      brandTone?: string;
      signature?: string;
      minReplyDelayHours?: number;
    }>(request);

    const business = await createBusiness({
      name: String(body.name ?? ''),
      context: String(body.context ?? ''),
      googleClientId: String(body.googleClientId ?? ''),
      googleClientSecret: String(body.googleClientSecret ?? ''),
      googleRedirectUri: body.googleRedirectUri,
      llmProvider: body.llmProvider === 'openai' ? 'openai' : 'gemini',
      llmApiKey: String(body.llmApiKey ?? ''),
      llmModel: body.llmModel,
      brandTone: body.brandTone,
      signature: body.signature,
      minReplyDelayHours: body.minReplyDelayHours,
    });

    await selectBusiness(business.id);
    revalidatePath('/');

    return apiOk({ id: business.id, name: business.name, slug: business.slug });
  } catch (err) {
    return apiError(err);
  }
}
