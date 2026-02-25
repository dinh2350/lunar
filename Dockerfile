# ============================================
# Lunar AI Agent — Optimized Production Dockerfile
# ============================================

# ============================================
# Stage 1: INSTALL (dependencies only)
# ============================================
FROM node:22-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only package files (great cache hit rate)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/memory/package.json packages/memory/
COPY packages/tools/package.json packages/tools/
COPY packages/agent/package.json packages/agent/
COPY packages/session/package.json packages/session/
COPY packages/connectors/package.json packages/connectors/
COPY packages/gateway/package.json packages/gateway/

# Install ALL dependencies (including devDeps for building)
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: BUILD (compile TypeScript)
# ============================================
FROM deps AS builder
COPY . .
RUN pnpm build

# Remove dev dependencies after build
RUN pnpm prune --prod

# ============================================
# Stage 3: PRODUCTION (minimal runtime)
# ============================================
FROM node:22-slim AS production
WORKDIR /app

# Only copy what we need to RUN (not build)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./

# Security
RUN useradd --create-home --shell /bin/false lunar
USER lunar
RUN mkdir -p /home/lunar/.lunar

EXPOSE 3100
ENV NODE_ENV=production

# Use exec form (proper signal handling)
CMD ["node", "packages/gateway/src/index.ts"]
