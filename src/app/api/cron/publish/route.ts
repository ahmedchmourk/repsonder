import { apiError, apiOk, assertCronAuthorized, unauthorizedResponse } from '@/lib/api';
import { runPublishDueAll } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Sends every scheduled reply whose 24-hour delay has elapsed, across all active
 * businesses.
 */
async function handle(request: Request) {
  try {
    assertCronAuthorized(request);
  } catch (err) {
    return unauthorizedResponse(err);
  }

  try {
    const { businesses, results } = await runPublishDueAll('cron');
    return apiOk({
      job: 'publish',
      businesses,
      due: results.reduce((n, r) => n + r.due, 0),
      published: results.reduce((n, r) => n + r.published, 0),
      errors: results.flatMap((r) => r.errors),
      perBusiness: results,
    });
  } catch (err) {
    return apiError(err);
  }
}

export const GET = handle;
export const POST = handle;
