#!/bin/sh
set -e

# Wait for Postgres to accept connections — on a fresh Coolify stack the app
# container often starts before the database is ready.
echo "[responder] waiting for the database…"
i=0
until node -e "
const {PrismaClient}=require('@prisma/client');
new PrismaClient().\$queryRaw\`SELECT 1\`.then(()=>process.exit(0)).catch(()=>process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "[responder] database still unreachable after 60s — check DATABASE_URL"
    exit 1
  fi
  sleep 2
done

# Idempotent: a no-op when the schema already matches.
echo "[responder] applying database schema…"
node node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --skip-generate

echo "[responder] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec "$@"
