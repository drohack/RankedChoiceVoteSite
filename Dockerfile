# syntax=docker/dockerfile:1

# ---- Build stage ---------------------------------------------------------
# Alpine so the native modules (better-sqlite3, sharp) are compiled against the
# same musl libc the runner uses.
FROM node:22-alpine AS builder
WORKDIR /app

# Build tools for better-sqlite3's native addon.
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Deploy gate: the full test suite must pass before an image is produced.
RUN npm test

# Next.js standalone output (see next.config.js: output: 'standalone').
RUN npm run build

# ---- Runtime stage -------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# SQLite db + uploaded images live here; mount a volume at /data.
ENV DATA_DIR=/data

RUN apk add --no-cache libc6-compat \
  && addgroup -g 1001 -S nodejs \
  && adduser -u 1001 -S nextjs -G nodejs \
  && mkdir -p /data \
  && chown -R nextjs:nodejs /data

# Standalone server bundle + static assets (traced native modules included).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "server.js"]
