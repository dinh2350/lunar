# Day 78 — VPS Deployment

> 🎯 **DAY GOAL:** Deploy Lunar to a cheap VPS — setup server, deploy with Docker, configure domain + HTTPS

---

## 📚 CONCEPT: Cheapest Way to Deploy

```
VPS OPTIONS (with GPU for Ollama):
  Provider        GPU          RAM    Cost/mo
  ─────────────── ──────────── ────── ────────
  Hetzner         None         8GB    $5-10   ← Use cloud LLM
  Vast.ai         RTX 3060     16GB   $15-30  ← Cheapest GPU
  RunPod           RTX 3060    16GB   $20-40
  Lambda Cloud    A10          24GB   $50+

WITHOUT GPU (use Gemini/Groq free APIs):
  Hetzner CX22   2 vCPU, 4GB  $5/mo  ← Best value
  Oracle Cloud    4 ARM cores  24GB   FREE*   ← Free tier!
  
* Oracle Cloud free tier: ARM A1, 24GB RAM, 200GB storage
```

---

## 🔨 HANDS-ON: Deploy to VPS

### Step 1: Server Setup (15 minutes)

```bash
# SSH into your VPS
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose
apt install docker-compose-plugin -y

# Create deploy user
useradd -m -s /bin/bash lunar
usermod -aG docker lunar

# Setup firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 2: Deploy (10 minutes)

```bash
# On your local machine — push code
git push origin main

# On the server
su - lunar
git clone https://github.com/yourusername/lunar.git
cd lunar

# Configure
cp .env.example .env
nano .env  # Set your API keys, domain, etc.

# Deploy!
docker compose -f docker-compose.prod.yml up -d

# Pull Ollama model (if using GPU VPS)
docker compose exec ollama ollama pull llama3.2:3b

# Check status
docker compose ps
docker compose logs -f agent
```

### Step 3: Setup Domain (5 minutes)

```
DNS SETUP:
  1. Buy domain (Namecheap, Cloudflare — ~$10/year)
  2. Add A record: lunar.yourdomain.com → your-server-ip
  3. Caddy auto-provisions HTTPS certificate
  4. Done! Visit https://lunar.yourdomain.com
```

### Step 4: Auto-deploy Script (10 minutes)

Create `scripts/deploy.sh`:

```bash
#!/bin/bash
set -e

SERVER="lunar@your-server-ip"
APP_DIR="/home/lunar/lunar"

echo "🚀 Deploying Lunar..."

# Push latest code
git push origin main

# Deploy on server
ssh $SERVER << 'EOF'
  cd /home/lunar/lunar
  git pull origin main
  docker compose -f docker-compose.prod.yml build
  docker compose -f docker-compose.prod.yml up -d
  echo "✅ Deployed!"
  docker compose ps
EOF
```

---

## ✅ CHECKLIST

- [ ] VPS provisioned (cheapest option for your needs)
- [ ] Docker + Docker Compose installed
- [ ] Firewall configured (22, 80, 443)
- [ ] Code deployed and running
- [ ] Domain configured with DNS A record
- [ ] HTTPS working (Caddy auto-cert)
- [ ] Deploy script for quick updates

---

**Next → [Day 79: Security Hardening](day-79.md)**
