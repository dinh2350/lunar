#!/bin/bash
# Deploy Lunar to a VPS server via rsync + Docker Compose
# Usage: ./scripts/deploy.sh [server]
set -e

SERVER="${1:-lunar}"  # SSH host alias (default: "lunar")
REMOTE_DIR="/opt/lunar"

echo "🌙 Deploying Lunar to ${SERVER}:${REMOTE_DIR}"
echo "================================================"

# Step 1: Sync files to server
echo "📦 Syncing files..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude services/eval/.venv \
  --exclude "*.log" \
  --exclude .env \
  ./ "${SERVER}:${REMOTE_DIR}/"

# Step 2: Build and restart on server
echo "🔨 Building and restarting on server..."
ssh "${SERVER}" << 'REMOTE'
  cd /opt/lunar
  
  # Build images
  docker compose -f docker-compose.prod.yml build
  
  # Restart services
  docker compose -f docker-compose.prod.yml down
  docker compose -f docker-compose.prod.yml up -d
  
  # Wait for health
  echo "Waiting for services to start..."
  sleep 15
  
  # Health check
  echo "Health check:"
  curl -s http://localhost:3100/api/health || echo "Gateway: FAILED"
  
  echo ""
  echo "🌙 Deployment complete!"
  docker compose -f docker-compose.prod.yml ps
REMOTE

echo "================================================"
echo "✅ Deployment finished!"
echo "   Server: ${SERVER}"
echo "   Gateway: http://${SERVER}:3100"
