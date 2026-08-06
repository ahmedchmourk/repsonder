import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({ rating, className }: { rating: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5',
        className,
      )}
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              'size-3',
              i <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-amber-400/30',
            )}
          />
        ))}
      </span>
      <span className="text-[11px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}
