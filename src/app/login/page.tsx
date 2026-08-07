import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in — Responder' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // Already signed in? Nothing to do here.
  if (await currentUser()) redirect('/');

  const raw = (await searchParams).next;
  const next = Array.isArray(raw) ? raw[0] : raw;
  // Only allow same-site paths, so `?next=` cannot bounce someone off-site.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="Responder by Octicode"
            width={364}
            height={63}
            priority
            className="h-8 w-auto"
          />
        </div>

        <div className="soft rounded-2xl border border-border bg-card p-7">
          <div className="mb-6">
            <h1 className="font-heading text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage your reviews.
            </p>
          </div>

          <LoginForm next={safeNext} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Responder by Octicode
        </p>
      </div>
    </div>
  );
}
