import cron, { type ScheduledTask } from 'node-cron';

/**
 * In-process scheduler, started once from `src/instrumentation.ts`.
 *
 * Two jobs:
 *  - ingest  (default 03:15 daily)  — the 24h fetch + route cycle
 *  - publish (default every 15 min) — sends replies whose delay has elapsed
 *
 * The jobs deliberately go through the app's own HTTP endpoints rather than
 * importing the pipeline directly. `src/instrumentation.ts` is compiled for the
 * Edge runtime as well as Node, and `googleapis` (which the pipeline pulls in)
 * needs Node built-ins — importing it here, statically *or* dynamically, breaks
 * that Edge build. Going over HTTP keeps this module's dependency graph to
 * `node-cron` alone, and exercises exactly the same code path an external
 * scheduler would.
 *
 * Set ENABLE_CRON=false to turn this off and drive /api/cron/* yourself
 * (system cron, QStash, GitHub Actions…).
 */

type SchedulerState = {
  started: boolean;
  tasks: ScheduledTask[];
  ingestExpression: string;
  publishExpression: string;
  running: { ingest: boolean; publish: boolean };
};

const globalForScheduler = globalThis as unknown as { __responderScheduler?: SchedulerState };

function state(): SchedulerState {
  globalForScheduler.__responderScheduler ??= {
    started: false,
    tasks: [],
    ingestExpression: process.env.INGEST_CRON ?? '15 3 * * *',
    publishExpression: process.env.PUBLISH_CRON ?? '*/15 * * * *',
    running: { ingest: false, publish: false },
  };
  return globalForScheduler.__responderScheduler;
}

/** Fires one job, guarding against overlap if it outlasts its own interval. */
async function guarded(job: 'ingest' | 'publish'): Promise<void> {
  const s = state();
  if (s.running[job]) {
    console.warn(`[responder] skipping ${job}: previous run is still in progress`);
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`[responder] cannot run ${job}: CRON_SECRET is not set.`);
    return;
  }

  const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  s.running[job] = true;

  try {
    const res = await fetch(`${base}/api/cron/${job}`, {
      method: 'POST',
      headers: { 'x-cron-secret': secret },
      cache: 'no-store',
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[responder] ${job} job failed (${res.status}): ${body.slice(0, 300)}`);
    } else {
      console.log(`[responder] ${job} job finished: ${body.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[responder] ${job} job could not be triggered:`, err);
  } finally {
    s.running[job] = false;
  }
}

export function startScheduler(): void {
  const s = state();
  if (s.started) return;

  if (process.env.ENABLE_CRON === 'false') {
    console.log('[responder] ENABLE_CRON=false — in-process scheduler disabled.');
    s.started = true;
    return;
  }

  const { ingestExpression, publishExpression } = s;

  if (!cron.validate(ingestExpression)) {
    console.error(`[responder] invalid INGEST_CRON "${ingestExpression}" — scheduler not started.`);
    return;
  }
  if (!cron.validate(publishExpression)) {
    console.error(`[responder] invalid PUBLISH_CRON "${publishExpression}" — scheduler not started.`);
    return;
  }
  if (!process.env.CRON_SECRET) {
    console.warn(
      '[responder] CRON_SECRET is not set — the scheduler will start but every run will be refused.',
    );
  }

  s.tasks.push(cron.schedule(ingestExpression, () => void guarded('ingest')));
  s.tasks.push(cron.schedule(publishExpression, () => void guarded('publish')));

  s.started = true;
  console.log(
    `[responder] scheduler started — ingest "${ingestExpression}", publish "${publishExpression}"`,
  );
}

export function stopScheduler(): void {
  const s = state();
  for (const task of s.tasks) task.stop();
  s.tasks = [];
  s.started = false;
}

export function getSchedulerInfo() {
  const s = state();
  return {
    enabled: process.env.ENABLE_CRON !== 'false',
    started: s.started,
    ingestExpression: s.ingestExpression,
    publishExpression: s.publishExpression,
    running: { ...s.running },
  };
}
