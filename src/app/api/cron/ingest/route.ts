import { apiError, apiOk, assertCronAuthorized, unauthorizedResponse } from '@/lib/api';
import { runIngestAll } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The 24-hour cycle, across **every** active business connected to Google:
 * fetch reviews, route them, generate drafts.
 *
 * Protected by CRON_SECRET so an external scheduler (system cron, QStash,
 * GitHub Actions) can call it. GET and POST behave identically.
 */
async function handle(request: Request) {
  try {
    assertCronAuthorized(request);
  } catch (err) {
    return unauthorizedResponse(err);
  }

  try {
    const { businesses, results } = await runIngestAll('cron');
    return apiOk({
      job: 'ingest',
      businesses,
      fetched: results.reduce((n, r) => n + r.fetched, 0),
      created: results.reduce((n, r) => n + r.created, 0),
      processed: results.reduce((n, r) => n + r.processed, 0),
      errors: results.flatMap((r) => r.errors),
      perBusiness: results,
    });
  } catch (err) {
    return apiError(err);
  }
}

export const GET = handle;
export const POST = handle;
