# Day 76 — Production Docker Setup

> 🎯 **DAY GOAL:** Create production-ready Docker Compose with Ollama, Lunar agent, UI, and Caddy reverse proxy

---

## 🔨 HANDS-ON: Production Docker Compose

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  # Reverse proxy + HTTPS
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

  # Lunar Agent API
  agent:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - OLLAMA_URL=http://ollama:11434
      - DATABASE_PATH=/data/lunar.db
    volumes:
      - lunar_data:/data
    depends_on:
      - ollama
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M

  # Control UI
  ui:
    build:
      context: ./packages/ui
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://agent:3000
    restart: unless-stopped

  # Local LLM
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]  # GPU passthrough
    restart: unless-stopped

volumes:
  caddy_data:
  lunar_data:
  ollama_models:
```

### Multi-stage Dockerfile

```dockerfile
# ── Build Stage ──
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

# ── Production Stage ──
FROM node:22-alpine AS production
WORKDIR /app
RUN corepack enable pnpm

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/*/dist/ packages/
COPY --from=build /app/node_modules/ node_modules/

ENV NODE_ENV=production
EXPOSE 3000
USER node

CMD ["node", "packages/agent/dist/server.js"]
```

### Caddyfile (auto HTTPS)

```
lunar.yourdomain.com {
  handle /api/* {
    reverse_proxy agent:3000
  }
  handle {
    reverse_proxy ui:3000
  }
}
```

---

## ✅ CHECKLIST

- [ ] Multi-stage Dockerfile (build + production)
- [ ] Docker Compose with Caddy, Agent, UI, Ollama
- [ ] GPU passthrough for Ollama
- [ ] Auto HTTPS with Caddy
- [ ] Persistent volumes for data + models
- [ ] Resource limits configured
- [ ] Health checks added

---

**Next → [Day 77: Backup, Recovery + Scaling](day-77.md)**
