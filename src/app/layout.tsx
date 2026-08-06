import type { Metadata } from 'next';
import { Montserrat, Syne } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { ToastProvider } from '@/components/ui/toast';
import { THEME_INIT_SCRIPT } from '@/components/theme-toggle';
import { ensureSchedulerStarted } from '@/lib/bootstrap';

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
  title: 'Responder — Google review automation',
  description:
    'Fetches Google Business Profile reviews, drafts replies with an LLM, and routes them to auto-reply, approval, or a human.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Idempotent: starts the 24h ingest / publisher cron on the first render only.
  ensureSchedulerStarted();

  // `suppressHydrationWarning` below is required: THEME_INIT_SCRIPT adds `.dark`
  // to <html> before React hydrates, so the class attribute legitimately differs
  // from what the server rendered.
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${syne.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ToastProvider>
          <a
            href="#main"
            className="sr-only-focusable absolute left-4 top-4 z-50 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="shell py-6">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
