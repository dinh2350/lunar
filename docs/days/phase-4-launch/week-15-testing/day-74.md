# Day 74 — Monitoring + Observability

> 🎯 **DAY GOAL:** Build monitoring for Lunar — track LLM calls, token usage, latency, errors, and user activity in real-time

---

## 📚 CONCEPT: What to Monitor in AI Systems

```
MONITORING DASHBOARD:
┌──────────────────────────────────────────────────┐
│ 🌙 LUNAR METRICS                                 │
│                                                   │
│ LLM Calls (last 24h):  1,247                     │
│ Tokens Used:           347,892 (est. $0 local)   │
│ Avg Response Time:     2.3s                       │
│ Error Rate:            1.2%                       │
│ Active Users:          23                         │
│                                                   │
│ Latency (p50/p95/p99): 1.8s / 4.2s / 8.1s       │
│ Tool Calls:            483 (38.7% of requests)    │
│ Memory Hits:           891 (71.5% of requests)    │
│ Guard Blocks:          17 (1.4%)                  │
│ Cache Hit Rate:        34.2%                      │
└──────────────────────────────────────────────────┘
```

---

## 🔨 HANDS-ON: Build Metrics System

### Step 1: Metrics Collector (20 minutes)

Create `packages/agent/src/monitoring/metrics.ts`:

```typescript
interface MetricPoint {
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();
  private timeseries = new Map<string, MetricPoint[]>();

  // ─── Counters (things that only go up) ───

  increment(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + amount);
    this.timeseries.get(name)?.push({ value: amount, timestamp: Date.now(), labels }) 
      || this.timeseries.set(name, [{ value: amount, timestamp: Date.now(), labels }]);
  }

  // ─── Histograms (distribution of values) ───

  observe(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    // Keep last 1000 observations
    if (values.length > 1000) values.shift();
    this.histograms.set(name, values);
  }

  // ─── Gauges (current value) ───

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  // ─── Queries ───

  getCounter(name: string): number {
    let total = 0;
    for (const [key, val] of this.counters) {
      if (key.startsWith(name)) total += val;
    }
    return total;
  }

  getPercentiles(name: string): { p50: number; p95: number; p99: number; avg: number } {
    const values = [...(this.histograms.get(name) || [])].sort((a, b) => a - b);
    if (values.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0 };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      avg: Math.round(avg),
    };
  }

  // ─── Dashboard ───

  getSummary(): Record<string, any> {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        [...this.histograms.entries()].map(([k, v]) => [k, {
          count: v.length,
          ...this.getPercentiles(k),
        }])
      ),
    };
  }

  private key(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

// Singleton
export const metrics = new MetricsCollector();
```

### Step 2: Instrument Lunar (15 minutes)

```typescript
// Wrap LLM calls with metrics
import { metrics } from './monitoring/metrics.js';

async function instrumentedLLMCall(messages: any[], options: any) {
  const start = Date.now();
  metrics.increment('llm_calls_total', { model: options.model || 'default' });

  try {
    const result = await originalLLMCall(messages, options);

    const duration = Date.now() - start;
    metrics.observe('llm_latency_ms', duration);
    metrics.increment('llm_tokens_total', {}, result.tokensUsed || 0);

    return result;
  } catch (error) {
    metrics.increment('llm_errors_total', { type: error.constructor.name });
    throw error;
  }
}

// Wrap tool execution
async function instrumentedToolCall(name: string, args: any, tool: any) {
  const start = Date.now();
  metrics.increment('tool_calls_total', { tool: name });

  try {
    const result = await tool(args);
    metrics.observe('tool_latency_ms', Date.now() - start);
    return result;
  } catch (error) {
    metrics.increment('tool_errors_total', { tool: name });
    throw error;
  }
}

// Wrap guard pipeline
function instrumentedGuardCheck(input: string, guards: any) {
  const start = Date.now();
  const result = guards.check(input);
  metrics.observe('guard_latency_ms', Date.now() - start);
  if (result.blocked) {
    metrics.increment('guard_blocks_total', { reason: result.reason });
  }
  return result;
}
```

### Step 3: Metrics API Endpoint (10 minutes)

```typescript
// Add to Fastify server
import { metrics } from './monitoring/metrics.js';

fastify.get('/api/metrics', async () => {
  return metrics.getSummary();
});

fastify.get('/api/metrics/health', async () => {
  const latency = metrics.getPercentiles('llm_latency_ms');
  const errorRate = metrics.getCounter('llm_errors_total') / 
    Math.max(metrics.getCounter('llm_calls_total'), 1);

  return {
    status: errorRate < 0.05 ? 'healthy' : 'degraded',
    latency,
    errorRate: `${(errorRate * 100).toFixed(1)}%`,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
});
```

---

## ✅ CHECKLIST

- [ ] MetricsCollector with counters, histograms, gauges
- [ ] Percentile calculations (p50, p95, p99)
- [ ] LLM calls instrumented (latency, tokens, errors)
- [ ] Tool calls instrumented
- [ ] Guard pipeline instrumented
- [ ] Metrics API endpoint (/api/metrics)
- [ ] Health endpoint (/api/metrics/health)

---

## 💡 KEY TAKEAWAY

**You can't improve what you don't measure. Instrument everything: LLM calls (latency, tokens, errors), tool execution, guard blocks, memory hits, cache effectiveness. The four golden signals for AI agents: latency (how fast), error rate (how reliable), token usage (how expensive), and throughput (how many concurrent users). A simple in-memory metrics collector is enough to start — upgrade to Prometheus/Grafana when you scale.**

---

**Next → [Day 75: Documentation + Week 15 Wrap](day-75.md)**
