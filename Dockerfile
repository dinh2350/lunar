# ============================================
# Lunar AI Agent — Production Dockerfile
# ============================================

# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies first (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/memory/package.json packages/memory/
COPY packages/tools/package.json packages/tools/
COPY packages/agent/package.json packages/agent/
COPY packages/session/package.json packages/session/
COPY packages/connectors/package.json packages/connectors/
COPY packages/gateway/package.json packages/gateway/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Stage 2: Production (smaller image)
FROM node:22-slim AS production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only what's needed
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Non-root user (security best practice)
RUN useradd --create-home lunar
USER lunar

# Data directory
RUN mkdir -p /home/lunar/.lunar

EXPOSE 3100

ENV NODE_ENV=production
ENV LUNAR_PORT=3100

CMD ["node", "packages/gateway/src/index.ts"]
