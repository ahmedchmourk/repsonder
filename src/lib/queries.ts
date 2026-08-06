import { prisma } from './prisma';
import { AUTO_REPLIED_STATUSES, STATUS } from './constants';
import { parseReasons } from './utils';

/**
 * Read models for the UI. Every query is scoped to one business, and Prisma rows
 * are converted to plain JSON-safe objects so they can cross the server/client
 * boundary.
 */

export type ReviewDTO = {
  id: string;
  googleName: string;
  reviewerName: string;
  reviewerPhotoUrl: string | null;
  starRating: number;
  comment: string | null;
  reviewCreateTime: string;
  ingestedAt: string;
  processedAt: string | null;
  status: string;
  route: string | null;
  sensitive: boolean;
  sensitiveReasons: string[];
  analysisSummary: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishedReply: string | null;
  preexistingReply: string | null;
  approvedBy: string | null;
  publishAttempts: number;
  lastError: string | null;
  locationTitle: string;
  draft: {
    id: string;
    content: string;
    model: string | null;
    provider: string | null;
    humanEdited: boolean;
    version: number;
    createdAt: string;
  } | null;
};

const reviewInclude = {
  location: { select: { title: true } },
  drafts: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

type ReviewRow = Awaited<
  ReturnType<typeof prisma.review.findMany<{ include: typeof reviewInclude }>>
>[number];

export function toReviewDTO(row: ReviewRow): ReviewDTO {
  const draft = row.drafts[0];
  return {
    id: row.id,
    googleName: row.googleName,
    reviewerName: row.reviewerName,
    reviewerPhotoUrl: row.reviewerPhotoUrl,
    starRating: row.starRating,
    comment: row.comment,
    reviewCreateTime: row.reviewCreateTime.toISOString(),
    ingestedAt: row.ingestedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
    status: row.status,
    route: row.route,
    sensitive: row.sensitive,
    sensitiveReasons: parseReasons(row.sensitiveReasons),
    analysisSummary: row.analysisSummary,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedReply: row.publishedReply,
    preexistingReply: row.preexistingReply,
    approvedBy: row.approvedBy,
    publishAttempts: row.publishAttempts,
    lastError: row.lastError,
    locationTitle: row.location.title,
    draft: draft
      ? {
          id: draft.id,
          content: draft.content,
          model: draft.model,
          provider: draft.provider,
          humanEdited: draft.humanEdited,
          version: draft.version,
          createdAt: draft.createdAt.toISOString(),
        }
      : null,
  };
}

export async function getAutoRepliedReviews(businessId: string): Promise<ReviewDTO[]> {
  const rows = await prisma.review.findMany({
    where: { businessId, status: { in: AUTO_REPLIED_STATUSES } },
    include: reviewInclude,
    orderBy: [{ scheduledFor: 'asc' }, { publishedAt: 'desc' }],
    take: 200,
  });
  return rows.map(toReviewDTO);
}

export async function getPendingApprovalReviews(businessId: string): Promise<ReviewDTO[]> {
  const rows = await prisma.review.findMany({
    where: { businessId, status: STATUS.PENDING_APPROVAL },
    include: reviewInclude,
    orderBy: { reviewCreateTime: 'asc' },
    take: 200,
  });
  return rows.map(toReviewDTO);
}

export async function getEscalatedReviews(businessId: string): Promise<ReviewDTO[]> {
  const rows = await prisma.review.findMany({
    where: { businessId, status: { in: [STATUS.NEEDS_HUMAN_ATTENTION, STATUS.FAILED] } },
    include: reviewInclude,
    orderBy: [{ sensitive: 'desc' }, { starRating: 'asc' }, { reviewCreateTime: 'asc' }],
    take: 200,
  });
  return rows.map(toReviewDTO);
}

export type DashboardStats = {
  total: number;
  autoReplied: number;
  scheduled: number;
  pendingApproval: number;
  needsAttention: number;
  published: number;
  failed: number;
  averageRating: number | null;
  nextScheduledAt: string | null;
};

export async function getDashboardStats(businessId: string): Promise<DashboardStats> {
  const [grouped, total, agg, next] = await Promise.all([
    prisma.review.groupBy({ by: ['status'], where: { businessId }, _count: { _all: true } }),
    prisma.review.count({ where: { businessId } }),
    prisma.review.aggregate({ where: { businessId }, _avg: { starRating: true } }),
    prisma.review.findFirst({
      where: { businessId, status: STATUS.SCHEDULED, scheduledFor: { not: null } },
      orderBy: { scheduledFor: 'asc' },
      select: { scheduledFor: true },
    }),
  ]);

  const count = (status: string) => grouped.find((g) => g.status === status)?._count._all ?? 0;

  const scheduled = count(STATUS.SCHEDULED);
  const published = count(STATUS.PUBLISHED);

  return {
    total,
    autoReplied: scheduled + published,
    scheduled,
    pendingApproval: count(STATUS.PENDING_APPROVAL),
    needsAttention: count(STATUS.NEEDS_HUMAN_ATTENTION) + count(STATUS.FAILED),
    published,
    failed: count(STATUS.FAILED),
    averageRating: agg._avg.starRating ?? null,
    nextScheduledAt: next?.scheduledFor?.toISOString() ?? null,
  };
}

export type CronRunDTO = {
  id: string;
  job: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  reviewsFetched: number;
  reviewsNew: number;
  reviewsProcessed: number;
  repliesPublished: number;
  errorCount: number;
  error: string | null;
};

export async function getCronRuns(businessId: string, limit = 12): Promise<CronRunDTO[]> {
  const rows = await prisma.cronRun.findMany({
    where: { businessId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    job: r.job,
    status: r.status,
    trigger: r.trigger,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    durationMs: r.durationMs,
    reviewsFetched: r.reviewsFetched,
    reviewsNew: r.reviewsNew,
    reviewsProcessed: r.reviewsProcessed,
    repliesPublished: r.repliesPublished,
    errorCount: r.errorCount,
    error: r.error,
  }));
}

export type ActivityLogDTO = {
  id: string;
  level: string;
  event: string;
  message: string;
  createdAt: string;
  reviewId: string | null;
};

export async function getActivityLogs(businessId: string, limit = 30): Promise<ActivityLogDTO[]> {
  const rows = await prisma.activityLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    level: r.level,
    event: r.event,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    reviewId: r.reviewId,
  }));
}

/**
 * The reason the most recent location sync failed, if it did. Used to replace the
 * unhelpful "no locations" setup line with the actual cause.
 */
export async function getLastSyncFailure(businessId: string): Promise<string | null> {
  const row = await prisma.activityLog.findFirst({
    where: {
      businessId,
      event: { in: ['locations.sync_failed', 'ingest.failed', 'ingest.location_failed'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { message: true, createdAt: true },
  });
  if (!row) return null;

  // A newer successful sync means the failure is stale.
  const success = await prisma.activityLog.findFirst({
    where: { businessId, event: 'locations.synced', createdAt: { gt: row.createdAt } },
    select: { id: true },
  });
  if (success) return null;

  return row.message.replace(/^Connected, but locations could not be listed:\s*/i, '');
}

export type LocationDTO = {
  id: string;
  googleName: string;
  accountName: string;
  title: string;
  address: string | null;
  active: boolean;
  reviewCount: number;
};

export async function getLocations(businessId: string): Promise<LocationDTO[]> {
  const rows = await prisma.location.findMany({
    where: { businessId },
    orderBy: { title: 'asc' },
    include: { _count: { select: { reviews: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    googleName: r.googleName,
    accountName: r.accountName,
    title: r.title,
    address: r.address,
    active: r.active,
    reviewCount: r._count.reviews,
  }));
}
