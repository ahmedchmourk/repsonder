import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Inbox className="size-6" aria-hidden />
      </span>
      <div>
        <p className="font-heading text-lg font-bold tracking-tight">{title}</p>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
