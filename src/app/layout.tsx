import type { Metadata } from 'next';
import { Montserrat, Syne } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { Preloader } from '@/components/preloader';
import { ToastProvider } from '@/components/ui/toast';
import { ensureSchedulerStarted } from '@/lib/bootstrap';
import { currentUser } from '@/lib/auth';
import { listBusinesses, getCurrentBusiness } from '@/lib/business';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const syne = Syne({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Responder by Octicode',
  description:
    'Replies to your Google reviews automatically, and tells you the moment one needs a person.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Idempotent: starts the background jobs on the first render only.
  ensureSchedulerStarted();

  const user = await currentUser();

  // Signed out (i.e. the login screen) gets a bare shell — no header, no chrome.
  let businesses: Awaited<ReturnType<typeof listBusinesses>> = [];
  let currentId: string | null = null;
  if (user) {
    try {
      businesses = await listBusinesses();
      currentId = (await getCurrentBusiness())?.id ?? null;
    } catch {
      // Database not migrated yet — the shell still renders.
    }
  }

  return (
    <html lang="en" className={`${montserrat.variable} ${syne.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <ToastProvider>
          <Preloader />
          {user ? (
            <>
              <a
                href="#main"
                className="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Skip to content
              </a>
              <SiteHeader
                businesses={businesses}
                currentId={currentId}
                userName={user.name ?? user.email}
              />
              <main id="main" className="shell py-8 sm:py-10">
                {children}
              </main>
            </>
          ) : (
            children
          )}
        </ToastProvider>
      </body>
    </html>
  );
}
