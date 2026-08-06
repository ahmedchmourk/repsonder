'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const looksLikeMissingDb =
    /does not exist|no such table|Unable to open the database|P1003|P2021/i.test(error.message);

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <h1 className="font-heading text-xl font-bold tracking-tight text-red-700 dark:text-red-400">
          Something went wrong
        </h1>
      </div>

      <p className="break-words text-sm leading-relaxed text-red-700/90 dark:text-red-300/90">
        {error.message}
      </p>

      {looksLikeMissingDb ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-heading font-bold tracking-tight">
            The database has not been created yet.
          </p>
          <p className="mt-1 text-muted-foreground">Run this in the project root, then reload:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/60 p-2.5 font-mono text-xs">
            npm run db:push
          </pre>
        </div>
      ) : null}

      <Button onClick={reset} variant="secondary">
        Try again
      </Button>
    </div>
  );
}
