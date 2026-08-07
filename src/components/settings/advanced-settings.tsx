'use client';

import * as React from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Everything a non-technical user should never have to see: API keys, models,
 * redirect URIs, cron expressions, raw logs. Collapsed by default and clearly
 * labelled, so the main screens stay readable.
 */
export function AdvancedSettings({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="soft overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Wrench className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-base font-bold tracking-tight">
            Advanced settings
          </span>
          <span className="block text-sm text-muted-foreground">
            API keys, models and technical details. You rarely need these.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border bg-muted/30 p-5">{children}</div>
      ) : null}
    </div>
  );
}
