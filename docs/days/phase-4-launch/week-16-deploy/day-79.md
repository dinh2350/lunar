# Day 79 — Security Hardening

> 🎯 **DAY GOAL:** Harden Lunar for production — secrets management, rate limiting, CORS, and security headers

---

## 🔨 HANDS-ON: Security Checklist

### Step 1: Environment Variables + Secrets

```typescript
// packages/agent/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // LLM
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  
  // Database
  DATABASE_PATH: z.string().default('./data/lunar.db'),
  
  // Channels
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  
  // Security
  API_SECRET: z.string().min(32, 'API_SECRET must be at least 32 chars'),
  RATE_LIMIT_RPM: z.coerce.number().default(60),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export const config = envSchema.parse(process.env);
```

### Step 2: Rate Limiting

```typescript
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

const app = Fastify();

await app.register(rateLimit, {
  max: 60,          // 60 requests
  timeWindow: 60000, // per minute
  keyGenerator: (req) => req.headers['x-user-id'] as string || req.ip,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Please slow down. Try again in a minute.',
  }),
});
```

### Step 3: CORS + Security Headers

```typescript
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

await app.register(cors, {
  origin: config.CORS_ORIGINS.split(','),
  methods: ['GET', 'POST'],
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
});
```

### Step 4: API Authentication

```typescript
// Simple API key auth for external access
app.addHook('onRequest', async (request, reply) => {
  // Skip auth for health check
  if (request.url === '/api/metrics/health') return;
  
  // Skip in development
  if (config.NODE_ENV === 'development') return;
  
  const apiKey = request.headers['x-api-key'] || 
    request.headers.authorization?.replace('Bearer ', '');
  
  if (apiKey !== config.API_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});
```

---

## ✅ SECURITY CHECKLIST

- [ ] All secrets in environment variables (never in code)
- [ ] .env validated with Zod schema at startup
- [ ] Rate limiting configured (60 RPM default)
- [ ] CORS restricted to known origins
- [ ] Security headers via Helmet
- [ ] API authentication for production
- [ ] HTTPS enforced (Caddy handles this)
- [ ] Docker runs as non-root user
- [ ] SQLite file permissions restricted
- [ ] Input validation on all endpoints

---

**Next → [Day 80: Week 16 Wrap + Deployment Checklist](day-80.md)**
