# syntax=docker/dockerfile:1

# Base stage
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy package files. `.npmrc` carries `strict-dep-builds=false` so pnpm 10+
# doesn't fail the install because it skipped some packages' build scripts
# (sharp, @swc/core, @parcel/watcher are skipped by default for supply-chain
# safety; Next.js builds what it actually needs on demand).
COPY frontend/public-page/package.json frontend/public-page/pnpm-lock.yaml frontend/public-page/.npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY frontend/public-page/ .

# Production build-time env (NEXT_PUBLIC_* values are baked in at build time).
# Copy the whole matching set (the trailing `.example` makes it optional-by-glob
# so the build context isn't required to contain the real file) and require the
# REAL file — fail loudly rather than baking placeholder .example values into a
# production image. Create infra/env/public-page.env.prod from the .example
# before building (see docs/deployment.md).
COPY infra/env/public-page.env.prod* ./_env/
RUN if [ -f _env/public-page.env.prod ]; then \
      cp _env/public-page.env.prod .env.production && rm -rf _env; \
    else \
      echo "ERROR: infra/env/public-page.env.prod is missing." >&2; \
      echo "Create it from infra/env/public-page.env.prod.example and set the NEXT_PUBLIC_* values." >&2; \
      exit 1; \
    fi

# Build the application
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
