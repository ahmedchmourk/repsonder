import Link from 'next/link';
import { MessageSquareReply } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Deliberately minimal: navigation lives in the dashboard's own view switcher,
 * so the header only carries branding and the theme toggle.
 */
export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-border">
      <div className="shell flex h-14 items-center justify-between gap-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-xl">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
            <MessageSquareReply className="size-4" aria-hidden />
          </span>
          <span className="font-heading text-base font-extrabold tracking-tight">Responder</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
