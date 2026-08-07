import { NextResponse } from 'next/server';
import { apiError, readJson } from '@/lib/api';
import { ensureSeedUsers, signIn } from '@/lib/auth';
import { ensureSeedBusiness } from '@/lib/seed-business';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // First boot: make sure the team's accounts exist before checking the password.
    await ensureSeedUsers();

    const body = await readJson<{ email?: string; password?: string }>(request);
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
    }

    const result = await signIn(body.email, body.password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

    // Only after a valid sign-in, so the seed cannot be probed anonymously.
    await ensureSeedBusiness();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
