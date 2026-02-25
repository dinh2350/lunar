# Day 35 — Production Deployment Checklist + Week 7 Wrap

> 🎯 **DAY GOAL:** Complete production deployment checklist — verify everything works end-to-end on cloud

---

## 📚 CONCEPT 1: The Production Readiness Checklist

### WHAT — Simple Definition

**A systematic list of everything that must be verified before calling a deployment "production."**

```
DEPLOYMENT IS NOT JUST "docker compose up"

It's:
  ✅ Working    — app serves requests correctly
  ✅ Secure     — HTTPS, firewall, non-root, secrets safe
  ✅ Observable — logs, metrics, health checks
  ✅ Resilient  — auto-restart, backups, recovery plan
  ✅ Documented — README, architecture, runbook
```

---

## 🔨 HANDS-ON: Run the Checklist

### Checklist 1: Infrastructure (15 minutes)

```bash
# ON SERVER

# 1. Docker running
docker --version && docker compose version
# ✅ Docker 27+, Compose 2+

# 2. Firewall configured
ufw status
# ✅ 22 (SSH), 80 (HTTP), 443 (HTTPS) — nothing else

# 3. System updated
apt update && apt list --upgradable
# ✅ No critical updates pending

# 4. Disk space
df -h /
# ✅ >50% free space

# 5. Memory
free -h
# ✅ >1GB free (after all services running)
```

### Checklist 2: Services (15 minutes)

```bash
# All services running
docker compose -f docker-compose.prod.yml ps
# ✅ caddy     running   ← reverse proxy
# ✅ gateway   running   ← your agent
# ✅ ollama    running   ← LLM server
# ✅ eval      running   ← evaluation service

# Health checks
curl -s https://lunar.yourdomain.com/api/health | jq .
# ✅ {"status":"ok","agent":"main","model":"qwen2.5:3b"}

# WebSocket
# npx wscat -c wss://lunar.yourdomain.com/ws/chat
# ✅ Connected

# Telegram bot (if configured)
# Send message to your bot → ✅ responds
```

### Checklist 3: Security (10 minutes)

```bash
# HTTPS working
curl -I https://lunar.yourdomain.com
# ✅ HTTP/2 200
# ✅ strict-transport-security header present

# HTTP redirects to HTTPS
curl -I http://lunar.yourdomain.com
# ✅ 308 Redirect → https://

# No direct port access
curl http://YOUR_IP:3100 2>&1
# ✅ Connection refused (Caddy handles it)

# Non-root containers
docker compose exec gateway whoami
# ✅ lunar (not root)

# No secrets in images
docker history lunar:latest | grep -i "env\|secret\|token"
# ✅ Nothing sensitive
```

### Checklist 4: Data Safety (10 minutes)

```bash
# Volumes created
docker volume ls | grep lunar
# ✅ lunar-data
# ✅ lunar-ollama-data
# ✅ caddy-data

# Backup script works
./scripts/backup.sh
# ✅ Backup created

# Backup cron configured
crontab -l | grep backup
# ✅ 0 3 * * * /opt/lunar/scripts/backup.sh

# Test restore (on a test copy, not production!)
# ./scripts/restore.sh backups/lunar-backup-latest.tar.gz
# ✅ Restore works
```

### Checklist 5: Monitoring (10 minutes)

```bash
# Logs accessible
docker compose logs --tail=10 gateway
# ✅ Structured JSON logs

# Metrics endpoint
curl -s https://lunar.yourdomain.com/api/metrics | jq .
# ✅ Returns request counts, latency, etc.

# External monitoring
# Check UptimeRobot dashboard
# ✅ Monitor configured, status "Up"

# Alert tested
# Stop gateway briefly, verify alert received
# docker compose stop gateway
# Wait 5 minutes... ✅ Got email/notification
# docker compose start gateway
```

### Checklist 6: Documentation (15 minutes)

Create `DEPLOYMENT.md`:

```markdown
# Lunar Deployment Guide

## Quick Start
\```bash
git clone https://github.com/youruser/lunar.git
cd lunar
cp .env.example .env   # edit with your values
docker compose -f docker-compose.prod.yml up -d
\```

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| LUNAR_MODEL | Yes | Ollama model name (default: qwen2.5:3b) |
| TELEGRAM_BOT_TOKEN | No | Telegram bot token from @BotFather |
| LUNAR_PORT | No | Gateway port (default: 3100) |

## Common Operations
\```bash
# View logs
docker compose logs -f gateway

# Restart after code update
git pull
docker compose up --build -d

# Manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backups/lunar-backup-YYYYMMDD.tar.gz

# Check health
curl https://lunar.yourdomain.com/api/health
\```

## Architecture
  User → Caddy (HTTPS) → Gateway → Agent → Ollama
                                  → Memory (SQLite)
                                  → Tools

## Troubleshooting
| Symptom | Check | Fix |
|---|---|---|
| 502 Bad Gateway | `docker compose ps` | Restart gateway |
| Slow responses | `docker stats` | Check RAM, model size |
| No Telegram | Bot token in .env? | Reconfigure token |
| SSL error | `docker compose logs caddy` | Check domain DNS |
```

---

## 📊 Week 7 Summary: What You Deployed

```
YOUR PRODUCTION SETUP:
  ┌─────────────────────────────────────────────────┐
  │                  INTERNET                        │
  │                     │                            │
  │              ┌──────▼──────┐                     │
  │              │   CADDY     │  HTTPS + Proxy      │
  │  UptimeRobot │  :80/:443  │  Auto SSL           │
  │  monitoring  └──────┬──────┘                     │
  │                     │                            │
  │  ┌──────────────────┼──────────────┐             │
  │  │           ┌──────▼──────┐       │ VPS         │
  │  │           │  GATEWAY    │       │ $5-10/mo    │
  │  │           │  :3100      │       │             │
  │  │           └──────┬──────┘       │             │
  │  │                  │              │             │
  │  │  ┌───────┐  ┌───▼───┐          │             │
  │  │  │OLLAMA │  │MEMORY │          │             │
  │  │  │:11434 │  │SQLite │          │             │
  │  │  └───────┘  └───────┘          │             │
  │  │                                 │             │
  │  │  📁 Volumes (persistent data)   │             │
  │  │  📋 Daily backups               │             │
  │  │  📊 Metrics + logging           │             │
  │  └─────────────────────────────────┘             │
  └─────────────────────────────────────────────────┘
```

---

## ✅ MASTER CHECKLIST

- [ ] All services running and healthy
- [ ] HTTPS with auto-renewing certificate
- [ ] Firewall only allows 22, 80, 443
- [ ] Non-root containers
- [ ] Secrets in .env (not in images)
- [ ] Volumes for persistent data
- [ ] Daily automated backups with rotation
- [ ] Restore script tested
- [ ] Structured logging
- [ ] Metrics endpoint
- [ ] External uptime monitoring with alerts
- [ ] DEPLOYMENT.md documentation
- [ ] Can do full deploy from scratch in <15 minutes

---

## 💡 KEY TAKEAWAY

**Production readiness is a checklist, not a feeling. Infrastructure, services, security, data safety, monitoring, documentation — verify each one. Your Lunar instance is now a real production AI service: HTTPS, monitored, backed up, documented, and deployable by anyone.**

---

## 🏆 WEEK 7 COMPLETE!

**What you mastered this week:**
- ✅ VPS setup and Docker deployment
- ✅ Domain + HTTPS with Caddy (zero-config SSL)
- ✅ Monitoring, logging, and alerting
- ✅ Automated backups with rotation
- ✅ Production deployment checklist

**Next → [Day 36: MCP — Model Context Protocol](../../phase-2-production/week-08-mcp/day-36.md)**
