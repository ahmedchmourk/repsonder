'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/client';
import { cn } from '@/lib/utils';
import type { BusinessDTO } from '@/lib/business';

/** Picks which business the dashboard is pointed at. */
export function BusinessSwitcher({
  businesses,
  currentId,
}: {
  businesses: BusinessDTO[];
  currentId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const current = businesses.find((b) => b.id === currentId) ?? null;

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function select(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    setBusy(id);
    try {
      await postJson(`/api/businesses/${id}/select`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        title: 'Could not switch business',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  if (businesses.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 max-w-[15rem] items-center gap-2 rounded-xl border border-border bg-secondary px-3 text-sm font-semibold shadow-sm transition-all hover:bg-muted"
      >
        <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{current?.name ?? 'Select business'}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg"
        >
          {businesses.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={b.id === currentId}
              onClick={() => select(b.id)}
              disabled={busy !== null}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-50',
                b.id === currentId ? 'bg-muted font-semibold' : 'hover:bg-muted',
              )}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                {busy === b.id ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : b.id === currentId ? (
                  <Check className="size-3.5 text-primary" aria-hidden />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{b.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {b.connected ? `${b.reviewCount} reviews` : 'not connected'}
                  {b.active ? '' : ' · paused'}
                </span>
              </span>
            </button>
          ))}

          <a
            href="/?view=settings&new=1"
            className="mt-1 flex items-center gap-2 rounded-lg border-t border-border px-2.5 py-2 pt-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden />
            Add a business
          </a>
        </div>
      ) : null}
    </div>
  );
}
