import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './star-rating';
import { TimeAgo } from '@/components/time-ago';
import type { ReviewDTO } from '@/lib/queries';

/** Who wrote the review, what they said, and anything we flagged about it. */
export function ReviewSummary({ review }: { review: ReviewDTO }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-heading text-base font-bold leading-none tracking-tight">
          {review.reviewerName}
        </p>
        <StarRating rating={review.starRating} />
        <TimeAgo value={review.reviewCreateTime} className="text-xs text-muted-foreground" />
      </div>

      {review.comment ? (
        <blockquote className="border-l-2 border-border pl-3.5 text-sm leading-relaxed text-foreground/90">
          {review.comment}
        </blockquote>
      ) : (
        <p className="text-sm italic text-muted-foreground">They left a rating with no comment.</p>
      )}

      {review.sensitive ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700">
            <ShieldAlert className="size-3.5" aria-hidden />
            Handle with care
          </span>
          {review.sensitiveReasons.map((reason) => (
            <Badge key={reason} variant="destructive">
              {reason}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
