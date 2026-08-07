import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardView } from '@/lib/views';
import { VIEWS } from '@/lib/views';

/**
 * The only navigation in the app. The three review states sit together on the
 * left; Setup is pushed to the right so it reads as a separate, occasional task
 * rather than a fourth kind of review.
 */
export function ViewSwitcher({
  active,
  counts,
}: {
  active: DashboardView;
  counts: Record<string, number>;
}) {
  const tabs = VIEWS.filter((v) => v.key !== 'settings');
  const settings = VIEWS.find((v) => v.key === 'settings')!;

  return (
    <nav
      aria-label="Views"
      className="soft flex items-center gap-1 rounded-xl border border-border bg-card p-1.5"
    >
      <div className="scrollbar-hide flex flex-1 gap-1 overflow-x-auto">
        {tabs.map((view) => {
          const isActive = view.key === active;
          const count = counts[view.key];
          return (
            <Link
              key={view.key}
              href={view.key === 'auto' ? '/' : `/?view=${view.key}`}
              scroll={false}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
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
      </div>

      <Link
        href={`/?view=${settings.key}`}
        scroll={false}
        aria-current={active === settings.key ? 'page' : undefined}
        className={cn(
          'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
          active === settings.key
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Settings2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">{settings.label}</span>
      </Link>
    </nav>
  );
}
