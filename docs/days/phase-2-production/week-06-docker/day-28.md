# Day 28 — Docker Volumes, Networks, and Security

> 🎯 **DAY GOAL:** Master Docker data persistence, networking, and security best practices

---

## 📚 CONCEPT 1: Volumes — Persistent Storage

### WHAT — Simple Definition

**Containers are ephemeral (data lost when stopped). Volumes save data outside the container so it survives restarts.**

```
WITHOUT VOLUME:
  ┌──────────────┐
  │  Container   │
  │  /data/db    │  ← File is HERE
  └──────────────┘
  docker stop → container removed → data GONE ❌

WITH VOLUME:
  ┌──────────────┐     ┌─────────────┐
  │  Container   │────►│  Volume     │
  │  /data/db    │     │  (on host)  │  ← File is HERE
  └──────────────┘     └─────────────┘
  docker stop → container removed → data SAFE ✅
```

### Volume Types

```
1. NAMED VOLUME (recommended for production)
   volumes:
     - lunar-data:/home/lunar/.lunar
   Location: managed by Docker (don't need to know where)
   Best for: databases, model files, persistent state

2. BIND MOUNT (for development)
   volumes:
     - ./src:/app/src
   Location: your actual folder on the host
   Best for: live code reloading, config files

3. TMPFS (in-memory)
   tmpfs:
     - /tmp
   Location: RAM only (fast but gone on restart)
   Best for: temporary files, cache
```

### 🔗 NODE.JS ANALOGY

```
Named volume = database file on server disk
  → Survives app restarts
  → Managed separately from app code

Bind mount = local file in your project
  → nodemon watches for changes
  → Live reload during development

tmpfs = in-memory cache (like Redis in-memory mode)
  → Fast but not persistent
```

---

## 📚 CONCEPT 2: Networks — Service Communication

### WHAT — Simple Definition

**Docker networks control which containers can talk to each other. Compose creates a default network where all services can reach each other by name.**

```
┌─────────────────── lunar_default network ───────────────────┐
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  ollama  │    │ gateway  │    │   eval   │              │
│  │ :11434   │◄───│ :3100    │───►│ :8000    │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                       ▲                                      │
│                       │ port mapping                         │
└───────────────────────┼──────────────────────────────────────┘
                        │
                   ┌────┴─────┐
                   │  HOST    │
                   │ :3100    │  ← Only gateway exposed!
                   └──────────┘
```

### HOW — Network Security

```yaml
# docker-compose.yml — separate networks for security

services:
  ollama:
    networks:
      - backend          # ← only on backend network

  gateway:
    ports:
      - "3100:3100"      # ← exposed to host
    networks:
      - backend          # ← can reach ollama
      - frontend         # ← can be reached from outside

  eval:
    networks:
      - backend          # ← only on backend network
    # NO ports exposed!   # ← not accessible from outside

networks:
  frontend:
  backend:
    internal: true        # ← no external access
```

```
Result:
  ✅ Host → gateway:3100 (exposed)
  ✅ gateway → ollama:11434 (backend network)
  ✅ gateway → eval:8000 (backend network)
  ❌ Host → ollama:11434 (would need explicit port mapping)
  ❌ Host → eval:8000 (internal network, no ports)
```

---

## 📚 CONCEPT 3: Security Best Practices

### 1. Non-root User

```dockerfile
# BAD — runs as root (can access everything)
CMD ["node", "app.js"]

# GOOD — runs as unprivileged user
RUN useradd --create-home lunar
USER lunar
CMD ["node", "app.js"]
```

### 2. Minimal Base Image

```dockerfile
# BAD — full OS (1GB+, more attack surface)
FROM ubuntu:24.04

# BETTER — slim (200MB)
FROM node:22-slim

# BEST — distroless (80MB, no shell, no tools)
FROM gcr.io/distroless/nodejs22
```

### 3. No Secrets in Images

```dockerfile
# BAD — secret baked into image
ENV TELEGRAM_TOKEN=abc123

# GOOD — pass at runtime
# docker run -e TELEGRAM_TOKEN=abc123 lunar
```

```yaml
# GOOD — use env file with Compose
services:
  gateway:
    env_file:
      - .env    # ← not committed to git!
```

### 4. Read-only Filesystem

```yaml
services:
  gateway:
    read_only: true          # ← container can't write to filesystem
    tmpfs:
      - /tmp                 # ← except /tmp (for temporary files)
    volumes:
      - lunar-data:/data     # ← and the volume (for persistent data)
```

---

## 🔨 HANDS-ON: Secure Lunar Docker Setup

### Step 1: Create .env File (5 minutes)

Create `.env` (add to `.gitignore`!):

```env
# Lunar Configuration
LUNAR_PORT=3100
LUNAR_AGENT=main
LUNAR_MODEL=qwen2.5:3b

# Ollama
OLLAMA_URL=http://ollama:11434

# Telegram (optional)
TELEGRAM_BOT_TOKEN=

# Eval
EVAL_URL=http://eval:8000
```

### Step 2: Update docker-compose.yml for Security (20 minutes)

Create `docker-compose.prod.yml`:

```yaml
# Production-grade Docker Compose
# Usage: docker compose -f docker-compose.prod.yml up -d

services:
  ollama:
    image: ollama/ollama:latest
    container_name: lunar-ollama
    # NO ports exposed (only accessible from backend network)
    volumes:
      - ollama-data:/root/.ollama
    networks:
      - backend
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          memory: 4G
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  gateway:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: lunar-gateway
    ports:
      - "3100:3100"
    env_file:
      - .env
    volumes:
      - lunar-data:/home/lunar/.lunar
    networks:
      - frontend
      - backend
    depends_on:
      ollama:
        condition: service_healthy
    read_only: true
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3100/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  eval:
    build:
      context: ./services/eval
    container_name: lunar-eval
    # NO ports exposed
    env_file:
      - .env
    networks:
      - backend
    depends_on:
      ollama:
        condition: service_healthy
    read_only: true
    tmpfs:
      - /tmp
    restart: unless-stopped

volumes:
  ollama-data:
  lunar-data:

networks:
  frontend:
  backend:
    internal: true
```

### Step 3: Dev vs Prod Compose (10 minutes)

```bash
# Development (ports open for debugging)
docker compose up -d

# Production (locked down)
docker compose -f docker-compose.prod.yml up -d

# Override for development
# docker-compose.override.yml (auto-merged with docker-compose.yml)
```

Create `docker-compose.override.yml`:

```yaml
# Development overrides — auto-applied when running docker compose up
services:
  gateway:
    build:
      target: builder        # use builder stage (has dev deps)
    volumes:
      - ./packages:/app/packages   # live code reload
    command: ["pnpm", "dev"]

  eval:
    volumes:
      - ./services/eval:/app        # live code reload
    command: ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 4: Backup and Restore (10 minutes)

```bash
# Backup Lunar data
docker run --rm \
  -v lunar-data:/data \
  -v $(pwd)/backups:/backup \
  busybox tar czf /backup/lunar-data-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm \
  -v lunar-data:/data \
  -v $(pwd)/backups:/backup \
  busybox tar xzf /backup/lunar-data-20260225.tar.gz -C /

# Backup Ollama models
docker run --rm \
  -v lunar-ollama-data:/data \
  -v $(pwd)/backups:/backup \
  busybox tar czf /backup/ollama-models-$(date +%Y%m%d).tar.gz /data
```

---

## ✅ CHECKLIST

- [ ] Understand 3 volume types: named, bind mount, tmpfs
- [ ] Networks isolate services (frontend vs backend)
- [ ] Non-root user in Dockerfile
- [ ] Secrets in .env file (not in image)
- [ ] Read-only filesystem where possible
- [ ] Production compose file with security hardening
- [ ] Dev compose with live reload overrides
- [ ] Know how to backup/restore volumes

---

## 💡 KEY TAKEAWAY

**Volumes persist data, networks isolate services, non-root users limit damage. Production Docker: expose only necessary ports, use internal networks, read-only filesystems, and never bake secrets into images. Dev Docker: bind mounts for live reload.**

---

**Next → [Day 29: Docker Image Optimization](day-29.md)**
