import { prisma } from './prisma';

type Level = 'INFO' | 'WARN' | 'ERROR';

/**
 * Writes to the ActivityLog table. Logging must never break the pipeline, so
 * every failure here is swallowed after being echoed to stderr.
 */
export async function logEvent(opts: {
  event: string;
  message: string;
  level?: Level;
  businessId?: string | null;
  reviewId?: string | null;
  metadata?: unknown;
}): Promise<void> {
  const { event, message, level = 'INFO', businessId = null, reviewId = null, metadata } = opts;
  try {
    await prisma.activityLog.create({
      data: {
        event,
        message,
        level,
        businessId,
        reviewId,
        metadata: metadata === undefined ? null : JSON.stringify(metadata),
      },
    });
  } catch (err) {
    console.error('[responder] failed to write activity log', event, err);
  }
  const line = `[responder] ${level} ${event} — ${message}`;
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
