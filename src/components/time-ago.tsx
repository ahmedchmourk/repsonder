'use client';

import * as React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { formatUtc } from '@/lib/format';

/**
 * Renders a deterministic UTC timestamp on the server, then upgrades to a
 * relative ("3 hours ago") label once mounted. Doing the swap after mount keeps
 * server and client markup identical, so there is no hydration mismatch.
 */
export function TimeAgo({
  value,
  prefix,
  className,
}: {
  value: string;
  prefix?: string;
  className?: string;
}) {
  const [relative, setRelative] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => {
      const date = new Date(value);
      const past = date.getTime() <= Date.now();
      const distance = formatDistanceToNowStrict(date);
      setRelative(past ? `${distance} ago` : `in ${distance}`);
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <time dateTime={value} className={className} title={new Date(value).toISOString()}>
      {prefix ? `${prefix} ` : ''}
      {relative ?? formatUtc(value)}
    </time>
  );
}

export function AbsoluteTime({ value, className }: { value: string; className?: string }) {
  return (
    <time dateTime={value} className={className}>
      {formatUtc(value)}
    </time>
  );
}
