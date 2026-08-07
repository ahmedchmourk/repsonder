/**
 * The panels of the single-page dashboard.
 *
 * Labels are deliberately plain: someone who has never seen the app should be
 * able to tell what each tab holds without being told.
 */
export const VIEWS = [
  { key: 'auto', label: 'Replied for you' },
  { key: 'approvals', label: 'Waiting for you' },
  { key: 'escalations', label: 'Needs a person' },
  { key: 'settings', label: 'Setup' },
] as const;

export type DashboardView = (typeof VIEWS)[number]['key'];

const KEYS = new Set(VIEWS.map((v) => v.key as string));

export function parseView(raw: string | string[] | undefined): DashboardView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && KEYS.has(value) ? (value as DashboardView) : 'auto';
}
