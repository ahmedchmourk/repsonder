import { revalidatePath } from 'next/cache';
import { apiError, apiOk } from '@/lib/api';
import { selectBusiness } from '@/lib/business';

export const dynamic = 'force-dynamic';

/** Point the dashboard at a different business (stored in a cookie). */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const business = await selectBusiness(id);
    revalidatePath('/');
    return apiOk({ id: business.id, name: business.name });
  } catch (err) {
    return apiError(err);
  }
}
