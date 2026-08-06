import type { Business } from '@prisma/client';
import { prisma } from './prisma';
import { errorMessage, logEvent } from './logger';
import {
  EXTERNAL_REPLY_MARKER,
  MAX_PUBLISH_ATTEMPTS,
  ROUTE,
  STATUS,
  type ReviewRoute,
} from './constants';
import {
  GoogleNotConnectedError,
  fetchReviewsForLocation,
  publishReplyToGoogle,
  syncLocations,
} from './google';
import { LLMNotConfiguredError, analyzeReview, generateReply } from './llm';
import { getBusinessOrThrow, listProcessableBusinesses } from './business';

/**
 * The routing pipeline.
 *
 *   ingest  → pull reviews from Google, store the new ones
 *   process → analyse each NEW review and route it
 *   publish → send replies whose 24h delay has elapsed
 *
 * The cron entry points run across **every** active, connected business. Which
 * business the dashboard is showing is a UI concern only.
 */

/** The single source of truth for the rating rules in the spec. */
export function routeFor(starRating: number, sensitive: boolean): ReviewRoute {
  if (sensitive) return ROUTE.ESCALATION;
  if (starRating >= 4) return ROUTE.AUTO_REPLY;
  if (starRating >= 3) return ROUTE.APPROVAL;
  return ROUTE.ESCALATION;
}

export function statusForRoute(route: ReviewRoute): string {
  switch (route) {
    case ROUTE.AUTO_REPLY:
      return STATUS.SCHEDULED;
    case ROUTE.APPROVAL:
      return STATUS.PENDING_APPROVAL;
    default:
      return STATUS.NEEDS_HUMAN_ATTENTION;
  }
}

/** Earliest legal publish time: ingestion + the business's minimum delay. */
export function computeScheduledFor(ingestedAt: Date, minHours: number): Date {
  return new Date(ingestedAt.getTime() + Math.max(24, minHours) * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export type IngestResult = {
  businessId: string;
  businessName: string;
  cronRunId: string;
  locations: number;
  fetched: number;
  created: number;
  processed: number;
  errors: string[];
};

/** Ingest for every active, connected business. */
export async function runIngestAll(
  trigger: 'cron' | 'manual' = 'cron',
): Promise<{ businesses: number; results: IngestResult[] }> {
  const businesses = await listProcessableBusinesses();
  if (businesses.length === 0) {
    await logEvent({
      event: 'ingest.no_businesses',
      level: 'WARN',
      message: 'No active business is connected to Google — nothing to ingest.',
    });
  }
  const results: IngestResult[] = [];
  for (const business of businesses) {
    results.push(await runIngest(business, trigger));
  }
  return { businesses: businesses.length, results };
}

export async function runIngest(
  business: Business,
  trigger: 'cron' | 'manual' = 'cron',
): Promise<IngestResult> {
  const run = await prisma.cronRun.create({
    data: { businessId: business.id, job: 'ingest', trigger },
  });
  const startedAt = Date.now();
  const errors: string[] = [];
  let fetched = 0;
  let created = 0;
  let processed = 0;
  let locationCount = 0;

  try {
    let locations = await prisma.location.findMany({
      where: { businessId: business.id, active: true },
    });

    // First run: discover the locations this account manages.
    if (locations.length === 0) {
      locations = (await syncLocations(business)).filter((l) => l.active);
    }
    locationCount = locations.length;

    if (locationCount === 0) {
      await logEvent({
        event: 'ingest.no_locations',
        level: 'WARN',
        message: 'No Google Business Profile locations available to ingest.',
        businessId: business.id,
      });
    }

    for (const location of locations) {
      try {
        const remote = await fetchReviewsForLocation(
          business,
          location.accountName,
          location.googleName,
        );
        fetched += remote.length;

        for (const r of remote) {
          const existing = await prisma.review.findUnique({
            where: { businessId_googleName: { businessId: business.id, googleName: r.name } },
          });

          if (existing) {
            // Keep the text in sync if the reviewer edited their review.
            const changed =
              existing.comment !== r.comment ||
              existing.starRating !== r.starRating ||
              existing.reviewUpdateTime.getTime() !== new Date(r.updateTime).getTime();
            if (changed) {
              await prisma.review.update({
                where: { id: existing.id },
                data: {
                  comment: r.comment,
                  starRating: r.starRating,
                  reviewUpdateTime: new Date(r.updateTime),
                },
              });
              await logEvent({
                event: 'review.updated',
                message: `Reviewer edited their review (${r.starRating}★)`,
                businessId: business.id,
                reviewId: existing.id,
              });
            }
            continue;
          }

          const alreadyAnswered = Boolean(r.reviewReply);
          const review = await prisma.review.create({
            data: {
              businessId: business.id,
              locationId: location.id,
              googleName: r.name,
              googleId: r.reviewId,
              reviewerName: r.reviewerName,
              reviewerPhotoUrl: r.reviewerPhotoUrl,
              starRating: r.starRating,
              comment: r.comment,
              reviewCreateTime: new Date(r.createTime),
              reviewUpdateTime: new Date(r.updateTime),
              preexistingReply: r.reviewReply?.comment ?? null,
              preexistingReplyTime: r.reviewReply ? new Date(r.reviewReply.updateTime) : null,
              // A review already answered on Google is recorded as published so
              // the pipeline never replies twice.
              status: alreadyAnswered ? STATUS.PUBLISHED : STATUS.NEW,
              ...(alreadyAnswered
                ? {
                    publishedReply: r.reviewReply?.comment,
                    publishedAt: new Date(r.reviewReply!.updateTime),
                    approvedBy: EXTERNAL_REPLY_MARKER,
                    processedAt: new Date(),
                  }
                : {}),
            },
          });
          created += 1;

          await logEvent({
            event: alreadyAnswered ? 'review.ingested_prereplied' : 'review.ingested',
            message: alreadyAnswered
              ? `Ingested ${r.starRating}★ review that already had a reply on Google`
              : `Ingested ${r.starRating}★ review from ${r.reviewerName}`,
            businessId: business.id,
            reviewId: review.id,
            metadata: { location: location.title },
          });
        }
      } catch (err) {
        const msg = `Location "${location.title}": ${errorMessage(err)}`;
        errors.push(msg);
        await logEvent({
          event: 'ingest.location_failed',
          level: 'ERROR',
          message: msg,
          businessId: business.id,
        });
      }
    }

    // Process everything still NEW, including leftovers from a failed run.
    const processResult = await processNewReviews(business);
    processed = processResult.processed;
    errors.push(...processResult.errors);

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        // The run completed; per-location failures are carried in errorCount.
        status: 'SUCCESS',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        reviewsFetched: fetched,
        reviewsNew: created,
        reviewsProcessed: processed,
        errorCount: errors.length,
        error: errors.length ? errors.slice(0, 5).join(' | ') : null,
      },
    });

    await logEvent({
      event: 'ingest.completed',
      level: errors.length ? 'WARN' : 'INFO',
      message: `Ingest finished: ${fetched} fetched, ${created} new, ${processed} processed${errors.length ? `, ${errors.length} error(s)` : ''}`,
      businessId: business.id,
      metadata: { locations: locationCount },
    });
  } catch (err) {
    const msg = errorMessage(err);
    errors.push(msg);
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        reviewsFetched: fetched,
        reviewsNew: created,
        reviewsProcessed: processed,
        errorCount: errors.length,
        error: msg.slice(0, 1000),
      },
    });
    await logEvent({
      event: 'ingest.failed',
      level: 'ERROR',
      message: msg,
      businessId: business.id,
    });
  }

  return {
    businessId: business.id,
    businessName: business.name,
    cronRunId: run.id,
    locations: locationCount,
    fetched,
    created,
    processed,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Process / route
// ---------------------------------------------------------------------------

export async function processNewReviews(
  business: Business,
): Promise<{ processed: number; errors: string[] }> {
  const pending = await prisma.review.findMany({
    where: { businessId: business.id, status: STATUS.NEW },
    orderBy: { reviewCreateTime: 'asc' },
  });

  const errors: string[] = [];
  let processed = 0;

  for (const review of pending) {
    try {
      await processReview(business, review.id);
      processed += 1;
    } catch (err) {
      const msg = `Review ${review.id}: ${errorMessage(err)}`;
      errors.push(msg);
      await prisma.review.update({
        where: { id: review.id },
        data: { lastError: msg.slice(0, 1000) },
      });
      await logEvent({
        event: 'review.process_failed',
        level: 'ERROR',
        message: msg,
        businessId: business.id,
        reviewId: review.id,
      });
      // An unconfigured LLM fails identically for every review — stop early.
      if (err instanceof LLMNotConfiguredError) break;
    }
  }

  return { processed, errors };
}

/** Analyse a single review, decide its route, and generate a draft if allowed. */
export async function processReview(business: Business, reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { location: true },
  });
  if (!review) throw new Error(`Review ${reviewId} not found`);

  const analysis = await analyzeReview(business, {
    starRating: review.starRating,
    comment: review.comment,
    reviewerName: review.reviewerName,
  });

  const route = routeFor(review.starRating, analysis.sensitive);
  const status = statusForRoute(route);

  // 1.0–2.9★ or sensitive: no public draft is generated at all.
  let draftContent: string | null = null;
  let draftMeta: { model: string; provider: string; promptVersion: string } | null = null;

  if (route === ROUTE.AUTO_REPLY || route === ROUTE.APPROVAL) {
    const generated = await generateReply(business, {
      starRating: review.starRating,
      comment: review.comment,
      reviewerName: review.reviewerName,
      locationTitle: review.location.title,
    });
    draftContent = generated.content;
    draftMeta = {
      model: generated.model,
      provider: generated.provider,
      promptVersion: generated.promptVersion,
    };
  }

  const scheduledFor =
    route === ROUTE.AUTO_REPLY
      ? computeScheduledFor(review.ingestedAt, business.minReplyDelayHours)
      : null;

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      route,
      status,
      sensitive: analysis.sensitive,
      sensitiveReasons: analysis.reasons.length ? JSON.stringify(analysis.reasons) : null,
      analysisSummary: analysis.summary,
      scheduledFor,
      processedAt: new Date(),
      lastError: null,
      ...(draftContent
        ? {
            drafts: {
              create: {
                content: draftContent,
                model: draftMeta?.model,
                provider: draftMeta?.provider,
                promptVersion: draftMeta?.promptVersion ?? 'v1',
              },
            },
          }
        : {}),
    },
  });

  await logEvent({
    event: 'review.routed',
    message: `${review.starRating}★${analysis.sensitive ? ' (sensitive)' : ''} → ${route} / ${status}${scheduledFor ? `, scheduled for ${scheduledFor.toISOString()}` : ''}`,
    businessId: business.id,
    reviewId: review.id,
    metadata: {
      route,
      status,
      sensitive: analysis.sensitive,
      reasons: analysis.reasons,
      analysisSource: analysis.source,
      draftGenerated: Boolean(draftContent),
    },
  });

  return updated;
}

/** Re-run the LLM for a review that already has a draft (dashboard action). */
export async function regenerateDraft(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { location: true, business: true },
  });
  if (!review) throw new Error('Review not found');
  if (review.status === STATUS.PUBLISHED) throw new Error('This review has already been answered.');
  if (review.route === ROUTE.ESCALATION) {
    throw new Error('Escalated reviews must be answered by a human — no draft is generated.');
  }

  const generated = await generateReply(review.business, {
    starRating: review.starRating,
    comment: review.comment,
    reviewerName: review.reviewerName,
    locationTitle: review.location.title,
  });

  const previousVersions = await prisma.draft.count({ where: { reviewId } });
  const draft = await prisma.draft.create({
    data: {
      reviewId,
      content: generated.content,
      model: generated.model,
      provider: generated.provider,
      promptVersion: generated.promptVersion,
      version: previousVersions + 1,
    },
  });

  await logEvent({
    event: 'draft.regenerated',
    message: `Regenerated draft (v${draft.version}) with ${generated.provider}/${generated.model}`,
    businessId: review.businessId,
    reviewId,
  });

  return draft;
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export type PublishResult = {
  businessId: string;
  businessName: string;
  cronRunId: string;
  due: number;
  published: number;
  errors: string[];
};

export async function runPublishDueAll(
  trigger: 'cron' | 'manual' = 'cron',
): Promise<{ businesses: number; results: PublishResult[] }> {
  const businesses = await listProcessableBusinesses();
  const results: PublishResult[] = [];
  for (const business of businesses) {
    results.push(await runPublishDue(business, trigger));
  }
  return { businesses: businesses.length, results };
}

/** Sends every approved/auto reply whose scheduled time has arrived. */
export async function runPublishDue(
  business: Business,
  trigger: 'cron' | 'manual' = 'cron',
): Promise<PublishResult> {
  const run = await prisma.cronRun.create({
    data: { businessId: business.id, job: 'publish', trigger },
  });
  const startedAt = Date.now();
  const errors: string[] = [];
  let published = 0;

  const due = await prisma.review.findMany({
    where: {
      businessId: business.id,
      status: STATUS.SCHEDULED,
      scheduledFor: { lte: new Date() },
      publishAttempts: { lt: MAX_PUBLISH_ATTEMPTS },
    },
    orderBy: { scheduledFor: 'asc' },
    include: { drafts: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  try {
    if (!business.autoPublishEnabled) {
      if (due.length > 0) {
        await logEvent({
          event: 'publish.paused',
          level: 'WARN',
          message: `Auto-publishing is disabled — ${due.length} reply(ies) are due but held.`,
          businessId: business.id,
        });
      }
    } else {
      for (const review of due) {
        const draft = review.drafts[0];
        if (!draft) {
          errors.push(`Review ${review.id} is scheduled but has no draft.`);
          await prisma.review.update({
            where: { id: review.id },
            data: { status: STATUS.NEEDS_HUMAN_ATTENTION, lastError: 'Scheduled without a draft.' },
          });
          continue;
        }

        try {
          await publishReplyToGoogle(business, review.googleName, draft.content);
          await prisma.review.update({
            where: { id: review.id },
            data: {
              status: STATUS.PUBLISHED,
              publishedAt: new Date(),
              publishedReply: draft.content,
              publishAttempts: { increment: 1 },
              lastError: null,
            },
          });
          published += 1;
          await logEvent({
            event: 'reply.published',
            message: `Published reply to ${review.starRating}★ review from ${review.reviewerName}`,
            businessId: business.id,
            reviewId: review.id,
            metadata: { scheduledFor: review.scheduledFor, approvedBy: review.approvedBy },
          });
        } catch (err) {
          const msg = errorMessage(err);
          errors.push(`Review ${review.id}: ${msg}`);
          const attempts = review.publishAttempts + 1;
          await prisma.review.update({
            where: { id: review.id },
            data: {
              publishAttempts: attempts,
              lastError: msg.slice(0, 1000),
              // Retry with a widening backoff; give up after MAX_PUBLISH_ATTEMPTS.
              ...(attempts >= MAX_PUBLISH_ATTEMPTS
                ? { status: STATUS.FAILED }
                : { scheduledFor: new Date(Date.now() + attempts * 30 * 60 * 1000) }),
            },
          });
          await logEvent({
            event:
              attempts >= MAX_PUBLISH_ATTEMPTS ? 'reply.publish_gave_up' : 'reply.publish_failed',
            level: 'ERROR',
            message: `Attempt ${attempts}/${MAX_PUBLISH_ATTEMPTS} failed: ${msg}`,
            businessId: business.id,
            reviewId: review.id,
          });
        }
      }
    }

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        repliesPublished: published,
        errorCount: errors.length,
        error: errors.length ? errors.slice(0, 5).join(' | ') : null,
      },
    });
  } catch (err) {
    const msg = errorMessage(err);
    errors.push(msg);
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        repliesPublished: published,
        errorCount: errors.length,
        error: msg.slice(0, 1000),
      },
    });
    await logEvent({
      event: 'publish.failed',
      level: 'ERROR',
      message: msg,
      businessId: business.id,
    });
  }

  return {
    businessId: business.id,
    businessName: business.name,
    cronRunId: run.id,
    due: due.length,
    published,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Human actions
// ---------------------------------------------------------------------------

/**
 * Approve a 3.0–3.9★ draft.
 *
 * The 24-hour floor still applies: if it hasn't elapsed, the reply is queued and
 * the publisher cron sends it at `scheduledFor`. `publishNow` overrides that
 * deliberately.
 */
export async function approveDraft(opts: {
  reviewId: string;
  content: string;
  approvedBy?: string;
  publishNow?: boolean;
}): Promise<{ published: boolean; scheduledFor: Date | null }> {
  const { reviewId, content, approvedBy = 'dashboard', publishNow = false } = opts;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { drafts: { orderBy: { createdAt: 'desc' }, take: 1 }, business: true },
  });
  if (!review) throw new Error('Review not found');
  if (review.status === STATUS.PUBLISHED) throw new Error('This review has already been answered.');

  const trimmed = content.trim();
  if (!trimmed) throw new Error('The reply cannot be empty.');

  const current = review.drafts[0];

  // Persist the human's text as the winning draft.
  if (current && current.content !== trimmed) {
    await prisma.draft.update({
      where: { id: current.id },
      data: { content: trimmed, humanEdited: true },
    });
  } else if (!current) {
    await prisma.draft.create({ data: { reviewId, content: trimmed, humanEdited: true } });
  }

  const earliest = computeScheduledFor(review.ingestedAt, review.business.minReplyDelayHours);
  const canPublishNow = publishNow || Date.now() >= earliest.getTime();

  if (!canPublishNow) {
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: STATUS.SCHEDULED,
        route: review.route ?? ROUTE.APPROVAL,
        scheduledFor: earliest,
        approvedBy,
        approvedAt: new Date(),
        lastError: null,
      },
    });
    await logEvent({
      event: 'draft.approved_scheduled',
      message: `Approved; queued for ${earliest.toISOString()} to respect the ${review.business.minReplyDelayHours}h delay`,
      businessId: review.businessId,
      reviewId,
    });
    return { published: false, scheduledFor: earliest };
  }

  await publishReplyToGoogle(review.business, review.googleName, trimmed);
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: STATUS.PUBLISHED,
      publishedAt: new Date(),
      publishedReply: trimmed,
      approvedBy,
      approvedAt: new Date(),
      publishAttempts: { increment: 1 },
      lastError: null,
    },
  });
  await logEvent({
    event: 'reply.published',
    message: `Approved and published reply to ${review.starRating}★ review from ${review.reviewerName}`,
    businessId: review.businessId,
    reviewId,
    metadata: { approvedBy, overrodeDelay: publishNow && Date.now() < earliest.getTime() },
  });

  return { published: true, scheduledFor: null };
}

/**
 * Send a human-written reply to an escalated (1.0–2.9★ or sensitive) review.
 * These publish immediately: a person wrote them, so there is no robotic-speed
 * concern, and slow responses to serious complaints make things worse.
 */
export async function sendManualReply(opts: {
  reviewId: string;
  content: string;
  author?: string;
}): Promise<void> {
  const { reviewId, content, author = 'dashboard' } = opts;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { business: true },
  });
  if (!review) throw new Error('Review not found');
  if (review.status === STATUS.PUBLISHED) throw new Error('This review has already been answered.');

  const trimmed = content.trim();
  if (!trimmed) throw new Error('The reply cannot be empty.');

  await publishReplyToGoogle(review.business, review.googleName, trimmed);

  await prisma.$transaction([
    prisma.draft.create({ data: { reviewId, content: trimmed, humanEdited: true } }),
    prisma.review.update({
      where: { id: reviewId },
      data: {
        status: STATUS.PUBLISHED,
        publishedAt: new Date(),
        publishedReply: trimmed,
        approvedBy: author,
        approvedAt: new Date(),
        publishAttempts: { increment: 1 },
        lastError: null,
      },
    }),
  ]);

  await logEvent({
    event: 'reply.published_manual',
    message: `Human reply published to ${review.starRating}★ review from ${review.reviewerName}`,
    businessId: review.businessId,
    reviewId,
    metadata: { author, sensitive: review.sensitive },
  });
}

export async function dismissReview(reviewId: string, reason?: string): Promise<void> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error('Review not found');
  if (review.status === STATUS.PUBLISHED) throw new Error('This review has already been answered.');

  await prisma.review.update({
    where: { id: reviewId },
    data: { status: STATUS.DISMISSED, scheduledFor: null },
  });
  await logEvent({
    event: 'review.dismissed',
    message: `Marked as handled without a public reply${reason ? `: ${reason}` : ''}`,
    businessId: review.businessId,
    reviewId,
  });
}

/** Move a review back into the human queue. */
export async function escalateReview(reviewId: string, reason?: string): Promise<void> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error('Review not found');
  if (review.status === STATUS.PUBLISHED) throw new Error('This review has already been answered.');

  const reasons: string[] = review.sensitiveReasons ? JSON.parse(review.sensitiveReasons) : [];
  if (reason) reasons.push(reason);

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: STATUS.NEEDS_HUMAN_ATTENTION,
      route: ROUTE.ESCALATION,
      sensitive: true,
      sensitiveReasons: reasons.length ? JSON.stringify(reasons) : null,
      scheduledFor: null,
    },
  });
  await logEvent({
    event: 'review.escalated',
    message: `Escalated to human attention${reason ? `: ${reason}` : ''}`,
    businessId: review.businessId,
    reviewId,
    level: 'WARN',
  });
}

export { GoogleNotConnectedError, LLMNotConfiguredError, getBusinessOrThrow };
