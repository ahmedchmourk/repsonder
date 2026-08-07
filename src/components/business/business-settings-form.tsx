'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { putJson } from '@/lib/client';
import type { BusinessDTO } from '@/lib/business';

/**
 * The only settings that shape reply quality, in plain language. Keys, models and
 * timings live in Advanced.
 */
export function BusinessSettingsForm({ business }: { business: BusinessDTO }) {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = React.useState({
    name: business.name,
    context: business.context,
    brandTone: business.brandTone ?? '',
    signature: business.signature ?? '',
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setForm({
      name: business.name,
      context: business.context,
      brandTone: business.brandTone ?? '',
      signature: business.signature ?? '',
    });
  }, [business]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    if (form.context.trim().length < 40) {
      toast({
        title: 'Tell us a bit more',
        description: 'The description needs at least 40 characters so replies stay accurate.',
        variant: 'error',
      });
      return;
    }
    setBusy(true);
    try {
      await putJson(`/api/businesses/${business.id}`, form);
      toast({ title: 'Saved', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="soft">
      <CardHeader>
        <CardTitle>About your organisation</CardTitle>
        <CardDescription>
          This is what replies are written from. The more you put here, the more accurate and
          personal they sound — and nothing outside it will ever be mentioned.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="bName" className="micro-label">
            Name
          </Label>
          <Input id="bName" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="bContext" className="micro-label">
              What you do
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {form.context.trim().length} characters
            </span>
          </div>
          <Textarea
            id="bContext"
            value={form.context}
            onChange={(e) => set('context', e.target.value)}
            rows={12}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Services, prices, opening hours, policies — anything a customer might ask about. If a
            reviewer asks about something you have not written here, the reply will politely avoid
            it rather than guess.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bTone" className="micro-label">
              How replies should sound
            </Label>
            <Input
              id="bTone"
              value={form.brandTone}
              onChange={(e) => set('brandTone', e.target.value)}
              placeholder="Warm, human and to the point"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bSignature" className="micro-label">
              Sign replies with (optional)
            </Label>
            <Input
              id="bSignature"
              value={form.signature}
              onChange={(e) => set('signature', e.target.value)}
              placeholder="— Ahmed, OctiGrowth"
            />
          </div>
        </div>

        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
