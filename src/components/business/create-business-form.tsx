'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/client';

const CONTEXT_PLACEHOLDER = `Tell us about the business, the way you'd explain it to a new employee:

• What you offer, and what each service involves
• Prices, or price ranges
• Opening hours and where you are
• Booking, refund and cancellation policy
• How customers can reach you
• Anything you never want promised

Replies are written only from what you put here — nothing gets invented.`;

const MIN_CONTEXT = 40;

/**
 * Collects everything a new organisation needs. Rendered only on /new, which
 * owns the page heading — hence no title of its own here.
 */
export function CreateBusinessForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = React.useState({
    name: '',
    context: '',
    googleClientId: '',
    googleClientSecret: '',
    llmProvider: 'gemini' as 'gemini' | 'openai',
    llmApiKey: '',
    llmModel: '',
  });
  const [busy, setBusy] = React.useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const contextLength = form.context.trim().length;
  const contextTooShort = contextLength > 0 && contextLength < MIN_CONTEXT;

  const canSubmit =
    form.name.trim() &&
    contextLength >= MIN_CONTEXT &&
    form.googleClientId.trim() &&
    form.googleClientSecret.trim() &&
    form.llmApiKey.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    try {
      const result = await postJson<{ id: string; name: string }>('/api/businesses', {
        name: form.name,
        context: form.context,
        googleClientId: form.googleClientId,
        googleClientSecret: form.googleClientSecret,
        llmProvider: form.llmProvider,
        llmApiKey: form.llmApiKey,
        ...(form.llmModel.trim() ? { llmModel: form.llmModel.trim() } : {}),
      });
      toast({
        title: `${result.name} added`,
        description: 'Next: connect its Google account and reviews start arriving.',
        variant: 'success',
      });
      setForm({
        name: '',
        context: '',
        googleClientId: '',
        googleClientSecret: '',
        llmProvider: 'gemini',
        llmApiKey: '',
        llmModel: '',
      });
      // Land on the new organisation's dashboard — it is already selected.
      router.push('/?view=settings');
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not create the business',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="soft">
      <CardContent className="pt-5">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="micro-label">
              Organisation name
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="OctiGrowth"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="context" className="micro-label">
                What the organisation does
              </Label>
              <span
                className={
                  contextTooShort
                    ? 'text-xs font-semibold text-amber-600'
                    : 'text-xs tabular-nums text-muted-foreground'
                }
              >
                {contextLength} / {MIN_CONTEXT} min
              </span>
            </div>
            <Textarea
              id="context"
              value={form.context}
              onChange={(e) => set('context', e.target.value)}
              rows={12}
              placeholder={CONTEXT_PLACEHOLDER}
              className="font-normal"
              required
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              This is the{' '}
              <strong className="font-semibold text-foreground">only</strong> thing replies are
              written from. The more detail you give, the better they sound.
            </p>
          </div>

          <fieldset className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
            <legend className="micro-label px-1">Google OAuth client</legend>
            <div className="space-y-1.5">
              <Label htmlFor="googleClientId" className="micro-label">
                Client ID
              </Label>
              <Input
                id="googleClientId"
                value={form.googleClientId}
                onChange={(e) => set('googleClientId', e.target.value)}
                placeholder="…apps.googleusercontent.com"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="googleClientSecret" className="micro-label">
                Client secret
              </Label>
              <Input
                id="googleClientSecret"
                type="password"
                value={form.googleClientSecret}
                onChange={(e) => set('googleClientSecret', e.target.value)}
                placeholder="GOCSPX-…"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">Encrypted before it is stored.</p>
            </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
            <legend className="micro-label px-1">LLM</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="llmProvider" className="micro-label">
                  Provider
                </Label>
                <Select
                  value={form.llmProvider}
                  onValueChange={(v) => set('llmProvider', v as 'gemini' | 'openai')}
                >
                  <SelectTrigger id="llmProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="llmModel" className="micro-label">
                  Model (optional)
                </Label>
                <Input
                  id="llmModel"
                  value={form.llmModel}
                  onChange={(e) => set('llmModel', e.target.value)}
                  placeholder={
                    form.llmProvider === 'gemini' ? 'gemini-flash-latest' : 'gpt-4o-mini'
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="llmApiKey" className="micro-label">
                API key
              </Label>
              <Input
                id="llmApiKey"
                type="password"
                value={form.llmApiKey}
                onChange={(e) => set('llmApiKey', e.target.value)}
                placeholder={form.llmProvider === 'gemini' ? 'AIza… or AQ.…' : 'sk-…'}
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">Encrypted before it is stored.</p>
            </div>
          </fieldset>

          <Button type="submit" disabled={!canSubmit || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Create business
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
