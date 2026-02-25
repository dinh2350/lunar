# Day 32 — Domain, HTTPS, and Reverse Proxy

> 🎯 **DAY GOAL:** Put Lunar behind a domain name with HTTPS — make it production-ready for the public internet

---

## 📚 CONCEPT 1: Reverse Proxy

### WHAT — Simple Definition

**A reverse proxy sits in front of your app, handling HTTPS, routing, and security. Users talk to the proxy; the proxy talks to your app.**

```
WITHOUT REVERSE PROXY:
  User → http://YOUR_IP:3100/api/chat
  ❌ No HTTPS (insecure)
  ❌ Ugly URL with port number
  ❌ No rate limiting
  ❌ No compression

WITH REVERSE PROXY (Caddy):
  User → https://lunar.yourdomain.com/api/chat
         │
    ┌────▼──────┐
    │   Caddy   │  ← Handles HTTPS, compression
    │  :80/:443 │     Auto-renews SSL certificates!
    └────┬──────┘
         │ http://gateway:3100
    ┌────▼──────┐
    │  Gateway  │  ← Your Lunar app
    │  :3100    │
    └───────────┘
```

### WHY — Why Not Just Expose Lunar Directly?

```
Direct exposure:
  ❌ No HTTPS (browsers warn, APIs reject)
  ❌ Need to manage SSL certificates manually
  ❌ No protection against abuse
  ❌ Single service per port

Reverse proxy:
  ✅ Automatic HTTPS with Let's Encrypt
  ✅ One port (443) for everything
  ✅ Rate limiting, compression, headers
  ✅ Multiple apps behind one IP
```

### 🔗 NODE.JS ANALOGY

```
Reverse proxy = Nginx/Caddy in front of Express/Fastify

Without:  User → Express:3000 (direct, no HTTPS)
With:     User → Nginx:443 → Express:3000 (HTTPS, cached, compressed)

Like how Vercel/Render puts their edge network in front of your app.
```

---

## 📚 CONCEPT 2: Why Caddy Over Nginx

### WHAT — Simple Definition

**Caddy is a modern reverse proxy that automatically handles HTTPS. Zero config for SSL — it just works.**

```
NGINX CONFIG (manual SSL):            CADDY CONFIG (automatic SSL):
  server {                             lunar.yourdomain.com {
    listen 443 ssl;                        reverse_proxy gateway:3100
    ssl_certificate /etc/ssl/...;      }
    ssl_certificate_key /etc/ssl/...;
    location / {                       That's it. 3 lines.
      proxy_pass http://gateway:3100;  Caddy automatically:
    }                                    → Gets SSL certificate
  }                                      → Renews before expiry
  # + certbot setup                      → Redirects HTTP→HTTPS
  # + cron job for renewal               → Adds security headers
  # + 30+ lines of config
```

---

## 🔨 HANDS-ON: Set Up Domain + HTTPS

### Step 1: Get a Domain ($0-10/year) (10 minutes)

```
OPTIONS:
  → Already have a domain? Add a subdomain (lunar.yourdomain.com)
  → New domain: Namecheap, Cloudflare ($8-12/year for .com)
  → Free subdomain: freedns.afraid.org, duckdns.org

DNS SETUP:
  Type: A
  Name: lunar (or @ for root domain)
  Value: YOUR_SERVER_IP
  TTL: 300 (5 minutes)

After setting DNS, verify:
  ping lunar.yourdomain.com
  # Should resolve to your server IP
```

### Step 2: Add Caddy to Docker Compose (20 minutes)

Update `docker-compose.prod.yml`:

```yaml
services:
  # ---- Reverse Proxy ----
  caddy:
    image: caddy:2-alpine
    container_name: lunar-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data          # SSL certificates
      - caddy-config:/config
    networks:
      - frontend
    restart: unless-stopped

  # ---- Gateway (no longer exposes ports to host!) ----
  gateway:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: lunar-gateway
    # ports: removed! Only Caddy can reach it
    environment:
      - LUNAR_PORT=3100
      - OLLAMA_URL=http://ollama:11434
    volumes:
      - lunar-data:/home/lunar/.lunar
    networks:
      - frontend
      - backend
    depends_on:
      ollama:
        condition: service_healthy
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    container_name: lunar-ollama
    volumes:
      - ollama-data:/root/.ollama
    networks:
      - backend
    deploy:
      resources:
        reservations:
          memory: 4G
    restart: unless-stopped

volumes:
  ollama-data:
  lunar-data:
  caddy-data:
  caddy-config:

networks:
  frontend:
  backend:
    internal: true
```

### Step 3: Create Caddyfile (10 minutes)

Create `Caddyfile`:

```
# Replace with your actual domain
lunar.yourdomain.com {
    # API endpoints
    reverse_proxy /api/* gateway:3100
    
    # WebSocket
    reverse_proxy /ws/* gateway:3100
    
    # Health check
    reverse_proxy /health gateway:3100
    
    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
    
    # Rate limiting (basic)
    rate_limit {
        zone api {
            key {remote_host}
            events 60
            window 1m
        }
    }
    
    # Compression
    encode gzip zstd
    
    # Logging
    log {
        output stdout
        format json
    }
}
```

### Step 4: Deploy with HTTPS (10 minutes)

```bash
# ON SERVER
cd /opt/lunar

# Copy updated files
# (from laptop): rsync -avz ... lunar:/opt/lunar/

# Start with Caddy
docker compose -f docker-compose.prod.yml up -d

# Watch Caddy get SSL certificate
docker compose logs -f caddy
# ... successfully obtained certificate ...

# Test!
curl https://lunar.yourdomain.com/api/health
# {"status":"ok","agent":"main","model":"qwen2.5:3b"}

# WebSocket works too:
# npx wscat -c wss://lunar.yourdomain.com/ws/chat
```

### Step 5: Verify HTTPS (5 minutes)

```bash
# Check SSL certificate
curl -vI https://lunar.yourdomain.com 2>&1 | grep -E "SSL|subject|expire"
#  SSL connection using TLSv1.3
#  subject: CN=lunar.yourdomain.com
#  expire date: May 26 2026

# HTTP → HTTPS redirect
curl -I http://lunar.yourdomain.com
# HTTP/1.1 308 Permanent Redirect
# Location: https://lunar.yourdomain.com
```

---

## ✅ CHECKLIST

- [ ] Domain pointing to server IP (DNS A record)
- [ ] Caddy added to Docker Compose
- [ ] Caddyfile with reverse proxy config
- [ ] HTTPS working (automatic SSL certificate)
- [ ] HTTP redirects to HTTPS
- [ ] Gateway not directly accessible (only through Caddy)
- [ ] Security headers set
- [ ] Can access `https://lunar.yourdomain.com/api/health`

---

## 💡 KEY TAKEAWAY

**Caddy makes HTTPS trivial: point a domain to your server, add 3 lines of config, and Caddy automatically gets and renews SSL certificates. Your app stays internal (no exposed ports), and Caddy handles security headers, compression, and rate limiting.**

---

**Next → [Day 33: Monitoring and Logging](day-33.md)**
