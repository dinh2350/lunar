# Day 77 — Backup, Recovery + Scaling

> 🎯 **DAY GOAL:** Automate backups, test recovery, and understand horizontal scaling options

---

## 🔨 HANDS-ON: Backup System

### Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/lunar"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/lunar_${DATE}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting backup..."

# 1. SQLite backup (safe, uses .backup command)
docker compose exec -T agent sqlite3 /data/lunar.db ".backup /data/lunar_backup.db"

# 2. Archive data + config
tar -czf "$BACKUP_FILE" \
  ./data/ \
  ./.env \
  ./docker-compose.prod.yml

# 3. Rotate — keep last 7 days
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
```

### Recovery

```bash
# Restore from backup
tar -xzf /backups/lunar/lunar_20260301_120000.tar.gz
docker compose -f docker-compose.prod.yml up -d
```

### Scaling Strategy

```
SCALING OPTIONS:
  Users    Strategy
  ──────── ─────────────────────────────────
  1-10     Single VPS, local Ollama
  10-50    Single VPS, cloud LLM (Gemini/Groq)
  50-200   Bigger VPS, connection pooling, caching
  200+     Split: separate LLM server, read replicas
```

---

## ✅ CHECKLIST

- [ ] Automated SQLite backup (safe .backup method)
- [ ] Backup rotation (keep 7 days)
- [ ] Recovery tested and documented
- [ ] Scaling strategy documented

---

**Next → [Day 78: VPS Deployment](day-78.md)**
