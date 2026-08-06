'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlugZap, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { postJson, putJson } from '@/lib/client';
import type { BusinessDTO } from '@/lib/business';

/** Edit the selected business: context, keys, voice, timing. */
export function BusinessSettingsForm({
  business,
  canDelete,
}: {
  business: BusinessDTO;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = React.useState({
    name: business.name,
    context: business.context,
    brandTone: business.brandTone ?? '',
    signature: business.signature ?? '',
    googleClientId: business.googleClientId,
    llmProvider: business.llmProvider === 'openai' ? 'openai' : ('gemini' as 'openai' | 'gemini'),
    llmModel: business.llmModel,
    minReplyDelayHours: String(business.minReplyDelayHours),
    autoPublishEnabled: business.autoPublishEnabled,
    active: business.active,
  });

  // Secret inputs start empty: blank means "keep the stored value".
  const [clientSecret, setClientSecret] = React.useState('');
  const [llmApiKey, setLlmApiKey] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'test' | 'delete' | null>(null);

  // Re-sync when the user switches business.
  React.useEffect(() => {
    setForm({
      name: business.name,
      context: business.context,
      brandTone: business.brandTone ?? '',
      signature: business.signature ?? '',
      googleClientId: business.googleClientId,
      llmProvider: business.llmProvider === 'openai' ? 'openai' : 'gemini',
      llmModel: business.llmModel,
      minReplyDelayHours: String(business.minReplyDelayHours),
      autoPublishEnabled: business.autoPublishEnabled,
      active: business.active,
    });
    setClientSecret('');
    setLlmApiKey('');
  }, [business]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    const hours = Number(form.minReplyDelayHours);
    if (!Number.isFinite(hours) || hours < 24) {
      toast({
        title: 'Invalid delay',
        description: 'The minimum reply delay must be at least 24 hours.',
        variant: 'error',
      });
      return;
    }
    if (form.context.trim().length < 40) {
      toast({
        title: 'Context too short',
        description: 'The business context needs at least 40 characters.',
        variant: 'error',
      });
      return;
    }

    setBusy('save');
    try {
      await putJson(`/api/businesses/${business.id}`, {
        name: form.name,
        context: form.context,
        brandTone: form.brandTone,
        signature: form.signature,
        googleClientId: form.googleClientId,
        llmProvider: form.llmProvider,
        llmModel: form.llmModel,
        minReplyDelayHours: hours,
        autoPublishEnabled: form.autoPublishEnabled,
        active: form.active,
        ...(clientSecret.trim() ? { googleClientSecret: clientSecret.trim() } : {}),
        ...(llmApiKey.trim() ? { llmApiKey: llmApiKey.trim() } : {}),
      });
      setClientSecret('');
      setLlmApiKey('');
      toast({ title: 'Saved', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    try {
      const result = await postJson<{ provider: string; model: string }>(
        `/api/businesses/${business.id}/test-llm`,
      );
      toast({
        title: 'LLM reachable',
        description: `${result.provider} · ${result.model}`,
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'LLM test failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const typed = window.prompt(
      `Delete "${business.name}" and all ${business.reviewCount} of its reviews? This cannot be undone.\n\nType the business name to confirm:`,
    );
    if (typed !== business.name) {
      if (typed !== null) {
        toast({ title: 'Name did not match — nothing deleted', variant: 'error' });
      }
      return;
    }

    setBusy('delete');
    try {
      const res = await fetch(`/api/businesses/${business.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      toast({ title: `${business.name} deleted`, variant: 'success' });
      router.push('/');
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not delete',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  const isGemini = form.llmProvider === 'gemini';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business &amp; reply generation</CardTitle>
        <CardDescription>
          The context below is the only source of facts the AI may use. Secrets are encrypted and
          never sent back to the browser.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bName" className="micro-label">
              Business name
            </Label>
            <Input id="bName" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
            <Label htmlFor="bActive" className="text-sm font-semibold">
              Active
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Paused businesses are skipped by cron
              </span>
            </Label>
            <Switch
              id="bActive"
              checked={form.active}
              onCheckedChange={(v) => set('active', v)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="bContext" className="micro-label">
              Business context
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {form.context.trim().length} chars
            </span>
          </div>
          <Textarea
            id="bContext"
            value={form.context}
            onChange={(e) => set('context', e.target.value)}
            rows={12}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Services, prices, hours, policies. The AI will not mention anything absent from here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bProvider" className="micro-label">
              LLM provider
            </Label>
            <Select
              value={form.llmProvider}
              onValueChange={(v) => set('llmProvider', v as 'openai' | 'gemini')}
            >
              <SelectTrigger id="bProvider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bModel" className="micro-label">
              Model
            </Label>
            <Input
              id="bModel"
              value={form.llmModel}
              onChange={(e) => set('llmModel', e.target.value)}
              placeholder={isGemini ? 'gemini-flash-latest' : 'gpt-4o-mini'}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="bLlmKey" className="micro-label">
              LLM API key
            </Label>
            <Badge variant="success">configured</Badge>
          </div>
          <Input
            id="bLlmKey"
            type="password"
            autoComplete="off"
            value={llmApiKey}
            onChange={(e) => setLlmApiKey(e.target.value)}
            placeholder={business.llmApiKeyMasked || '••••••••'}
          />
          <p className="text-xs text-muted-foreground">Leave blank to keep the stored key.</p>
        </div>

        <details className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Google OAuth client
          </summary>
          <div className="mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bClientId" className="micro-label">
                Client ID
              </Label>
              <Input
                id="bClientId"
                value={form.googleClientId}
                onChange={(e) => set('googleClientId', e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bClientSecret" className="micro-label">
                Client secret
              </Label>
              <Input
                id="bClientSecret"
                type="password"
                autoComplete="off"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={business.googleClientSecretMasked || '••••••••'}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the stored secret. Changing it requires reconnecting Google.
              </p>
            </div>
          </div>
        </details>

        <details className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
            Tone, signature &amp; timing
          </summary>
          <div className="mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bTone" className="micro-label">
                Tone guidance
              </Label>
              <Textarea
                id="bTone"
                rows={3}
                value={form.brandTone}
                onChange={(e) => set('brandTone', e.target.value)}
                placeholder="Warm, human and concise. Never sound like a template."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bSignature" className="micro-label">
                  Signature
                </Label>
                <Input
                  id="bSignature"
                  value={form.signature}
                  onChange={(e) => set('signature', e.target.value)}
                  placeholder="— Maria, Owner"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bDelay" className="micro-label">
                  Minimum delay (hours)
                </Label>
                <Input
                  id="bDelay"
                  type="number"
                  min={24}
                  step={1}
                  value={form.minReplyDelayHours}
                  onChange={(e) => set('minReplyDelayHours', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Cannot go below 24.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
              <Label htmlFor="bAutoPublish" className="text-sm font-semibold">
                Auto-publish due replies
              </Label>
              <Switch
                id="bAutoPublish"
                checked={form.autoPublishEnabled}
                onCheckedChange={(v) => set('autoPublishEnabled', v)}
              />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy !== null} size="sm">
            {busy === 'save' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Save aria-hidden />
            )}
            Save
          </Button>
          <Button variant="secondary" onClick={test} disabled={busy !== null} size="sm">
            {busy === 'test' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <PlugZap aria-hidden />
            )}
            Test connection
          </Button>
          {canDelete ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline disabled:opacity-50"
            >
              {busy === 'delete' ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-3" aria-hidden />
              )}
              Delete business
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
