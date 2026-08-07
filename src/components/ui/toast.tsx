'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Minimal toast system: a provider that owns the queue plus a `useToast()` hook.
 * Radix handles the a11y semantics (role=status, swipe/escape dismissal).
 */

type ToastVariant = 'default' | 'success' | 'error';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const ICON_WRAP = 'flex size-8 shrink-0 items-center justify-center rounded-lg border';

const ICONS: Record<ToastVariant, React.ReactNode> = {
  default: (
    <span className={cn(ICON_WRAP, 'border-indigo-500/20 bg-indigo-500/10 text-indigo-500')}>
      <Info className="size-4" />
    </span>
  ),
  success: (
    <span className={cn(ICON_WRAP, 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500')}>
      <CheckCircle2 className="size-4" />
    </span>
  ),
  error: (
    <span className={cn(ICON_WRAP, 'border-red-500/20 bg-red-500/10 text-red-500')}>
      <TriangleAlert className="size-4" />
    </span>
  ),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'default' }) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, title, description, variant }]);
    },
    [],
  );

  const dismiss = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitives.Provider swipeDirection="right" duration={6000}>
        {children}
        {items.map((item) => (
          <ToastPrimitives.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              'glass-card pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border p-4 shadow-xl',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-4',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-80',
            )}
          >
            {ICONS[item.variant]}
            <div className="min-w-0 flex-1 pt-0.5">
              <ToastPrimitives.Title className="font-heading text-sm font-bold tracking-tight">
                {item.title}
              </ToastPrimitives.Title>
              {item.description ? (
                <ToastPrimitives.Description className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </ToastPrimitives.Description>
              ) : null}
            </div>
            <ToastPrimitives.Close
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </ToastPrimitives.Close>
          </ToastPrimitives.Root>
        ))}
        <ToastPrimitives.Viewport className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm" />
      </ToastPrimitives.Provider>
    </ToastContext.Provider>
  );
}
