'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Clock, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { ReviewSummary } from './review-summary';
import { TimeAgo } from '@/components/time-ago';
import { formatUtc } from '@/lib/format';
import { postJson } from '@/lib/client';
import type { ReviewDTO } from '@/lib/queries';

/**
 * A 3.0–3.9★ review with its AI draft. The draft is editable inline; approving
 * either publishes immediately (if the 24h delay has already elapsed) or queues
 * the reply for the publisher.
 */
export function ApprovalCard({ review, earliestPublishAt }: { review: ReviewDTO; earliestPublishAt: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const original = review.draft?.content ?? '';
  const [content, setContent] = React.useState(original);
  const [busy, setBusy] = React.useState<'approve' | 'publish' | 'regen' | 'escalate' | null>(null);

  const dirty = content.trim() !== original.trim();
  const delayElapsed = Date.now() >= new Date(earliestPublishAt).getTime();
  const textareaId = `draft-${review.id}`;

  async function approve(publishNow: boolean) {
    if (!content.trim()) {
      toast({ title: 'Nothing to publish', description: 'The reply is empty.', variant: 'error' });
      return;
    }
    setBusy(publishNow ? 'publish' : 'approve');
    try {
      const result = await postJson<{ published: boolean; scheduledFor: string | null }>(
        `/api/reviews/${review.id}/approve`,
        { content, publishNow },
      );
      toast({
        title: result.published ? 'Reply published to Google' : 'Approved and queued',
        description: result.published
          ? `Sent to ${review.reviewerName}'s review.`
          : `Held until ${formatUtc(result.scheduledFor ?? earliestPublishAt)} so it doesn't look automated.`,
        variant: 'success',
      });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not approve',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy('regen');
    try {
      const result = await postJson<{ content: string; version: number }>(
        `/api/reviews/${review.id}/regenerate`,
      );
      setContent(result.content);
      toast({ title: `New draft generated (v${result.version})`, variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not regenerate',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function escalate() {
    setBusy('escalate');
    try {
      await postJson(`/api/reviews/${review.id}/escalate`, {
        reason: 'Operator sent this to human handling from the approvals queue',
      });
      toast({ title: 'Moved to Escalations', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not escalate',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="hover:border-primary/40">
      <CardHeader className="pb-4">
        <ReviewSummary review={review} showStatus={false} />
      </CardHeader>

      <Separator />

      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={textareaId} className="micro-label">
            AI draft reply
          </Label>
          <span className="font-mono text-[11px] text-muted-foreground">
            {review.draft
              ? `${review.draft.provider ?? 'llm'} · ${review.draft.model ?? 'unknown model'} · v${review.draft.version}${review.draft.humanEdited ? ' · edited' : ''}`
              : 'No draft on file'}
          </span>
        </div>

        <Textarea
          id={textareaId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="resize-y"
          placeholder="Write the reply that should be published to Google…"
          aria-describedby={`${textareaId}-help`}
        />

        <p
          id={`${textareaId}-help`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          <span className="tabular-nums">{content.trim().length} characters</span>
          {dirty ? (
            <span className="font-semibold text-amber-600 dark:text-amber-400">Unsaved edits</span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {delayElapsed ? (
              <>24h delay already elapsed — approving publishes immediately</>
            ) : (
              <>
                Earliest publish <TimeAgo value={earliestPublishAt} />
              </>
            )}
          </span>
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => approve(false)} disabled={busy !== null}>
          {busy === 'approve' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          Approve &amp; Publish
        </Button>

        {!delayElapsed ? (
          <Button variant="outline" onClick={() => approve(true)} disabled={busy !== null}>
            {busy === 'publish' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            Publish now (override delay)
          </Button>
        ) : null}

        <Button variant="outline" onClick={regenerate} disabled={busy !== null}>
          {busy === 'regen' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw aria-hidden />
          )}
          Regenerate
        </Button>

        <Button variant="ghost" onClick={escalate} disabled={busy !== null}>
          {busy === 'escalate' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <AlertTriangle aria-hidden />
          )}
          Needs a human
        </Button>

        {dirty ? (
          <Button
            variant="ghost"
            onClick={() => setContent(original)}
            disabled={busy !== null}
            className="ml-auto"
          >
            <X aria-hidden />
            Revert edits
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
