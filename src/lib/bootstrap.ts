import 'server-only';
import { startScheduler } from './scheduler';

/**
 * Boots the node-cron scheduler exactly once per server process.
 *
 * This is called from the root layout and from the cron/job route handlers
 * rather than from `instrumentation.ts`: Next.js compiles instrumentation for
 * the Edge runtime as well as Node, and `node-cron` needs `path`/`child_process`,
 * which do not exist there. Server components and route handlers always run on
 * Node, so booting from here is safe. `startScheduler()` is idempotent — it
 * keeps its state on `globalThis` and returns immediately once started.
 */
export function ensureSchedulerStarted(): void {
  try {
    startScheduler();
  } catch (err) {
    console.error('[responder] failed to start the scheduler', err);
  }
}
