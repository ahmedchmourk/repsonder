'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Surfaces the `?connected=` / `?error=` params the OAuth callback redirects with. */
export function FlashMessage() {
  const params = useSearchParams();
  const error = params.get('error');
  const message = params.get('message');
  const connected = params.get('connected');

  if (!error && !message && !connected) return null;

  const isError = Boolean(error);

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        isError ? 'border-red-500/25 bg-red-500/10' : 'border-emerald-500/25 bg-emerald-500/10',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg border',
          isError
            ? 'border-red-500/20 bg-red-500/10 text-red-500'
            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
        )}
      >
        {isError ? (
          <TriangleAlert className="size-4" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
      </span>
      <p
        className={cn(
          'pt-2 text-sm leading-relaxed',
          isError
            ? 'text-red-700 dark:text-red-400'
            : 'text-emerald-700 dark:text-emerald-400',
        )}
      >
        {error ?? message ?? 'Google account connected.'}
      </p>
    </div>
  );
}
