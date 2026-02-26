#!/bin/bash
# Lunar VPS Setup Script
# Run on a fresh Ubuntu 22.04+ VPS as root
set -euo pipefail

echo "🌙 Lunar VPS Setup"

# 1. Update system
echo "  📦 Updating system..."
apt update && apt upgrade -y

# 2. Install Docker
echo "  🐳 Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
fi

# 3. Install Docker Compose plugin
apt install -y docker-compose-plugin

# 4. Create deploy user
echo "  👤 Creating lunar user..."
if ! id "lunar" &>/dev/null; then
  useradd -m -s /bin/bash lunar
  usermod -aG docker lunar
fi

# 5. Setup firewall
echo "  🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 6. Setup backup cron
echo "  ⏰ Setting up daily backup..."
(crontab -l 2>/dev/null; echo "0 3 * * * /home/lunar/lunar/scripts/backup.sh >> /var/log/lunar-backup.log 2>&1") | sort -u | crontab -

echo "✅ VPS setup complete!"
echo "   Next: su - lunar && git clone your-repo && cd lunar && docker compose -f docker-compose.prod.yml up -d"
