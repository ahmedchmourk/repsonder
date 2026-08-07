'use client';

import * as React from 'react';

/**
 * Brand splash shown on first paint. It is rendered by the server so the logo is
 * visible immediately, then fades itself out once the page has hydrated — no
 * layout shift, and no blank white flash on a slow connection.
 */
export function Preloader() {
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    // 0.85s hold + 0.5s fade in the stylesheet; unmount just after so the fade
    // always finishes rather than being clipped.
    const timer = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden
      className="animate-fade-out fixed inset-0 z-[200] flex flex-col items-center justify-center gap-7 bg-background"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={364}
        height={63}
        className="h-8 w-auto sm:h-9"
        fetchPriority="high"
      />
      <div className="h-[3px] w-40 overflow-hidden rounded-full bg-muted">
        <div className="animate-sweep h-full w-1/3 rounded-full bg-primary" />
      </div>
    </div>
  );
}
