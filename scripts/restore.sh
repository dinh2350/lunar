#!/bin/bash
# Lunar Restore Script — restore from backup
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/lunar/backups}"

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
