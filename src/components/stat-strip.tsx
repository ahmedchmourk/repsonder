import { cn } from '@/lib/utils';

export type Stat = { label: string; value: string | number; tone?: 'default' | 'warning' | 'danger' };

const TONES = {
  default: '',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
} as const;

/**
 * One quiet bordered strip instead of a row of cards — the numbers are context,
 * not the main event, so they shouldn't compete with the review list.
 */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            'px-4 py-3',
            i % 2 !== 0 && 'border-l border-border',
            i >= 2 && 'border-t border-border',
            'sm:border-t-0',
            i !== 0 && 'sm:border-l sm:border-border',
          )}
        >
          <dt className="micro-label">{stat.label}</dt>
          <dd
            className={cn(
              'mt-1 font-heading text-xl font-bold tracking-tight tabular-nums',
              TONES[stat.tone ?? 'default'],
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
