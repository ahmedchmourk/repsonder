'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleSlash, Loader2, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { ReviewSummary } from './review-summary';
import { postJson } from '@/lib/client';
import type { ReviewDTO } from '@/lib/queries';

/**
 * A 1.0–2.9★ or sensitive review. No AI draft exists by design — the composer
 * starts empty and whatever the human writes is published immediately.
 */
export function EscalationCard({ review }: { review: ReviewDTO }) {
  const router = useRouter();
  const { toast } = useToast();

  const [content, setContent] = React.useState('');
  const [busy, setBusy] = React.useState<'send' | 'dismiss' | null>(null);
  const textareaId = `reply-${review.id}`;

  async function send() {
    if (!content.trim()) {
      toast({ title: 'Write a reply first', variant: 'error' });
      return;
    }
    setBusy('send');
    try {
      await postJson(`/api/reviews/${review.id}/reply`, { content });
      toast({
        title: 'Reply published to Google',
        description: `Sent to ${review.reviewerName}'s ${review.starRating}★ review.`,
        variant: 'success',
      });
      setContent('');
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not publish',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function dismiss() {
    setBusy('dismiss');
    try {
      await postJson(`/api/reviews/${review.id}/dismiss`, {
        reason: 'Handled offline — no public reply',
      });
      toast({ title: 'Marked as handled', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not update',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={review.sensitive ? 'border-red-500/30' : 'hover:border-primary/40'}>
      <CardHeader className="pb-4">
        <ReviewSummary review={review} showStatus />
      </CardHeader>

      <Separator />

      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            No AI reply was generated for this review —{' '}
            {review.sensitive ? 'it was flagged as sensitive' : 'it is rated below 3.0★'}. Anything
            you write here is published to Google as-is, immediately.
          </span>
        </div>

        {review.lastError ? (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            Last error: {review.lastError}
          </p>
        ) : null}

        <Label htmlFor={textareaId} className="micro-label">
          Your reply
        </Label>
        <Textarea
          id={textareaId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Write a considered, human response. Acknowledge the issue, avoid admitting legal fault, and offer a private channel."
        />
        <p className="text-xs tabular-nums text-muted-foreground">
          {content.trim().length} characters
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-1">
        <Button onClick={send} disabled={busy !== null || !content.trim()}>
          {busy === 'send' ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          Publish reply
        </Button>
        <Button variant="ghost" onClick={dismiss} disabled={busy !== null}>
          {busy === 'dismiss' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <CircleSlash aria-hidden />
          )}
          Handled offline — no reply
        </Button>
      </CardFooter>
    </Card>
  );
}
