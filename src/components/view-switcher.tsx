import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { DashboardView } from '@/lib/views';
import { VIEWS } from '@/lib/views';

/**
 * The single navigation control for the whole app. Each button is a link to
 * `/?view=…`, so views stay deep-linkable (the OAuth callback returns straight
 * to the settings view) without any client-side state.
 */
export function ViewSwitcher({
  active,
  counts,
}: {
  active: DashboardView;
  counts: Record<string, number>;
}) {
  return (
    <nav
      aria-label="Views"
      className="scrollbar-hide flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5"
    >
      {VIEWS.map((view) => {
        const isActive = view.key === active;
        const count = counts[view.key];
        return (
          <Link
            key={view.key}
            href={view.key === 'auto' ? '/' : `/?view=${view.key}`}
            scroll={false}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {view.label}
            {count ? (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums',
                  isActive ? 'bg-primary-foreground/20' : 'bg-foreground/10',
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
