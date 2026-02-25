# Day 29 — Docker Image Optimization

> 🎯 **DAY GOAL:** Reduce image size from 500MB to under 150MB, speed up builds with layer caching

---

## 📚 CONCEPT 1: Why Image Size Matters

### WHAT — Simple Definition

**Smaller images = faster deploys, less storage, fewer vulnerabilities, quicker CI/CD.**

```
LARGE IMAGE (500MB):
  → Push to registry: 2 minutes
  → Pull on deploy: 2 minutes
  → CI/CD total: 4+ minutes per deploy
  → Attack surface: 1000+ packages installed

SMALL IMAGE (100MB):
  → Push: 20 seconds
  → Pull: 20 seconds
  → CI/CD total: <1 minute per deploy
  → Attack surface: only what you need
```

### 🔗 NODE.JS ANALOGY

```
Image size optimization = bundle size optimization

Unoptimized bundle (webpack with everything):
  → dist/bundle.js = 5MB
  → Load time: 3 seconds

Optimized (tree-shaking, code splitting, minification):
  → dist/bundle.js = 200KB
  → Load time: 0.2 seconds

Same idea for Docker images:
  → Only include what the app needs to run
  → Remove build tools, dev deps, cache
```

---

## 📚 CONCEPT 2: Multi-Stage Builds

### WHAT — Simple Definition

**Build in one stage (with all tools), copy only the output to a clean final stage.**

```
SINGLE STAGE (everything in one image):
  ┌─────────────────────┐
  │ node:22              │  200MB base
  │ + pnpm               │  +50MB
  │ + all node_modules   │  +200MB (includes devDependencies!)
  │ + source code        │  +10MB
  │ + built output       │  +5MB
  └─────────────────────┘
  Total: ~465MB

MULTI-STAGE (build then copy):
  Stage 1 (builder):         Stage 2 (production):
  ┌──────────────────┐       ┌────────────────────┐
  │ node:22           │       │ node:22-slim        │  80MB base
  │ + pnpm            │──────►│ + prod node_modules │  +50MB
  │ + all deps        │ COPY  │ + built output      │  +5MB
  │ + source          │ only  └────────────────────┘
  │ + built output    │       Total: ~135MB
  └──────────────────┘
  (discarded)
```

### HOW — Optimized Dockerfile

```dockerfile
# ============================================
# Stage 1: INSTALL (dependencies only)
# ============================================
FROM node:22-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only package files (great cache hit rate)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/llm/package.json packages/llm/
COPY packages/memory/package.json packages/memory/
COPY packages/tools/package.json packages/tools/
COPY packages/agent/package.json packages/agent/
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
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/packages/*/package.json ./packages/
COPY --from=builder /app/package.json ./

# Security
RUN useradd --create-home --shell /bin/false lunar
USER lunar
RUN mkdir -p /home/lunar/.lunar

EXPOSE 3100
ENV NODE_ENV=production

# Use exec form (proper signal handling)
CMD ["node", "packages/gateway/dist/index.js"]
```

---

## 🔨 HANDS-ON: Optimize Lunar Image

### Step 1: Measure Current Size (5 minutes)

```bash
# Build with current Dockerfile
docker build -t lunar:unoptimized .
docker images lunar:unoptimized
# SIZE: ~450MB (probably)

# Check what's taking space
docker run --rm lunar:unoptimized du -sh /app/node_modules
# 200MB+ (includes devDependencies!)

docker run --rm lunar:unoptimized du -sh /app/packages
# Check each package size
```

### Step 2: Apply Multi-Stage Build (20 minutes)

Update `Dockerfile` with the 3-stage build above, then:

```bash
# Rebuild
docker build -t lunar:optimized .
docker images | grep lunar
# lunar  unoptimized  450MB
# lunar  optimized    135MB  ← 3x smaller!
```

### Step 3: Layer Cache Optimization (15 minutes)

```bash
# Change a source file and rebuild
echo "// comment" >> packages/gateway/src/index.ts

# With good layer ordering:
time docker build -t lunar:optimized .
# Step 1/8 deps    → CACHED (package.json didn't change)
# Step 2/8 install → CACHED (lock file didn't change)
# Step 3/8 build   → executed (source changed)
# Total: ~15 seconds

# Without good layer ordering (everything after COPY . . is invalidated):
# Total: ~2 minutes (reinstalls all deps)
```

### Step 4: .dockerignore Optimization (5 minutes)

Update `.dockerignore`:

```
# Version control
.git
.gitignore

# Dependencies (installed in container)
node_modules
services/eval/.venv

# Build output (built in container)
dist
packages/*/dist

# Documentation (not needed in container)
docs/
*.md
!README.md

# Development files
.env
.env.*
docker-compose*.yml
Dockerfile*
.dockerignore

# IDE
.vscode
.idea

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test/eval data
services/eval/reports/
coverage/
```

### Step 5: Analyze with dive (10 minutes)

```bash
# Install dive — Docker image layer explorer
brew install dive

# Analyze the image
dive lunar:optimized

# Navigate layers with arrow keys
# Each layer shows:
#   → Size added
#   → Files added/modified/removed
#   → Wasted space

# Look for:
#   → Unnecessary large files
#   → Duplicate files across layers
#   → Dev dependencies that shouldn't be there
```

### Optimization Checklist

```
Technique                       Savings
─────────────────────────────────────────
Multi-stage build               ~60%  (removes build tools)
node:22-slim instead of node:22 ~30%  (200MB → 80MB base)
pnpm prune --prod               ~40%  (removes devDeps)
.dockerignore                   ~10%  (excluding docs, .git)
Layer ordering                  ~80%  (cache hits on rebuild)
─────────────────────────────────────────
Combined: 450MB → 120-150MB
```

---

## ✅ CHECKLIST

- [ ] Multi-stage Dockerfile (deps → build → production)
- [ ] Image size under 200MB
- [ ] `pnpm prune --prod` removes dev dependencies
- [ ] Layer cache working (rebuilds fast when only code changes)
- [ ] .dockerignore excludes docs, .git, node_modules
- [ ] Non-root user in final image
- [ ] `dive` analysis shows no wasted space

---

## 💡 KEY TAKEAWAY

**Multi-stage builds are the biggest win: build with all tools, then copy only the runtime output to a clean slim image. Layer ordering is the second biggest win: copy package.json before source code so dependency installation is cached. These two techniques cut image size by 3x and rebuild time by 10x.**

---

**Next → [Day 30: Docker in Development Workflow](day-30.md)**
