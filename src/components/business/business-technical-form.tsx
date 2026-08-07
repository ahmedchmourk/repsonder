'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlugZap, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/** Keys, models, timing and deletion — shown only inside Advanced settings. */
export function BusinessTechnicalForm({
  business,
  canDelete,
}: {
  business: BusinessDTO;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = React.useState({
    llmProvider: business.llmProvider === 'openai' ? 'openai' : ('gemini' as 'openai' | 'gemini'),
    llmModel: business.llmModel,
    googleClientId: business.googleClientId,
    minReplyDelayHours: String(business.minReplyDelayHours),
    autoPublishEnabled: business.autoPublishEnabled,
    active: business.active,
  });
  const [llmApiKey, setLlmApiKey] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'test' | 'delete' | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    const hours = Number(form.minReplyDelayHours);
    if (!Number.isFinite(hours) || hours < 24) {
      toast({
        title: 'Invalid delay',
        description: 'Replies must wait at least 24 hours.',
        variant: 'error',
      });
      return;
    }
    setBusy('save');
    try {
      await putJson(`/api/businesses/${business.id}`, {
        ...form,
        minReplyDelayHours: hours,
        ...(llmApiKey.trim() ? { llmApiKey: llmApiKey.trim() } : {}),
        ...(clientSecret.trim() ? { googleClientSecret: clientSecret.trim() } : {}),
      });
      setLlmApiKey('');
      setClientSecret('');
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
      const r = await postJson<{ provider: string; model: string }>(
        `/api/businesses/${business.id}/test-llm`,
      );
      toast({ title: 'AI reachable', description: `${r.provider} · ${r.model}`, variant: 'success' });
    } catch (err) {
      toast({
        title: 'AI test failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const typed = window.prompt(
      `Delete "${business.name}" and all ${business.reviewCount} of its reviews? This cannot be undone.\n\nType the name to confirm:`,
    );
    if (typed !== business.name) {
      if (typed !== null) toast({ title: 'Name did not match — nothing deleted', variant: 'error' });
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
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="AI provider" htmlFor="tProvider">
          <Select
            value={form.llmProvider}
            onValueChange={(v) => set('llmProvider', v as 'openai' | 'gemini')}
          >
            <SelectTrigger id="tProvider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Model" htmlFor="tModel">
          <Input
            id="tModel"
            value={form.llmModel}
            onChange={(e) => set('llmModel', e.target.value)}
            placeholder={isGemini ? 'gemini-flash-latest' : 'gpt-4o-mini'}
          />
        </Field>
      </div>

      <Field label="AI API key" htmlFor="tKey" hint="Leave blank to keep the stored key.">
        <div className="flex items-center gap-2">
          <Input
            id="tKey"
            type="password"
            autoComplete="off"
            value={llmApiKey}
            onChange={(e) => setLlmApiKey(e.target.value)}
            placeholder={business.llmApiKeyMasked || '••••••••'}
          />
          <Badge variant="success">set</Badge>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Google client ID" htmlFor="tClientId">
          <Input
            id="tClientId"
            value={form.googleClientId}
            onChange={(e) => set('googleClientId', e.target.value)}
            autoComplete="off"
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Google client secret" htmlFor="tSecret" hint="Leave blank to keep it.">
          <Input
            id="tSecret"
            type="password"
            autoComplete="off"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={business.googleClientSecretMasked || '••••••••'}
          />
        </Field>
      </div>

      <Field
        label="Wait before replying (hours)"
        htmlFor="tDelay"
        hint="Minimum 24, so replies never look automated."
      >
        <Input
          id="tDelay"
          type="number"
          min={24}
          step={1}
          value={form.minReplyDelayHours}
          onChange={(e) => set('minReplyDelayHours', e.target.value)}
        />
      </Field>

      <Toggle
        id="tAutoPublish"
        label="Send approved replies automatically"
        checked={form.autoPublishEnabled}
        onChange={(v) => set('autoPublishEnabled', v)}
      />
      <Toggle
        id="tActive"
        label="Keep checking this organisation"
        hint="Turn off to pause all automatic activity."
        checked={form.active}
        onChange={(v) => set('active', v)}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={busy !== null}>
          {busy === 'save' ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Save
        </Button>
        <Button variant="secondary" size="sm" onClick={test} disabled={busy !== null}>
          {busy === 'test' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <PlugZap aria-hidden />
          )}
          Test AI
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
            Delete organisation
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="micro-label">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
