# Day 31 — Cloud Fundamentals for AI Engineers

> 🎯 **DAY GOAL:** Understand cloud architecture by mapping to concepts you already know — enough to deploy Lunar to a VPS

---

## 📚 CONCEPT 1: Cloud = Someone Else's Computers

### WHAT — Simple Definition

**Cloud computing is renting computers over the internet instead of buying your own. You pick the CPU, RAM, disk size, and location — then run Docker on it.**

```
LOCAL DEVELOPMENT:                    CLOUD DEPLOYMENT:
  Your MacBook                         Rented Server (VPS)
  ├── Ollama (LLM)                     ├── Ollama (same)
  ├── Lunar Gateway                    ├── Lunar Gateway (same)
  └── SQLite (vectors)                 └── SQLite (same)
  
  Access: localhost:3100               Access: https://lunar.yourdomain.com
  Users: just you                      Users: anyone on the internet
  Uptime: when laptop is open          Uptime: 24/7
  Cost: $0                             Cost: $5-20/month
```

### WHY — Why Cloud for AI?

```
LOCAL ONLY:
  ✅ Free
  ✅ Private
  ❌ Only works when your laptop is on
  ❌ Telegram bot dies when you close laptop
  ❌ Can't demo to employers
  ❌ No GPU for larger models

CLOUD:
  ✅ 24/7 availability (Telegram bot always running)
  ✅ Public URL for demos and portfolio
  ✅ GPU options for bigger models
  ✅ Resume material: "I deployed AI to production"
  ❌ Costs money ($5-20/month for VPS)
```

### WHEN — Budget-Conscious Approach

```
Days 1-30:  LOCAL ONLY ($0)
  → Build everything on your laptop
  → Free Ollama + SQLite

Days 31-35: LEARN CLOUD ($0-10)
  → Deploy to a cheap VPS
  → Use free tiers where possible
  → If >$10, shut it down and keep the knowledge

After 100 days: DECIDE
  → Keep running on VPS ($5/month) for portfolio
  → OR keep local-only (still impressive)
```

---

## 📚 CONCEPT 2: Cloud Options Comparison

### VPS (Virtual Private Server) — Recommended for Lunar

```
A VPS = a virtual computer in a data center. You get root access.

PROVIDERS (cheapest first):
  ┌──────────────┬──────────┬──────────────────────────────────┐
  │ Provider     │ Price    │ What you get                     │
  ├──────────────┼──────────┼──────────────────────────────────┤
  │ Hetzner      │ $4/mo    │ 2 vCPU, 4GB RAM, 40GB SSD       │
  │ DigitalOcean │ $6/mo    │ 1 vCPU, 2GB RAM, 50GB SSD       │
  │ Linode       │ $5/mo    │ 1 vCPU, 2GB RAM, 50GB SSD       │
  │ AWS Lightsail│ $5/mo    │ 1 vCPU, 1GB RAM, 40GB SSD       │
  │ Oracle Cloud │ $0 (free)│ 4 vCPU, 24GB RAM (ARM, limited) │
  └──────────────┴──────────┴──────────────────────────────────┘

FOR LUNAR:
  Minimum: 2 vCPU, 4GB RAM (for Ollama with small models)
  Recommended: 4 vCPU, 8GB RAM (comfortable for 7B models)
  With GPU: $0.50-1/hour (for bigger models, rent only when needed)
```

### Cloud Platform vs VPS

```
VPS (Recommended for learning):
  ✅ Simple: SSH in, run docker compose up
  ✅ Cheap: $4-10/month
  ✅ Full control: root access
  ✅ Transferable skill: works with any provider
  ❌ You manage updates, security

Cloud Platform (AWS/GCP/Azure):
  ✅ Auto-scaling, managed services
  ✅ Free tier (first year)
  ❌ Complex: 100+ services to learn
  ❌ Billing surprises ($$$)
  ❌ Vendor lock-in
  
START WITH VPS → learn cloud platforms later
```

### 🔗 NODE.JS ANALOGY

```
VPS = your own Node.js server
  → SSH in, install Node, run your app
  → Full control, simple, cheap

Cloud Platform = Vercel/Railway/Render
  → Push code, auto-deploy
  → Less control, more expensive, more features

Docker + VPS = the sweet spot
  → Same docker compose on your laptop AND the server
  → No vendor lock-in (move to any VPS)
```

---

## 🔨 HANDS-ON: Set Up a VPS

### Step 1: Create VPS Account (10 minutes)

Pick one (Hetzner recommended for price):

```
Hetzner Cloud: https://console.hetzner.cloud
  → Sign up → Create project "lunar"
  → Add SSH key (see below)
  → Create CX22 server ($4/mo): 2 vCPU, 4GB RAM, Ubuntu 24.04
```

### Step 2: SSH Key Setup (10 minutes)

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "lunar-deploy"
# Save to: ~/.ssh/lunar_deploy

# Show public key (copy this to your VPS provider)
cat ~/.ssh/lunar_deploy.pub

# Add to SSH config for convenience
cat >> ~/.ssh/config << 'EOF'
Host lunar
    HostName YOUR_SERVER_IP
    User root
    IdentityFile ~/.ssh/lunar_deploy
EOF

# Connect!
ssh lunar
# Welcome to Ubuntu 24.04 ...
```

### Step 3: Server Initial Setup (20 minutes)

```bash
# ON THE SERVER (ssh lunar)

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version

# Create non-root user
useradd -m -s /bin/bash lunar
usermod -aG docker lunar  # allow docker without sudo

# Set up firewall
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw enable

# Create project directory
mkdir -p /opt/lunar
chown lunar:lunar /opt/lunar
```

### Step 4: Deploy Lunar to VPS (15 minutes)

```bash
# ON YOUR LAPTOP — copy files to server

# Option A: rsync (fast, incremental)
rsync -avz --exclude node_modules --exclude .git \
  ~/Documents/project/lunar/ lunar:/opt/lunar/

# Option B: git (if repo is on GitHub)
# ON SERVER:
# git clone https://github.com/youruser/lunar.git /opt/lunar

# ON SERVER — start Lunar
ssh lunar
cd /opt/lunar

# Create .env file
cat > .env << 'EOF'
LUNAR_PORT=3100
LUNAR_AGENT=main
LUNAR_MODEL=qwen2.5:3b
OLLAMA_URL=http://ollama:11434
EOF

# Start with Docker Compose
docker compose up -d

# Watch logs
docker compose logs -f

# Wait for model download (first time only, ~2GB)
# Then test:
curl http://localhost:3100/api/health
```

---

## ✅ CHECKLIST

- [ ] Understand VPS vs cloud platform (and why VPS first)
- [ ] SSH key generated and added to VPS provider
- [ ] Server created with Docker installed
- [ ] Firewall configured (SSH + HTTP + HTTPS)
- [ ] Lunar files deployed to server
- [ ] `docker compose up` runs Lunar on VPS
- [ ] Health check works from server

---

## 💡 KEY TAKEAWAY

**A VPS is just a computer in a data center. SSH in, install Docker, run docker compose up — same as local. Start with a $4-10/month server (Hetzner/DigitalOcean). Docker makes "deploy to cloud" identical to "run locally." No complex cloud platform needed.**

---

**Next → [Day 32: Domain, HTTPS, and Reverse Proxy](day-32.md)**
