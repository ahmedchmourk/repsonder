import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({ rating, className }: { rating: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1', className)}
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              'size-3.5',
              i <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200',
            )}
          />
        ))}
      </span>
    </span>
  );
}
