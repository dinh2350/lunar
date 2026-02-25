# Day 33 — Monitoring, Logging, and Alerting

> 🎯 **DAY GOAL:** Set up monitoring so you know when Lunar is down, slow, or running out of resources

---

## 📚 CONCEPT 1: The Three Pillars of Observability

### WHAT — Simple Definition

**Observability = understanding what your system is doing from the outside. Three pillars:**

```
1. LOGS — What happened? (events/messages)
   "2026-02-25 14:30:00 [INFO] User asked: What is RAG?"
   "2026-02-25 14:30:02 [INFO] tools_called: memory_search"
   "2026-02-25 14:30:05 [ERROR] Ollama timeout after 30s"

2. METRICS — How much? How fast? (numbers over time)
   → Requests per minute: 12
   → Average response time: 2.3s
   → Memory usage: 3.2GB / 4GB
   → LLM tokens per hour: 15,000

3. HEALTH CHECKS — Is it alive? (up/down status)
   → Gateway: ✅ UP (200 OK in 50ms)
   → Ollama: ✅ UP (200 OK in 30ms)
   → Eval: ❌ DOWN (connection refused)
```

### WHY — Why Monitor an AI Agent?

```
Without monitoring:
  ❌ Telegram bot stops responding → you don't know for hours
  ❌ Ollama runs out of memory → silent crashes
  ❌ Response times creep from 2s to 30s → users leave
  ❌ "Is it working?" → SSH in and check manually every time

With monitoring:
  ✅ Instant notification when something breaks
  ✅ See response time trends (is it getting slower?)
  ✅ Know exactly what failed and when
  ✅ In interviews: "I set up monitoring for my AI system"
```

### 🔗 NODE.JS ANALOGY

```
Logs     = console.log / winston / pino
Metrics  = prometheus client / StatsD
Health   = /health endpoint + uptime robot

Same stack you'd use for any Node.js service,
but with AI-specific metrics (tokens, latency, tool calls).
```

---

## 🔨 HANDS-ON: Build Monitoring for Lunar

### Step 1: Structured Logging (20 minutes)

Update `packages/shared/src/logger.ts`:

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

export function createLogger(service: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => emit('debug', service, msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => emit('info',  service, msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => emit('warn',  service, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => emit('error', service, msg, data),
  };
}

function emit(level: LogLevel, service: string, message: string, data?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...data,
  };

  // JSON for Docker, pretty for dev
  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const icon = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
    console.log(`${icon} [${service}] ${message}`, data ? JSON.stringify(data) : '');
  }
}
```

Usage in gateway:
```typescript
const log = createLogger('gateway');
log.info('Chat request', { sessionId: sid, messageLength: message.length });
log.info('LLM response', { tokens: response.tokens, durationMs: elapsed });
log.error('Ollama timeout', { model, timeoutMs: 30000 });
```

### Step 2: Metrics Endpoint (20 minutes)

Add to `packages/gateway/src/metrics.ts`:

```typescript
/**
 * Simple metrics collector — no external dependencies.
 * Exposes /api/metrics in Prometheus format.
 */

interface MetricData {
  requests: number;
  errors: number;
  totalLatencyMs: number;
  toolCalls: Record<string, number>;
  tokenCount: number;
  startTime: number;
}

const metrics: MetricData = {
  requests: 0,
  errors: 0,
  totalLatencyMs: 0,
  toolCalls: {},
  tokenCount: 0,
  startTime: Date.now(),
};

export function recordRequest(durationMs: number, error: boolean = false) {
  metrics.requests++;
  metrics.totalLatencyMs += durationMs;
  if (error) metrics.errors++;
}

export function recordToolCall(toolName: string) {
  metrics.toolCalls[toolName] = (metrics.toolCalls[toolName] || 0) + 1;
}

export function recordTokens(count: number) {
  metrics.tokenCount += count;
}

export function getMetrics(): string {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  const avgLatency = metrics.requests > 0
    ? metrics.totalLatencyMs / metrics.requests
    : 0;

  // Prometheus text format
  return [
    `# HELP lunar_requests_total Total chat requests`,
    `# TYPE lunar_requests_total counter`,
    `lunar_requests_total ${metrics.requests}`,
    ``,
    `# HELP lunar_errors_total Total errors`,
    `# TYPE lunar_errors_total counter`,
    `lunar_errors_total ${metrics.errors}`,
    ``,
    `# HELP lunar_avg_latency_ms Average response latency`,
    `# TYPE lunar_avg_latency_ms gauge`,
    `lunar_avg_latency_ms ${avgLatency.toFixed(2)}`,
    ``,
    `# HELP lunar_tokens_total Total tokens processed`,
    `# TYPE lunar_tokens_total counter`,
    `lunar_tokens_total ${metrics.tokenCount}`,
    ``,
    `# HELP lunar_uptime_seconds Server uptime`,
    `# TYPE lunar_uptime_seconds gauge`,
    `lunar_uptime_seconds ${uptime.toFixed(0)}`,
    ``,
    ...Object.entries(metrics.toolCalls).map(([tool, count]) =>
      `lunar_tool_calls{tool="${tool}"} ${count}`
    ),
  ].join('\n');
}

export function getMetricsJson() {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  return {
    requests: metrics.requests,
    errors: metrics.errors,
    avgLatencyMs: metrics.requests > 0 ? metrics.totalLatencyMs / metrics.requests : 0,
    tokenCount: metrics.tokenCount,
    toolCalls: metrics.toolCalls,
    uptimeSeconds: uptime,
  };
}
```

Add routes:
```typescript
// In gateway/src/index.ts
app.get('/api/metrics', async () => {
  return getMetricsJson();
});

app.get('/metrics', async (req, reply) => {
  reply.type('text/plain');
  return getMetrics(); // Prometheus format
});
```

### Step 3: Health Check Script (15 minutes)

Create `scripts/healthcheck.sh`:

```bash
#!/bin/bash
# Run every minute via cron. Sends alert if services are down.

SERVICES=(
  "Gateway|http://localhost:3100/api/health"
  "Ollama|http://localhost:11434/api/version"
)

ALERT_FILE="/tmp/lunar-alerts"

for service in "${SERVICES[@]}"; do
  name="${service%%|*}"
  url="${service##*|}"
  
  if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
    # Service is UP — clear any previous alert
    rm -f "${ALERT_FILE}-${name}" 2>/dev/null
  else
    # Service is DOWN
    if [ ! -f "${ALERT_FILE}-${name}" ]; then
      echo "$(date): ${name} is DOWN at ${url}" >> /var/log/lunar-alerts.log
      # Send notification (choose one):
      # curl -s "https://ntfy.sh/lunar-alerts" -d "${name} is DOWN!"
      # OR: mail -s "Lunar Alert" you@email.com <<< "${name} is DOWN"
      touch "${ALERT_FILE}-${name}"
    fi
  fi
done
```

```bash
# Install as cron job (runs every minute)
chmod +x scripts/healthcheck.sh
crontab -e
# Add: * * * * * /opt/lunar/scripts/healthcheck.sh
```

### Step 4: Free Uptime Monitoring (5 minutes)

Use a free external monitoring service:

```
Options (all have free tiers):
  → UptimeRobot (uptimerobot.com) — 50 free monitors
  → Betterstack (betterstack.com) — 10 free monitors
  → Freshping (freshping.io) — 50 free monitors

Setup:
  1. Create account
  2. Add monitor: https://lunar.yourdomain.com/api/health
  3. Check interval: 5 minutes
  4. Alert via: email, Slack, Telegram, webhook
```

---

## ✅ CHECKLIST

- [ ] Structured JSON logger created
- [ ] Logger used in gateway (requests, errors, tool calls)
- [ ] /api/metrics endpoint returns key metrics
- [ ] Health check script for local monitoring
- [ ] External uptime monitor configured (UptimeRobot)
- [ ] Alerts notify you when services go down
- [ ] Know the 3 pillars: logs, metrics, health checks

---

## 💡 KEY TAKEAWAY

**Monitoring isn't optional for production AI. Structured JSON logs make debugging easy. A /metrics endpoint tracks quality over time. Health checks + alerts ensure you know when something breaks before your users do. Free tools (UptimeRobot) work great for personal projects.**

---

**Next → [Day 34: Backup, Recovery, and Data Safety](day-34.md)**
