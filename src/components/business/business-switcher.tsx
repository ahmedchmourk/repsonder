'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Check, ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/client';
import { cn } from '@/lib/utils';
import type { BusinessDTO } from '@/lib/business';

/** Picks which organisation the dashboard is pointed at, and can remove one. */
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
        title: 'Could not switch organisation',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove(business: BusinessDTO) {
    // Typing the name is deliberate friction — this also deletes every review.
    const typed = window.prompt(
      `Delete "${business.name}"?\n\nThis also removes its ${business.reviewCount} review(s) and cannot be undone.\n\nType the name to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim() !== business.name) {
      toast({ title: 'Name did not match — nothing was deleted', variant: 'error' });
      return;
    }

    setBusy(business.id);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      toast({ title: `${business.name} deleted`, variant: 'success' });
      setOpen(false);
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

  if (businesses.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 max-w-[13rem] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition-colors hover:bg-muted"
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{current?.name ?? 'Select organisation'}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          className="soft absolute right-0 z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-popover p-1.5"
        >
          {businesses.map((b) => (
            <div
              key={b.id}
              className={cn(
                'flex items-center gap-1 rounded-lg',
                b.id === currentId ? 'bg-muted' : 'hover:bg-muted',
              )}
            >
              <button
                type="button"
                role="option"
                aria-selected={b.id === currentId}
                onClick={() => select(b.id)}
                disabled={busy !== null}
                className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm disabled:opacity-50"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {busy === b.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : b.id === currentId ? (
                    <Check className="size-3.5 text-primary" aria-hidden />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn('block truncate', b.id === currentId && 'font-semibold')}
                  >
                    {b.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.connected
                      ? `${b.reviewCount} review${b.reviewCount === 1 ? '' : 's'}`
                      : 'not connected'}
                    {b.active ? '' : ' · paused'}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => remove(b)}
                disabled={busy !== null}
                title={`Delete ${b.name}`}
                aria-label={`Delete ${b.name}`}
                className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}

          <Link
            href="/new"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-lg border-t border-border px-2.5 py-2 pt-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden />
            Add an organisation
          </Link>
        </div>
      ) : null}
    </div>
  );
}
