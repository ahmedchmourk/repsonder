'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Light/dark switcher, matching OctiScraper's behaviour: the choice is stored in
 * localStorage and applied by toggling `.dark` on <html>. The inline script in
 * the layout applies the stored value before first paint, so there is no flash.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('responder-theme', next ? 'dark' : 'light');
    } catch {
      // Private browsing — the choice just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={mounted ? isDark : undefined}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-foreground shadow-sm transition-all hover:bg-muted"
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400" aria-hidden />
      ) : (
        <Moon className="size-4 text-slate-700" aria-hidden />
      )}
    </button>
  );
}

/** Runs before hydration to avoid a light-mode flash on dark-mode loads. */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('responder-theme');
    if (stored === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
