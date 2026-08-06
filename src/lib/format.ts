/**
 * Deterministic formatters. These produce identical output on the server and in
 * the browser (everything is rendered in UTC), so they are safe to use during
 * SSR without causing hydration mismatches.
 */

/** "2026-08-05 14:32 UTC" */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "1.4s" / "820ms" */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
