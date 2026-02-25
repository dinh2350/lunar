# Day 30 — Docker in Development Workflow

> 🎯 **DAY GOAL:** Use Docker for development with live reload, debugging, and logging — a complete dev workflow

---

## 📚 CONCEPT 1: Dev vs Production Docker

### WHAT — Simple Definition

**Development and production have different needs. Dev wants fast iteration; production wants stability and security.**

```
DEVELOPMENT:                          PRODUCTION:
  ✅ Live reload on code change         ❌ No live reload
  ✅ Debug tools available              ❌ Minimal tools
  ✅ All ports open for testing         ❌ Only necessary ports
  ✅ Source maps, verbose logs          ❌ Minified, structured logs
  ✅ Dev dependencies installed         ❌ Prod deps only
  ✅ Bind mounts for code               ❌ Code baked into image
```

### 🔗 NODE.JS ANALOGY

```
Dev Docker = nodemon + ts-node + devDependencies
  → Changes code → auto-restart → see result instantly

Prod Docker = node dist/index.js + only prod deps
  → Build once → deploy → runs unchanged
```

---

## 🔨 HANDS-ON: Complete Dev Workflow

### Step 1: Development Compose File (20 minutes)

Create `docker-compose.dev.yml`:

```yaml
# Development Docker Compose
# Usage: docker compose -f docker-compose.dev.yml up

services:
  ollama:
    image: ollama/ollama:latest
    container_name: lunar-ollama-dev
    ports:
      - "11434:11434"        # exposed for direct testing
    volumes:
      - ollama-data:/root/.ollama

  gateway:
    build:
      context: .
      dockerfile: Dockerfile
      target: deps           # stop at deps stage (has all deps)
    container_name: lunar-gateway-dev
    ports:
      - "3100:3100"
      - "9229:9229"          # Node.js debugger port!
    environment:
      - LUNAR_PORT=3100
      - OLLAMA_URL=http://ollama:11434
      - EVAL_URL=http://eval:8000
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      # Bind mount source code for live reload
      - ./packages:/app/packages
      - ./tsconfig.json:/app/tsconfig.json
    # Override command to use tsx watch (live reload)
    command: >
      sh -c "
        corepack enable &&
        npx tsx watch --inspect=0.0.0.0:9229 packages/gateway/src/index.ts
      "
    depends_on:
      - ollama

  eval:
    build:
      context: ./services/eval
    container_name: lunar-eval-dev
    ports:
      - "8000:8000"
    environment:
      - OLLAMA_URL=http://ollama:11434
    volumes:
      - ./services/eval:/app   # live reload
    command: uvicorn main:app --reload --host 0.0.0.0 --port 8000
    depends_on:
      - ollama

volumes:
  ollama-data:
```

### Step 2: Makefile for Common Tasks (15 minutes)

Create `Makefile`:

```makefile
# ============================================
# Lunar — Development Commands
# ============================================

.PHONY: dev prod stop logs shell build test eval clean

# ---- Development ----

dev:  ## Start development environment
	docker compose -f docker-compose.dev.yml up -d
	@echo "🌙 Dev environment ready!"
	@echo "  Gateway: http://localhost:3100"
	@echo "  Eval:    http://localhost:8000"
	@echo "  Ollama:  http://localhost:11434"
	@echo "  Debug:   chrome://inspect (port 9229)"

dev-logs:  ## Follow development logs
	docker compose -f docker-compose.dev.yml logs -f

dev-stop:  ## Stop development environment
	docker compose -f docker-compose.dev.yml down

# ---- Production ----

prod:  ## Start production environment
	docker compose -f docker-compose.prod.yml up -d

prod-stop:  ## Stop production environment
	docker compose -f docker-compose.prod.yml down

# ---- Build ----

build:  ## Build production image
	docker build -t lunar:latest .
	@docker images lunar:latest --format "Size: {{.Size}}"

# ---- Testing ----

test:  ## Run unit tests
	pnpm test

eval:  ## Run AI evaluation suite
	./scripts/eval.sh

# ---- Utilities ----

logs:  ## Follow all logs
	docker compose logs -f

shell-gateway:  ## Shell into gateway container
	docker compose exec gateway /bin/sh

shell-ollama:  ## Shell into ollama container
	docker compose exec ollama /bin/sh

health:  ## Check all service health
	@echo "Gateway:" && curl -s http://localhost:3100/api/health | jq .
	@echo "Eval:" && curl -s http://localhost:8000/health | jq .
	@echo "Ollama:" && curl -s http://localhost:11434/api/version | jq .

# ---- Cleanup ----

clean:  ## Remove containers and images
	docker compose down --rmi local
	docker system prune -f

clean-all:  ## Remove everything including volumes (⚠️ DATA LOSS!)
	docker compose down -v --rmi local
	docker system prune -af

# ---- Help ----

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
```

### Step 3: VS Code Debugging in Docker (10 minutes)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Docker",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "restart": true,
      "sourceMaps": true
    }
  ]
}
```

Usage:
1. `make dev` — start dev environment
2. VS Code → Run & Debug → "Attach to Docker"
3. Set breakpoints in your TypeScript code
4. They work inside the container!

### Step 4: Structured Logging for Docker (15 minutes)

When running in Docker, use JSON logs for easy parsing:

```typescript
// packages/shared/src/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDocker = process.env.NODE_ENV === 'production';

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  if (isDocker) {
    // JSON for Docker log aggregation (like CloudWatch, Datadog)
    console.log(JSON.stringify(entry));
  } else {
    // Pretty print for development
    const icons = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' };
    console.log(`${icons[level]} [${level.toUpperCase()}] ${message}`, data || '');
  }
}
```

```bash
# View logs in Docker
docker compose logs gateway | jq .
# {
#   "timestamp": "2026-02-25T14:30:00.000Z",
#   "level": "info",
#   "message": "Gateway started",
#   "port": 3100
# }
```

---

## ✅ CHECKLIST

- [ ] Dev compose with live reload (bind mounts + watch mode)
- [ ] Debug port (9229) exposed and VS Code config created
- [ ] Makefile with common commands
- [ ] Structured JSON logging for production
- [ ] Know difference between dev and prod Docker setup
- [ ] `make dev` starts everything with hot reload
- [ ] `make prod` starts production-grade setup

---

## 💡 KEY TAKEAWAY

**Use two compose files: dev (bind mounts, debug ports, watch mode) and prod (baked images, internal networks, security). A Makefile makes common commands memorable. Docker + VS Code debugging means you can set breakpoints in containerized code.**

---

## 🏆 WEEK 6 COMPLETE!

**What you mastered this week:**
- ✅ Docker fundamentals (image, container, layer caching)
- ✅ Docker Compose (multi-service orchestration)
- ✅ Volumes, networks, security best practices
- ✅ Image optimization (multi-stage, 3x size reduction)
- ✅ Development workflow (live reload, debugging, logging)

**Next → [Day 31: Cloud Fundamentals](../../phase-2-production/week-07-cloud/day-31.md)**
