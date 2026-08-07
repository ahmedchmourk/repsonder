import { cn } from '@/lib/utils';

export type Stat = {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning' | 'danger';
};

const TONES = {
  default: '',
  warning: 'text-amber-700',
  danger: 'text-red-700',
} as const;

/** A calm summary row — context, not the main event. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="soft grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            'px-4 py-3.5',
            i % 2 !== 0 && 'border-l border-border',
            i >= 2 && 'border-t border-border',
            'sm:border-t-0',
            i !== 0 && 'sm:border-l sm:border-border',
          )}
        >
          <dt className="micro-label">{stat.label}</dt>
          <dd
            className={cn(
              // Body font on purpose: Syne's zero reads as a letter O, which is
              // the wrong trade-off for a panel that is mostly numbers.
              'mt-1 text-2xl font-bold tracking-tight tabular-nums',
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
