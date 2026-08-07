# syntax=docker/dockerfile:1

# ---- deps -------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` runs the postinstall `prisma generate`, which needs the schema above.
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma only needs a syntactically valid URL at build time; the real one is
# injected at runtime by Coolify.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build
# Pin the exact CLI version so the runtime stage cannot drift from the client.
RUN node -p "require('prisma/package.json').version" > /tmp/prisma-version

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Standalone output already contains the pruned node_modules it needs.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma Client engine, needed by the app itself.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# The Prisma CLI is installed into its own prefix rather than copied piecemeal:
# `prisma/build/index.js` pulls in @prisma/config -> effect and friends, which a
# hand-picked COPY silently misses. Isolating it also stops `npm install` from
# pruning the standalone node_modules as "extraneous".
COPY --from=builder /tmp/prisma-version /tmp/prisma-version
RUN npm install --no-save --no-audit --no-fund --prefix /prisma-cli \
      "prisma@$(cat /tmp/prisma-version)" \
 && rm -rf /root/.npm /tmp/prisma-version

RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
