'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/client';

type IngestResponse = {
  job: string;
  fetched?: number;
  created?: number;
  processed?: number;
  published?: number;
  due?: number;
  errors?: string[];
};

/** Triggers /api/jobs/ingest or /api/jobs/publish on demand. */
export function RunJobButton({
  job,
  label,
  variant = 'outline',
  size = 'default',
}: {
  job: 'ingest' | 'publish';
  label: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await postJson<IngestResponse>(`/api/jobs/${job}`);
      const summary =
        job === 'ingest'
          ? `${result.fetched ?? 0} fetched · ${result.created ?? 0} new · ${result.processed ?? 0} routed`
          : `${result.due ?? 0} due · ${result.published ?? 0} published`;

      const failed = result.errors?.length ?? 0;
      toast({
        title: failed ? `${job} finished with ${failed} error(s)` : `${job} finished`,
        description: failed ? `${summary}. ${result.errors?.[0]}` : summary,
        variant: failed ? 'error' : 'success',
      });
      router.refresh();
    } catch (err) {
      toast({
        title: `Could not run ${job}`,
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy} variant={variant} size={size}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
      {busy ? 'Running…' : label}
    </Button>
  );
}
