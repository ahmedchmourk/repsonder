import { MapPin, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './star-rating';
import { StatusBadge } from './status-badge';
import { TimeAgo } from '@/components/time-ago';
import type { ReviewDTO } from '@/lib/queries';

/** The review itself: who wrote it, what they said, and how we classified it. */
export function ReviewSummary({
  review,
  showStatus = true,
}: {
  review: ReviewDTO;
  showStatus?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-heading text-base font-bold leading-none tracking-tight">
              {review.reviewerName}
            </p>
            <StarRating rating={review.starRating} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 shrink-0 text-primary" aria-hidden />
              <span className="line-clamp-1">{review.locationTitle}</span>
            </span>
            <TimeAgo value={review.reviewCreateTime} prefix="reviewed" />
          </div>
        </div>
        {showStatus ? <StatusBadge status={review.status} /> : null}
      </div>

      {review.comment ? (
        <blockquote className="rounded-lg border-l-2 border-primary/40 bg-muted/60 px-3 py-2.5 text-sm leading-relaxed">
          {review.comment}
        </blockquote>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          Star rating only — the reviewer left no written comment.
        </p>
      )}

      {review.sensitive ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            <ShieldAlert className="size-3.5" aria-hidden />
            Flagged sensitive
          </span>
          {review.sensitiveReasons.map((reason) => (
            <Badge key={reason} variant="destructive">
              {reason}
            </Badge>
          ))}
        </div>
      ) : null}

      {review.analysisSummary ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Summary:</span> {review.analysisSummary}
        </p>
      ) : null}
    </div>
  );
}
