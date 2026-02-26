# Lunar Pre-Launch Deployment Checklist

## Infrastructure
- [ ] VPS provisioned and running
- [ ] Docker + Docker Compose installed
- [ ] Domain configured with DNS A record
- [ ] HTTPS certificate active (Caddy)
- [ ] Firewall allows only 22, 80, 443

## Application
- [ ] All environment variables configured
- [ ] Secrets never in source code
- [ ] Database initialized
- [ ] Ollama model pulled (or cloud API keys set)
- [ ] All channels configured (Telegram, Discord, etc.)

## Security
- [ ] Rate limiting active
- [ ] CORS configured
- [ ] API authentication enabled in production
- [ ] Docker runs as non-root user
- [ ] Input validation on all endpoints
- [ ] Guard pipeline active (injection, PII, etc.)
- [ ] Security headers configured

## Monitoring
- [ ] Health endpoint returns OK (`/api/metrics/health`)
- [ ] Metrics collecting (LLM calls, latency, errors)
- [ ] Logs accessible via `docker compose logs`
- [ ] Error alerting configured

## Backup
- [ ] Automated daily backup script (cron)
- [ ] Backup rotation (keep 7 days)
- [ ] Recovery tested at least once

## Testing
- [ ] Unit tests passing (`pnpm test`)
- [ ] Integration tests passing
- [ ] E2E conversation test passing
- [ ] Eval score above quality gate

## Quick Commands

```bash
# Deploy
./scripts/deploy.sh

# Check health
curl https://lunar.yourdomain.com/api/metrics/health

# View logs
ssh lunar@server "cd lunar && docker compose -f docker-compose.prod.yml logs -f"

# Manual backup
ssh lunar@server "cd lunar && ./scripts/backup.sh"

# Restore from backup
ssh lunar@server "cd lunar && ./scripts/restore.sh /backups/lunar/latest.tar.gz"
```
