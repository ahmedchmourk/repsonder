'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { putJson } from '@/lib/client';
import { cn } from '@/lib/utils';

/** The OAuth redirect URI, which must match the one registered in Google Cloud. */
export function RedirectUriField({
  businessId,
  redirectUri,
  supported,
}: {
  businessId: string;
  redirectUri: string;
  supported: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [uri, setUri] = React.useState(redirectUri);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setUri(redirectUri), [redirectUri]);
  const changed = uri.trim() !== redirectUri;

  async function save() {
    setBusy(true);
    try {
      await putJson(`/api/businesses/${businessId}`, { googleRedirectUri: uri.trim() });
      toast({ title: 'Redirect URI saved', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not save the redirect URI',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <Label htmlFor="redirectUri" className="micro-label">
        Authorized redirect URI
      </Label>
      <Input
        id="redirectUri"
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="font-mono text-xs"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Must match the OAuth client in Google Cloud exactly. Either of these works:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {supported.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setUri(option)}
            className={cn(
              'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
              uri.trim() === option
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {option.replace(/^https?:\/\/[^/]+/, '')}
          </button>
        ))}
      </div>
      {changed ? (
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Save
        </Button>
      ) : null}
    </div>
  );
}
