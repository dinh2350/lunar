# Day 80 — Deployment Checklist + Week 16 Wrap

> 🎯 **DAY GOAL:** Final deployment checklist — verify everything works end-to-end in production

---

## 📋 Pre-Launch Deployment Checklist

### Infrastructure
- [ ] VPS provisioned and running
- [ ] Docker + Docker Compose installed
- [ ] Domain configured with DNS A record
- [ ] HTTPS certificate active (Caddy)
- [ ] Firewall allows only 22, 80, 443

### Application
- [ ] All environment variables configured
- [ ] Secrets never in source code
- [ ] Database initialized and migrated
- [ ] Ollama model pulled (or cloud API keys set)
- [ ] All channels configured (Telegram, Discord, etc.)

### Security
- [ ] Rate limiting active
- [ ] CORS configured
- [ ] API authentication enabled
- [ ] Docker runs as non-root
- [ ] Input validation on all endpoints
- [ ] Guard pipeline active (injection, PII, etc.)

### Monitoring
- [ ] Health endpoint returns OK
- [ ] Metrics collecting (LLM calls, latency, errors)
- [ ] Logs accessible via `docker compose logs`
- [ ] Error alerting configured (even simple email/webhook)

### Backup
- [ ] Automated daily backup script
- [ ] Backup rotation (keep 7 days)
- [ ] Recovery tested at least once

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E conversation test passing
- [ ] Eval score above quality gate

---

## 📋 Week 16 Summary

| Day | Topic | Key Output |
|-----|-------|------------|
| 76 | Production Docker | Multi-stage build, Compose, Caddy |
| 77 | Backup + Recovery | Automated backup, rotation, scaling |
| 78 | VPS Deployment | Server setup, deploy script, domain |
| 79 | Security Hardening | Rate limit, CORS, auth, headers |
| 80 | Deployment Checklist | Complete go-live verification |

---

**Next → [Week 17: Polish + UX](../week-17-polish/day-81.md)**
