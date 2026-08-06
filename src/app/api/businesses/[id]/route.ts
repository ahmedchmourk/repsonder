import { revalidatePath } from 'next/cache';
import { apiError, apiOk, readJson } from '@/lib/api';
import { deleteBusiness, updateBusiness, type UpdateBusinessInput } from '@/lib/business';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await readJson<Record<string, unknown>>(request);

    const input: UpdateBusinessInput = {};
    if (typeof body.name === 'string') input.name = body.name;
    if (typeof body.context === 'string') input.context = body.context;
    if (typeof body.brandTone === 'string') input.brandTone = body.brandTone;
    if (typeof body.signature === 'string') input.signature = body.signature;
    if (typeof body.googleClientId === 'string') input.googleClientId = body.googleClientId;
    if (typeof body.googleClientSecret === 'string') {
      input.googleClientSecret = body.googleClientSecret;
    }
    if (typeof body.googleRedirectUri === 'string') {
      input.googleRedirectUri = body.googleRedirectUri;
    }
    if (body.llmProvider === 'openai' || body.llmProvider === 'gemini') {
      input.llmProvider = body.llmProvider;
    }
    if (typeof body.llmModel === 'string') input.llmModel = body.llmModel;
    if (typeof body.llmApiKey === 'string') input.llmApiKey = body.llmApiKey;
    if (body.minReplyDelayHours !== undefined) {
      input.minReplyDelayHours = Number(body.minReplyDelayHours);
    }
    if (typeof body.autoPublishEnabled === 'boolean') {
      input.autoPublishEnabled = body.autoPublishEnabled;
    }
    if (typeof body.active === 'boolean') input.active = body.active;

    await updateBusiness(id, input);
    revalidatePath('/');
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await deleteBusiness(id);
    revalidatePath('/');
    return apiOk({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
