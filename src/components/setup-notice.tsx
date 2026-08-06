import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Shown at the top of every view while a prerequisite is missing. */
export function SetupNotice({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-500">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold tracking-tight text-amber-700 dark:text-amber-400">
          Setup incomplete
        </p>
        <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-amber-700/90 dark:text-amber-300/90">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <Button variant="secondary" size="sm" asChild>
        <Link href="/?view=settings">Go to Settings</Link>
      </Button>
    </div>
  );
}
