/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image used by Coolify.
  output: 'standalone',
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
