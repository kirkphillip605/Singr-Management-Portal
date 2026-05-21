# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for Next.js apps in the Singr monorepo
# ─────────────────────────────────────────────────────────────────────────────
# Build args:
#   APP_NAME    — directory name under apps/ (e.g. "host-portal")
#   APP_PACKAGE — workspace package name (e.g. "@singr/host-portal")
# ─────────────────────────────────────────────────────────────────────────────

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── Stage 1: Prune ────────────────────────────────────────────────────────
FROM base AS pruner
ARG APP_PACKAGE
COPY . .
RUN pnpm exec turbo prune ${APP_PACKAGE} --docker

# ── Stage 2: Install ──────────────────────────────────────────────────────
FROM base AS installer
ARG APP_NAME

# Install dependencies first (cached unless lockfile changes)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --prod=false

# Copy source and build
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma client
RUN pnpm --filter @singr/database exec prisma generate

# Build the target app
RUN pnpm exec turbo run build --filter=${APP_PACKAGE}

# ── Stage 3: Runner ───────────────────────────────────────────────────────
FROM node:24-alpine AS runner
ARG APP_NAME

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy standalone output
COPY --from=installer --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

# Create upload directory
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "apps/${APP_NAME}/server.js"]
