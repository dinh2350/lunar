#!/bin/bash
# Lunar Backup Script — run daily via cron
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/lunar/backups}"
DATA_DIR="${DATA_DIR:-/home/lunar/.lunar}"
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
  "${DATA_DIR#/}" \
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
