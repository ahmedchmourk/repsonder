import Image from 'next/image';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { BusinessSwitcher } from '@/components/business/business-switcher';
import type { BusinessDTO } from '@/lib/business';

/**
 * Branding, the organisation picker and sign-out. All other navigation lives in
 * the page, so there is only ever one place to look.
 */
export function SiteHeader({
  businesses = [],
  currentId = null,
  userName = null,
}: {
  businesses?: BusinessDTO[];
  currentId?: string | null;
  userName?: string | null;
}) {
  return (
    <header className="glass sticky top-0 z-50 border-b border-border">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Responder — home" className="shrink-0 rounded-lg">
          <Image
            src="/logo.png"
            alt="Responder by Octicode"
            width={364}
            height={63}
            priority
            className="h-6 w-auto sm:h-7"
          />
        </Link>

        <div className="flex items-center gap-2">
          {businesses.length > 0 ? (
            <BusinessSwitcher businesses={businesses} currentId={currentId} />
          ) : null}

          {userName ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
          ) : null}

          {/* A plain form post, so sign-out works without JavaScript. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
