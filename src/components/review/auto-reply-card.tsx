import { Clock, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ReviewSummary } from './review-summary';
import { TimeAgo } from '@/components/time-ago';
import { EXTERNAL_REPLY_MARKER, STATUS } from '@/lib/constants';
import type { ReviewDTO } from '@/lib/queries';

/** A happy review Responder handled on its own. Read-only. */
export function AutoReplyCard({ review }: { review: ReviewDTO }) {
  const published = review.status === STATUS.PUBLISHED;
  const wasAlreadyAnswered = review.approvedBy === EXTERNAL_REPLY_MARKER;
  const replyText = review.publishedReply ?? review.draft?.content ?? null;

  return (
    <Card className="soft">
      <CardHeader className="pb-4">
        <ReviewSummary review={review} />
      </CardHeader>

      <CardContent className="space-y-2.5 border-t border-border pt-4">
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {published ? (
            <>
              <Check className="size-3.5 text-emerald-600" aria-hidden />
              <span className="text-emerald-700">
                {wasAlreadyAnswered ? 'Already answered on Google' : 'Sent'}
              </span>
              {review.publishedAt ? (
                <TimeAgo value={review.publishedAt} className="font-normal text-muted-foreground" />
              ) : null}
            </>
          ) : (
            <>
              <Clock className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="text-foreground">Sending</span>
              {review.scheduledFor ? (
                <TimeAgo
                  value={review.scheduledFor}
                  className="font-normal text-muted-foreground"
                />
              ) : null}
            </>
          )}
        </p>

        {replyText ? (
          <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm leading-relaxed">
            {replyText}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
