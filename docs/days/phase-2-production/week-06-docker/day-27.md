# Day 27 — Docker Compose: Multi-Service Setup

> 🎯 **DAY GOAL:** Run Lunar + Ollama + Eval Service together with one command using Docker Compose

---

## 📚 CONCEPT 1: What is Docker Compose?

### WHAT — Simple Definition

**Docker Compose runs multiple containers together as one system.** One YAML file describes all your services, networks, and volumes.

```
WITHOUT COMPOSE (manual):
  Terminal 1: docker run ollama/ollama
  Terminal 2: docker run lunar
  Terminal 3: docker run lunar-eval
  Link them together manually... 😩

WITH COMPOSE (one command):
  docker compose up
  → Starts all 3 services
  → Creates network between them
  → Manages volumes for data
  → One Ctrl+C stops everything
```

### WHY — Why Compose for AI Projects?

```
Lunar needs multiple services:
  1. Ollama (LLM server)           — port 11434
  2. Lunar Gateway (your agent)    — port 3100
  3. Eval Service (Python)         — port 8000

These need to:
  → Talk to each other (Lunar → Ollama, Lunar → Eval)
  → Start in the right order (Ollama first!)
  → Share data (volumes for models, memory)
  → Have consistent configuration
```

### 🔗 NODE.JS ANALOGY

```
Docker Compose = package.json scripts + concurrently

// package.json (without compose)
"scripts": {
  "dev:ollama": "ollama serve",
  "dev:gateway": "tsx watch packages/gateway/src/index.ts",
  "dev:eval": "cd services/eval && uvicorn main:app",
  "dev": "concurrently pnpm:dev:*"    // run all
}

// docker-compose.yml (with compose)
services:
  ollama:  ...  // same as dev:ollama
  gateway: ...  // same as dev:gateway
  eval:    ...  // same as dev:eval
```

---

## 📚 CONCEPT 2: Compose File Anatomy

### HOW — Section by Section

```yaml
# version is implicit in modern Compose

services:          # ← Define each container
  ollama:          # ← Service name (becomes hostname)
    image: ...     # ← Which image to use
    ports: ...     # ← Expose ports to host
    volumes: ...   # ← Persistent storage

  gateway:
    build: ...     # ← Build from Dockerfile
    depends_on: .. # ← Start order
    environment: . # ← Environment variables

volumes:           # ← Named volumes for data
  ollama-data:
  lunar-data:

networks:          # ← Usually auto-created (default)
```

### Key Concepts

```
SERVICE NAMES = HOSTNAMES
  Within compose network:
    ollama  → http://ollama:11434
    gateway → http://gateway:3100
    eval    → http://eval:8000

  From your laptop:
    → http://localhost:11434
    → http://localhost:3100
    → http://localhost:8000

DEPENDS_ON = START ORDER
  gateway depends on ollama
  → Ollama starts first, gateway waits

VOLUMES = PERSISTENT STORAGE
  Without volume: data lost when container stops
  With volume: data persists between restarts
```

---

## 🔨 HANDS-ON: Create Docker Compose for Lunar

### Step 1: Create docker-compose.yml (30 minutes)

Create `docker-compose.yml` in project root:

```yaml
# ============================================
# Lunar AI Agent — Docker Compose
# ============================================
# Start everything: docker compose up
# Stop everything:  docker compose down
# Rebuild:          docker compose up --build

services:
  # ---- 1. Ollama (LLM Server) ----
  ollama:
    image: ollama/ollama:latest
    container_name: lunar-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama    # persist downloaded models
    deploy:
      resources:
        reservations:
          memory: 4G    # LLMs need RAM
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ---- 2. Lunar Gateway (Main Agent) ----
  gateway:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: lunar-gateway
    ports:
      - "3100:3100"
    environment:
      - LUNAR_PORT=3100
      - LUNAR_AGENT=main
      - LUNAR_MODEL=qwen2.5:3b
      - OLLAMA_URL=http://ollama:11434    # ← service name!
      - EVAL_URL=http://eval:8000         # ← service name!
      - NODE_ENV=production
    volumes:
      - lunar-data:/home/lunar/.lunar     # persist memory + sessions
    depends_on:
      ollama:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3100/api/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  # ---- 3. Eval Service (Python) ----
  eval:
    build:
      context: ./services/eval
      dockerfile: Dockerfile
    container_name: lunar-eval
    ports:
      - "8000:8000"
    environment:
      - OLLAMA_URL=http://ollama:11434
    depends_on:
      ollama:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  # ---- 4. Model Puller (init container — runs once) ----
  model-puller:
    image: curlimages/curl:latest
    container_name: lunar-model-puller
    depends_on:
      ollama:
        condition: service_healthy
    entrypoint: >
      sh -c "
        echo 'Pulling models...' &&
        curl -s http://ollama:11434/api/pull -d '{\"name\":\"qwen2.5:3b\"}' &&
        curl -s http://ollama:11434/api/pull -d '{\"name\":\"nomic-embed-text\"}' &&
        echo 'Models ready!'
      "
    restart: "no"

volumes:
  ollama-data:
    name: lunar-ollama-data
  lunar-data:
    name: lunar-data
```

### Step 2: Eval Service Dockerfile (10 minutes)

Create `services/eval/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Non-root user
RUN useradd --create-home eval
USER eval

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 3: Run Everything (10 minutes)

```bash
# Start all services
docker compose up -d
# [+] Running 4/4
# ✔ ollama      Started
# ✔ model-puller Started
# ✔ eval        Started
# ✔ gateway     Started

# Watch logs
docker compose logs -f
# lunar-ollama   | starting Ollama server...
# lunar-model-puller | Pulling models...
# lunar-eval     | INFO: Uvicorn running on 0.0.0.0:8000
# lunar-gateway  | 🌙 Lunar Gateway starting...
# lunar-gateway  | 🌙 Lunar is ready!

# Check all services
docker compose ps
# NAME               STATUS      PORTS
# lunar-ollama       running     11434
# lunar-gateway      running     3100
# lunar-eval         running     8000
# lunar-model-puller exited(0)

# Test
curl http://localhost:3100/api/health
curl http://localhost:8000/health
```

### Step 4: Useful Compose Commands (10 minutes)

```bash
# Start all
docker compose up -d              # detached (background)
docker compose up                 # foreground (see all logs)

# Stop all
docker compose down               # stop and remove containers
docker compose down -v            # also remove volumes (⚠️ data loss!)

# Rebuild after code changes
docker compose up --build -d      # rebuild changed images

# Logs
docker compose logs gateway       # one service
docker compose logs -f            # follow all
docker compose logs --tail=50     # last 50 lines

# Shell into a container
docker compose exec gateway /bin/sh
docker compose exec ollama /bin/sh

# Restart one service
docker compose restart gateway

# Scale (future: multiple agent instances)
docker compose up -d --scale gateway=2

# Resource usage
docker compose stats
```

---

## ✅ CHECKLIST

- [ ] docker-compose.yml with 4 services created
- [ ] Eval service Dockerfile created
- [ ] `docker compose up` starts everything
- [ ] Services can talk to each other by name
- [ ] Ollama models persist in volume
- [ ] Lunar data persists in volume
- [ ] Health checks working for all services

---

## 💡 KEY TAKEAWAY

**Docker Compose turns "install this, configure that, start these 3 terminals" into `docker compose up`. Service names become hostnames (ollama → http://ollama:11434). Volumes persist data. Health checks ensure services start in order. One file defines your entire AI system.**

---

**Next → [Day 28: Docker Volumes, Networks, and Security](day-28.md)**
