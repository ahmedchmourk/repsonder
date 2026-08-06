'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const CONTEXT_PLACEHOLDER = `What does the business do? Include anything a reply might need to be accurate, for example:

• Services offered and what each one involves
• Prices or price ranges
• Opening hours and locations
• Booking, refund and cancellation policy
• Contact channels you're happy to point people to
• Anything the AI must never promise

The AI may only use facts written here — it will not invent services or prices.`;

const MIN_CONTEXT = 40;

/** Onboarding / "add another business" form. Collects the three keys + context. */
export function CreateBusinessForm({ compact = false }: { compact?: boolean }) {
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
        title: `${result.name} created`,
        description: 'Next: connect its Google account to start pulling reviews.',
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
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div>
            <CardTitle>{compact ? 'Add another business' : 'Create your first business'}</CardTitle>
            <CardDescription>
              Each business has its own Google OAuth client, its own LLM key, and its own context.
              Reviews, drafts and logs are kept completely separate.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="micro-label">
              Business name
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
                Business context
              </Label>
              <span
                className={
                  contextTooShort
                    ? 'text-xs font-semibold text-amber-600 dark:text-amber-400'
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
              This is injected into every reply prompt as the{' '}
              <strong className="font-semibold text-foreground">only</strong> source of facts the AI
              may use. The more precise it is, the safer the replies.
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
