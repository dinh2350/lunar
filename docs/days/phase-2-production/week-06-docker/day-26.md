# Day 26 — Docker Fundamentals for AI Engineers

> 🎯 **DAY GOAL:** Understand Docker by mapping every concept to Node.js development — then containerize Lunar

---

## 📚 CONCEPT 1: What is Docker?

### WHAT — Simple Definition

**Docker packages your app + all its dependencies into a single portable box (container) that runs the same everywhere.**

```
WITHOUT DOCKER:
  Developer machine:  node 22, pnpm 9, ollama, sqlite
  Server:             node 18, npm 8, no ollama, no sqlite
  Result:             "Works on my machine" 🤷

WITH DOCKER:
  Dockerfile → Image → Container
  Contains:   node 22, pnpm 9, your code, sqlite
  Result:     Same everywhere ✅
```

### WHY — Why Docker for AI Projects?

```
AI projects have MORE dependencies than typical web apps:
  ✅ Node.js 22 + pnpm (your code)
  ✅ Python 3.12 + pip (eval service)
  ✅ Ollama (LLM server)
  ✅ SQLite + sqlite-vec (vector database)
  ✅ System libraries (build tools for native modules)

Docker bundles ALL of these so:
  → Teammate can run Lunar with one command
  → Deploy to any cloud (AWS, GCP, VPS)
  → No "install X, Y, Z, then configure..." instructions
```

### 🔗 NODE.JS ANALOGY

```
Docker concepts → Node.js equivalents:

Dockerfile     = package.json + install script
  (recipe)       Declares what to install and how to build

Image          = node_modules + built code (frozen)
  (snapshot)     The result of running `pnpm install && pnpm build`

Container      = running `node dist/index.js`
  (process)      A live instance of your image

Registry       = npm registry
  (store)        DockerHub, GitHub Container Registry

docker pull    = pnpm install
docker build   = pnpm install && pnpm build
docker run     = pnpm start
docker-compose = running multiple services (like concurrently)
```

---

## 📚 CONCEPT 2: Dockerfile — The Recipe

### WHAT — Simple Definition

**A Dockerfile is a step-by-step recipe to build your app image.** Each line creates a layer (cached for speed).

### HOW — Line by Line

```dockerfile
# 1. Start from a base image (like choosing a starter template)
FROM node:22-slim

# 2. Set working directory (like cd /app)
WORKDIR /app

# 3. Copy package files first (for layer caching)
COPY package.json pnpm-lock.yaml ./

# 4. Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# 5. Copy source code
COPY . .

# 6. Build
RUN pnpm build

# 7. Expose port (documentation, not enforcement)
EXPOSE 3100

# 8. Start command
CMD ["node", "packages/gateway/dist/index.js"]
```

### WHY — Why This Order?

```
Docker caches layers. If a file hasn't changed, Docker skips that step.

BAD order (rebuilds everything on code change):
  COPY . .                    ← code changed? Rebuild from here!
  RUN pnpm install            ← reinstalls ALL deps every time
  RUN pnpm build

GOOD order (only rebuilds what changed):
  COPY package.json .         ← dependencies rarely change
  RUN pnpm install            ← cached! (fast)
  COPY . .                    ← code changes frequently
  RUN pnpm build              ← only rebuilds code

Like: if package.json didn't change, skip pnpm install
```

---

## 🔨 HANDS-ON: Dockerize Lunar

### Step 1: Install Docker (5 minutes)

> **⚠️ M1 8GB Mac Tip:** Docker Desktop uses ~1-2GB RAM. Consider **OrbStack** instead
> (`brew install --cask orbstack`) — it's 3-5x lighter on memory and faster on Apple Silicon.
> OrbStack is a drop-in Docker Desktop replacement. All `docker` commands work the same.

```bash
# macOS — Option A: Docker Desktop
brew install --cask docker
# Then open Docker Desktop app

# macOS — Option B: OrbStack (recommended for 8GB Mac)
brew install --cask orbstack

# Verify
docker --version
docker compose version
```

### Step 2: Create Lunar Dockerfile (20 minutes)

Create `Dockerfile` in project root:

```dockerfile
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
COPY packages/llm/package.json packages/llm/
COPY packages/memory/package.json packages/memory/
COPY packages/tools/package.json packages/tools/
COPY packages/agent/package.json packages/agent/
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
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/packages/*/package.json ./packages/

# Non-root user (security best practice)
RUN useradd --create-home lunar
USER lunar

# Data directory
RUN mkdir -p /home/lunar/.lunar

EXPOSE 3100

ENV NODE_ENV=production
ENV LUNAR_PORT=3100

CMD ["node", "packages/gateway/dist/index.js"]
```

### Step 3: Create .dockerignore (5 minutes)

Create `.dockerignore`:

```
node_modules
dist
.git
.env
*.log
services/eval/.venv
docs/
```

### Step 4: Build and Run (15 minutes)

```bash
# Build the image
docker build -t lunar:latest .
# This takes a few minutes the first time

# Check the image size
docker images lunar
# REPOSITORY  TAG     SIZE
# lunar       latest  ~250MB

# Run the container
docker run -d \
  --name lunar \
  -p 3100:3100 \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  -v lunar-data:/home/lunar/.lunar \
  lunar:latest

# Check logs
docker logs lunar
# 🌙 Lunar Gateway starting...
# 🌙 Lunar is ready!

# Test
curl http://localhost:3100/api/health
# {"status":"ok","agent":"main"}
```

### Key Docker Commands Cheat Sheet

```bash
# Build
docker build -t lunar:latest .          # Build image
docker build --no-cache -t lunar .       # Rebuild everything

# Run
docker run -d --name lunar lunar:latest  # Run in background
docker run -it lunar:latest /bin/sh      # Interactive shell

# Manage
docker ps                                # List running containers
docker logs lunar                        # View logs
docker logs -f lunar                     # Follow logs (like tail -f)
docker stop lunar                        # Stop container
docker rm lunar                          # Remove container

# Inspect
docker exec -it lunar /bin/sh            # Shell into running container
docker stats lunar                       # Resource usage

# Clean up
docker system prune                      # Remove unused data
```

---

## ✅ CHECKLIST

- [ ] Docker installed and running
- [ ] Understand: Dockerfile = recipe, Image = snapshot, Container = process
- [ ] Multi-stage build (builder → production)
- [ ] .dockerignore created
- [ ] `docker build` succeeds
- [ ] `docker run` starts Lunar
- [ ] Health endpoint reachable from host

---

## 💡 KEY TAKEAWAY

**Docker = "works on my machine" → "works everywhere." A Dockerfile is a recipe, an image is the frozen result, a container is the running instance. Multi-stage builds keep images small. Layer ordering keeps builds fast.**

---

**Next → [Day 27: Docker Compose — Multi-Service Setup](day-27.md)**
