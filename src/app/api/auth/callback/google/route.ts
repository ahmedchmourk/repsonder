import { handleGoogleCallback } from '@/lib/oauth-callback';

export const dynamic = 'force-dynamic';

/**
 * NextAuth-style callback path. Registered on many OAuth clients out of habit, so
 * the app serves it too — identical behaviour to /api/auth/google/callback.
 */
export const GET = handleGoogleCallback;
