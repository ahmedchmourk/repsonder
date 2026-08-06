import { Clock, MailCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ReviewSummary } from './review-summary';
import { TimeAgo } from '@/components/time-ago';
import { EXTERNAL_REPLY_MARKER, STATUS } from '@/lib/constants';
import type { ReviewDTO } from '@/lib/queries';

/** Read-only view of a 4.0–5.0★ review that Responder handles automatically. */
export function AutoReplyCard({ review }: { review: ReviewDTO }) {
  const published = review.status === STATUS.PUBLISHED;
  const wasAlreadyAnswered = review.approvedBy === EXTERNAL_REPLY_MARKER;
  const replyText = review.publishedReply ?? review.draft?.content ?? null;

  return (
    <Card className="hover:border-primary/40">
      <CardHeader className="pb-4">
        <ReviewSummary review={review} />
      </CardHeader>

      <Separator />

      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {published ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <MailCheck className="size-3.5" aria-hidden />
              {wasAlreadyAnswered ? 'Reply already existed on Google' : 'Published'}
              {review.publishedAt ? (
                <>
                  {' · '}
                  <TimeAgo value={review.publishedAt} />
                </>
              ) : null}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
              <Clock className="size-3.5" aria-hidden />
              {review.scheduledFor ? (
                <>
                  Publishing <TimeAgo value={review.scheduledFor} />
                </>
              ) : (
                'Awaiting schedule'
              )}
            </span>
          )}
          {review.draft?.provider ? (
            <span className="font-mono text-[11px]">
              · {review.draft.provider}/{review.draft.model}
            </span>
          ) : null}
          {review.approvedBy && !wasAlreadyAnswered ? (
            <span>· approved by {review.approvedBy}</span>
          ) : null}
        </div>

        {replyText ? (
          <div className="rounded-lg border border-border bg-muted/60 px-3.5 py-3 text-sm leading-relaxed">
            {replyText}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">No reply text on file.</p>
        )}

        {review.lastError ? (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Last attempt failed ({review.publishAttempts}×): {review.lastError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
