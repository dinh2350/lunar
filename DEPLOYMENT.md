# Lunar Deployment Guide

## Quick Start
```bash
git clone https://github.com/youruser/lunar.git
cd lunar
cp .env.example .env   # edit with your values
docker compose -f docker-compose.prod.yml up -d
```

## Prerequisites
- Docker & Docker Compose
- A VPS with 4GB+ RAM (8GB recommended)
- Domain name (optional, for HTTPS)
- Ollama-compatible hardware (or remote Ollama)

## Environment Variables
| Variable | Required | Default | Description |
|---|---|---|---|
| LUNAR_MODEL | No | qwen2.5:3b | Ollama model name |
| LUNAR_PORT | No | 3100 | Gateway port |
| LUNAR_AGENT | No | main | Agent name |
| OLLAMA_URL | No | http://ollama:11434 | Ollama server URL |
| EVAL_URL | No | http://eval:8000 | Eval service URL |
| TELEGRAM_BOT_TOKEN | No | | Telegram bot token from @BotFather |
| LOG_LEVEL | No | info | Log level (debug/info/warn/error) |

## Production Deployment

### 1. Server Setup
```bash
# On your VPS
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# Create non-root user
useradd -m -s /bin/bash lunar
usermod -aG docker lunar

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 2. Deploy
```bash
# From your laptop
./scripts/deploy.sh lunar  # where 'lunar' is your SSH host alias
```

### 3. Setup HTTPS (optional)
Edit `Caddyfile` with your domain, then restart:
```bash
docker compose -f docker-compose.prod.yml restart caddy
```

## Common Operations

### View logs
```bash
docker compose logs -f gateway
docker compose logs -f --tail=50
```

### Restart after code update
```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

### Manual backup
```bash
./scripts/backup.sh
```

### Restore from backup
```bash
./scripts/restore.sh backups/lunar-backup-YYYYMMDD.tar.gz
```

### Check health
```bash
./scripts/healthcheck.sh
# or
curl https://lunar.yourdomain.com/api/health
```

### View metrics
```bash
curl http://localhost:3100/api/metrics
```

## Architecture
```
User → Caddy (HTTPS :443) → Gateway (:3100) → Agent → Ollama (:11434)
                                             → Memory (SQLite)
                                             → Tools
                          → Eval (:8000)     → Ollama
```

## Docker Compose Files
| File | Use |
|---|---|
| `docker-compose.yml` | Base services |
| `docker-compose.dev.yml` | Development (live reload, debug) |
| `docker-compose.prod.yml` | Production (Caddy, security, networks) |
| `docker-compose.override.yml` | Dev overrides (auto-applied) |

## Troubleshooting
| Symptom | Check | Fix |
|---|---|---|
| 502 Bad Gateway | `docker compose ps` | Restart gateway |
| Slow responses | `docker stats` | Check RAM, reduce model size |
| No Telegram | Bot token in .env? | Set TELEGRAM_BOT_TOKEN |
| SSL error | `docker compose logs caddy` | Check domain DNS |
| Out of memory | `free -h` | Use smaller model or add swap |
| Container crash | `docker compose logs <service>` | Check error, restart |

## Backup Schedule
- **Daily at 3 AM**: Automated backup via cron
- **Retention**: 7 days (configurable in `scripts/backup.sh`)
- **Manual**: Run `./scripts/backup.sh` anytime

## Security Checklist
- [ ] Non-root containers (`USER lunar` / `USER eval`)
- [ ] Read-only filesystem (`read_only: true`)
- [ ] Network isolation (backend network is `internal: true`)
- [ ] No secrets in Docker images
- [ ] HTTPS via Caddy with auto-renewal
- [ ] Firewall (only 22, 80, 443 open)
- [ ] `.env` file not committed to git
