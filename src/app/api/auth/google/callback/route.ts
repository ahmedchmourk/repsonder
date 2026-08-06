import { handleGoogleCallback } from '@/lib/oauth-callback';


export const dynamic = 'force-dynamic';

/** Default callback path. See also /api/auth/callback/google (same handler). */
export const GET = handleGoogleCallback;
