import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TimeAgo } from '@/components/time-ago';
import type { ActivityLogDTO } from '@/lib/queries';

export function ActivityLogCard({ logs }: { logs: ActivityLogDTO[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ol className="space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                <Badge
                  variant={
                    log.level === 'ERROR'
                      ? 'destructive'
                      : log.level === 'WARN'
                        ? 'warning'
                        : 'secondary'
                  }
                  className="font-mono"
                >
                  {log.event}
                </Badge>
                <span className="min-w-0 flex-1 leading-relaxed">{log.message}</span>
                <TimeAgo value={log.createdAt} className="text-muted-foreground" />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
