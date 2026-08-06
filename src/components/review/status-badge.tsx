import { Badge } from '@/components/ui/badge';
import { STATUS } from '@/lib/constants';

const LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'outline' }> = {
  [STATUS.NEW]: { label: 'Queued for processing', variant: 'secondary' },
  [STATUS.SCHEDULED]: { label: 'Scheduled', variant: 'info' },
  [STATUS.PENDING_APPROVAL]: { label: 'Needs approval', variant: 'warning' },
  [STATUS.NEEDS_HUMAN_ATTENTION]: { label: 'Action required', variant: 'destructive' },
  [STATUS.PUBLISHED]: { label: 'Published', variant: 'success' },
  [STATUS.DISMISSED]: { label: 'Handled without reply', variant: 'outline' },
  [STATUS.FAILED]: { label: 'Publish failed', variant: 'destructive' },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = LABELS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
