'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, RefreshCw, Undo2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { ReviewSummary } from './review-summary';
import { formatUtc } from '@/lib/format';
import { postJson } from '@/lib/client';
import type { ReviewDTO } from '@/lib/queries';

/**
 * A middling review with a ready-made reply. Editable in place; approving either
 * sends it or queues it until the 24-hour hold has passed.
 */
export function ApprovalCard({
  review,
  earliestPublishAt,
}: {
  review: ReviewDTO;
  earliestPublishAt: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const original = review.draft?.content ?? '';
  const [content, setContent] = React.useState(original);
  const [busy, setBusy] = React.useState<'approve' | 'regen' | 'escalate' | null>(null);

  const dirty = content.trim() !== original.trim();
  const textareaId = `draft-${review.id}`;

  async function approve() {
    if (!content.trim()) {
      toast({ title: 'The reply is empty', variant: 'error' });
      return;
    }
    setBusy('approve');
    try {
      const result = await postJson<{ published: boolean; scheduledFor: string | null }>(
        `/api/reviews/${review.id}/approve`,
        { content },
      );
      toast({
        title: result.published ? 'Reply sent' : 'Approved',
        description: result.published
          ? `${review.reviewerName} will see it on Google shortly.`
          : `It will go out on ${formatUtc(result.scheduledFor ?? earliestPublishAt)} so it doesn't look automated.`,
        variant: 'success',
      });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not send',
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
      const result = await postJson<{ content: string }>(`/api/reviews/${review.id}/regenerate`);
      setContent(result.content);
      toast({ title: 'New version written', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Could not rewrite',
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
        reason: 'Moved for a human reply from the dashboard',
      });
      toast({ title: 'Moved to “Needs a person”', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not move it',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="soft">
      <CardHeader className="pb-4">
        <ReviewSummary review={review} />
      </CardHeader>

      <CardContent className="space-y-2.5 border-t border-border pt-4">
        <Label htmlFor={textareaId} className="micro-label">
          Suggested reply
        </Label>
        <Textarea
          id={textareaId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="resize-y"
        />
        {dirty ? <p className="text-xs font-semibold text-amber-700">Edited</p> : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-1">
        <Button onClick={approve} disabled={busy !== null}>
          {busy === 'approve' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          Approve &amp; send
        </Button>

        <Button variant="secondary" onClick={regenerate} disabled={busy !== null}>
          {busy === 'regen' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw aria-hidden />
          )}
          Write another
        </Button>

        <Button variant="ghost" onClick={escalate} disabled={busy !== null}>
          {busy === 'escalate' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <UserRound aria-hidden />
          )}
          I&apos;ll handle this myself
        </Button>

        {dirty ? (
          <Button
            variant="ghost"
            onClick={() => setContent(original)}
            disabled={busy !== null}
            className="ml-auto"
          >
            <Undo2 aria-hidden />
            Undo edits
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
