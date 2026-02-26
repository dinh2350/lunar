# Lunar Scaling Guide

## Scaling Strategy

| Users | Strategy | LLM | Estimated Cost |
|-------|----------|-----|----------------|
| 1-10 | Single VPS, local Ollama | Ollama (local) | $5-10/mo |
| 10-50 | Single VPS, cloud LLM | Gemini/Groq free tier | $5-10/mo |
| 50-200 | Bigger VPS, caching, pooling | Cloud LLM | $20-50/mo |
| 200+ | Split services, read replicas | Dedicated LLM server | $50+/mo |

## VPS Options

### With GPU (for local Ollama)
| Provider | GPU | RAM | Cost/mo |
|----------|-----|-----|---------|
| Vast.ai | RTX 3060 | 16GB | $15-30 |
| RunPod | RTX 3060 | 16GB | $20-40 |
| Lambda Cloud | A10 | 24GB | $50+ |

### Without GPU (use free cloud APIs)
| Provider | Specs | Cost/mo |
|----------|-------|---------|
| Hetzner CX22 | 2 vCPU, 4GB | $5 |
| Oracle Cloud | 4 ARM, 24GB | FREE |
| DigitalOcean | 2 vCPU, 4GB | $12 |

## Optimization Checklist

- [ ] Enable LLM response cache (identical prompts)
- [ ] Enable parallel tool execution
- [ ] Enable memory search cache (30s TTL)
- [ ] Use HTTP connection pooling for Ollama
- [ ] Stream responses (first token < 500ms)
- [ ] Set up connection limits per user
- [ ] Monitor with metrics endpoint

## Recovery

```bash
# Restore from backup
tar -xzf /backups/lunar/lunar-backup-YYYYMMDD_HHMMSS.tar.gz -C /
docker compose -f docker-compose.prod.yml restart
```
