'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CircleSlash, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { ReviewSummary } from './review-summary';
import { postJson } from '@/lib/client';
import type { ReviewDTO } from '@/lib/queries';

/**
 * An unhappy or sensitive review. No draft is offered on purpose — whatever you
 * write is published to Google as-is.
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
      toast({ title: 'Reply sent', variant: 'success' });
      setContent('');
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

  async function dismiss() {
    setBusy('dismiss');
    try {
      await postJson(`/api/reviews/${review.id}/dismiss`, { reason: 'Handled outside Responder' });
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
    <Card className={review.sensitive ? 'soft border-red-200' : 'soft'}>
      <CardHeader className="pb-4">
        <ReviewSummary review={review} />
      </CardHeader>

      <CardContent className="space-y-2.5 border-t border-border pt-4">
        <Label htmlFor={textareaId} className="micro-label">
          Your reply
        </Label>
        <Textarea
          id={textareaId}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Acknowledge what went wrong, keep it calm, and offer to sort it out privately."
        />
        <p className="text-xs text-muted-foreground">
          This goes straight to Google exactly as written.
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-1">
        <Button onClick={send} disabled={busy !== null || !content.trim()}>
          {busy === 'send' ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          Send reply
        </Button>
        <Button variant="ghost" onClick={dismiss} disabled={busy !== null}>
          {busy === 'dismiss' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <CircleSlash aria-hidden />
          )}
          Already handled
        </Button>
      </CardFooter>
    </Card>
  );
}
