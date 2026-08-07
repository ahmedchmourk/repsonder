import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateBusinessForm } from '@/components/business/create-business-form';
import { countBusinesses } from '@/lib/business';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Add an organisation — Responder' };

/**
 * Adding an organisation gets its own page rather than a form tucked under the
 * current organisation's settings — filling in one while looking at another was
 * confusing.
 */
export default async function NewBusinessPage() {
  const existing = await countBusinesses();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {existing > 0 ? (
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to reviews
        </Link>
      ) : null}

      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">
          Add an organisation
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Its reviews, replies and settings stay completely separate from your other
          organisations.
        </p>
      </div>

      <CreateBusinessForm />
    </div>
  );
}
