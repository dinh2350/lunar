# Day 34 — Backup, Recovery, and Data Safety

> 🎯 **DAY GOAL:** Never lose data — automate backups for Lunar's memory, sessions, and configuration

---

## 📚 CONCEPT 1: What to Back Up

### WHAT — Lunar's Data Map

```
CRITICAL (lose this = lose memory):
  ~/.lunar/agents/main/
  ├── workspace/
  │   ├── MEMORY.md              ← permanent facts about user
  │   └── memory/                ← daily notes
  │       ├── 2026-02-23.md
  │       └── 2026-02-25.md
  └── data/
      ├── vectors.db             ← SQLite vector store
      └── sessions/              ← conversation history
          └── *.jsonl

IMPORTANT (lose this = need to reconfigure):
  /opt/lunar/.env                ← config + tokens
  /opt/lunar/Caddyfile           ← reverse proxy config

REPLACEABLE (can re-download):
  Ollama models                  ← re-pull with ollama pull
  Docker images                  ← re-build or re-pull
  node_modules                   ← pnpm install
```

### WHY — Backup Strategy

```
3-2-1 RULE:
  3 copies of important data
  2 different storage types (local + remote)
  1 offsite (cloud storage)

For Lunar:
  Copy 1: Live data on VPS           (primary)
  Copy 2: Daily backup on VPS disk   (local backup)
  Copy 3: Weekly sync to cloud       (offsite backup)
```

---

## 🔨 HANDS-ON: Automate Backups

### Step 1: Backup Script (20 minutes)

Create `scripts/backup.sh`:

```bash
#!/bin/bash
# Lunar Backup Script — run daily via cron
set -euo pipefail

BACKUP_DIR="/opt/lunar/backups"
DATA_DIR="/home/lunar/.lunar"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/lunar-backup-${DATE}.tar.gz"
KEEP_DAYS=7  # Keep backups for 7 days

echo "🌙 Lunar Backup — ${DATE}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup critical data
echo "  📦 Backing up data..."
tar czf "${BACKUP_FILE}" \
  -C / \
  "${DATA_DIR#/}/agents" \
  "opt/lunar/.env" \
  "opt/lunar/Caddyfile" \
  2>/dev/null || true

# Show backup size
SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "  💾 Backup: ${BACKUP_FILE} (${SIZE})"

# Rotate old backups (delete older than KEEP_DAYS)
echo "  🗑️  Cleaning backups older than ${KEEP_DAYS} days..."
find "${BACKUP_DIR}" -name "lunar-backup-*.tar.gz" -mtime "+${KEEP_DAYS}" -delete

# List remaining backups
echo "  📋 Current backups:"
ls -lh "${BACKUP_DIR}"/lunar-backup-*.tar.gz 2>/dev/null | tail -5

echo "✅ Backup complete!"
```

### Step 2: Restore Script (15 minutes)

Create `scripts/restore.sh`:

```bash
#!/bin/bash
# Lunar Restore Script — restore from backup
set -euo pipefail

BACKUP_DIR="/opt/lunar/backups"

# List available backups
echo "🌙 Available backups:"
ls -lh "${BACKUP_DIR}"/lunar-backup-*.tar.gz 2>/dev/null

if [ $# -eq 0 ]; then
  # Use latest backup
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/lunar-backup-*.tar.gz 2>/dev/null | head -1)
else
  BACKUP_FILE="$1"
fi

if [ -z "${BACKUP_FILE}" ]; then
  echo "❌ No backup found!"
  exit 1
fi

echo ""
echo "⚠️  This will restore from: ${BACKUP_FILE}"
echo "⚠️  Current data will be OVERWRITTEN."
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Stop Lunar
echo "  🛑 Stopping Lunar..."
cd /opt/lunar
docker compose down

# Restore
echo "  📦 Restoring..."
tar xzf "${BACKUP_FILE}" -C /

# Restart
echo "  🚀 Starting Lunar..."
docker compose up -d

echo "✅ Restore complete!"
```

### Step 3: Automate with Cron (10 minutes)

```bash
# Make scripts executable
chmod +x scripts/backup.sh scripts/restore.sh

# Add to crontab — backup daily at 3 AM
crontab -e
# Add these lines:
# Daily backup at 3 AM
0 3 * * * /opt/lunar/scripts/backup.sh >> /var/log/lunar-backup.log 2>&1

# Health check every minute
* * * * * /opt/lunar/scripts/healthcheck.sh
```

### Step 4: Offsite Backup to Cloud (15 minutes)

Option A — rsync to another server:
```bash
# Weekly sync to offsite
rsync -avz /opt/lunar/backups/ backup-server:/backups/lunar/
```

Option B — rclone to cloud storage (free tiers):
```bash
# Install rclone
curl https://rclone.org/install.sh | bash

# Configure (interactive setup)
rclone config
# Choose: Google Drive (15GB free) or Backblaze B2 (10GB free)

# Sync backups
rclone sync /opt/lunar/backups remote:lunar-backups/

# Add to cron (weekly)
# 0 4 * * 0 rclone sync /opt/lunar/backups remote:lunar-backups/
```

### Step 5: SQLite-Specific Backup (10 minutes)

SQLite needs special handling for live backups:

```bash
# BAD: copying while SQLite is writing can corrupt
cp vectors.db vectors-backup.db  # ❌ DANGER

# GOOD: use SQLite's backup API
sqlite3 vectors.db ".backup vectors-backup.db"  # ✅ SAFE

# OR: use VACUUM INTO (creates optimized copy)
sqlite3 vectors.db "VACUUM INTO 'vectors-backup.db';"  # ✅ SAFE + optimized
```

Update backup script to use safe SQLite backup:
```bash
# In scripts/backup.sh, before tar:
echo "  🗄️  Safe SQLite backup..."
docker compose exec gateway \
  sqlite3 /home/lunar/.lunar/agents/main/data/vectors.db \
  ".backup /home/lunar/.lunar/agents/main/data/vectors-backup.db"
```

---

## ✅ CHECKLIST

- [ ] Know what to back up (memory, sessions, vectors.db, config)
- [ ] Backup script creates timestamped archives
- [ ] Restore script restores from any backup
- [ ] Cron runs backup daily at 3 AM
- [ ] Old backups auto-deleted after 7 days
- [ ] SQLite backed up safely (not just file copy)
- [ ] Offsite backup configured (cloud storage)

---

## 💡 KEY TAKEAWAY

**Automate backups with cron — never rely on remembering. Use SQLite's backup API (not file copy) for database safety. Follow the 3-2-1 rule: 3 copies, 2 media types, 1 offsite. A working restore script is as important as the backup itself — test it!**

---

**Next → [Day 35: Production Deployment Checklist](day-35.md)**
