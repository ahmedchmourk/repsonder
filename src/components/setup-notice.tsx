import Link from 'next/link';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** A calm nudge when something still needs doing. Never alarming. */
export function SetupNotice({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        {items.map((item) => (
          <p key={item} className="text-sm leading-relaxed text-amber-900">
            {item}
          </p>
        ))}
      </div>
      <Button variant="secondary" size="sm" asChild>
        <Link href="/?view=settings">Open Setup</Link>
      </Button>
    </div>
  );
}
