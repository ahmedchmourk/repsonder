/** @type {import('next').NextConfig} */
const nextConfig = {
  // `instrumentation.ts` boots the in-process node-cron scheduler.
  serverExternalPackages: [
    'node-cron',
    '@prisma/client',
    'prisma',
    'googleapis',
    'googleapis-common',
    'google-auth-library',
    'gaxios',
  ],
};

export default nextConfig;
