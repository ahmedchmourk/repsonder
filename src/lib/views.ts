/** The four panels of the single-page dashboard. */
export const VIEWS = [
  { key: 'auto', label: 'Auto-Replied' },
  { key: 'approvals', label: 'Needs Approval' },
  { key: 'escalations', label: 'Action Required' },
  { key: 'settings', label: 'Settings' },
] as const;

export type DashboardView = (typeof VIEWS)[number]['key'];

const KEYS = new Set(VIEWS.map((v) => v.key as string));

export function parseView(raw: string | string[] | undefined): DashboardView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && KEYS.has(value) ? (value as DashboardView) : 'auto';
}
