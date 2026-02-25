# Day 73 — Performance Optimization

> 🎯 **DAY GOAL:** Profile Lunar's bottlenecks and optimize: response latency, memory usage, concurrent requests, caching

---

## 📚 CONCEPT 1: Where AI Agents Are Slow

```
LUNAR RESPONSE TIMELINE (before optimization):
  User message arrives                    0ms
  ├─ Guard pipeline                      5ms
  ├─ Memory search (vector + BM25)      50ms   ← Can cache
  ├─ Build prompt                       10ms
  ├─ LLM call (Ollama local)        2,000ms   ← BOTTLENECK #1
  ├─ Parse tool calls                    5ms
  ├─ Execute tools                    500ms   ← BOTTLENECK #2
  ├─ Second LLM call               1,500ms   ← BOTTLENECK #3
  ├─ Output guards                      5ms
  └─ Send response                      5ms
  Total:                            ~4,100ms

AFTER OPTIMIZATION:
  ├─ Guard pipeline                      5ms
  ├─ Memory search (cached)            10ms   ← 5x faster
  ├─ LLM call (streaming first token) 300ms   ← User sees response starting
  ├─ Tool execution (parallel)        300ms   ← 2x faster
  ├─ Second LLM call (streaming)      200ms
  Total first token:                  ~815ms   ← 5x improvement!
```

---

## 🔨 HANDS-ON: Optimize Lunar

### Step 1: LLM Response Cache (15 minutes)

Create `packages/agent/src/cache/llm-cache.ts`:

```typescript
import { createHash } from 'crypto';

interface CacheEntry {
  response: string;
  timestamp: number;
  hits: number;
}

export class LLMCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(options: { maxSize?: number; ttlMs?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes
  }

  private hash(messages: any[], options: any): string {
    const key = JSON.stringify({ messages, options });
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  get(messages: any[], options: any): string | null {
    const key = this.hash(messages, options);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.response;
  }

  set(messages: any[], options: any, response: string): void {
    // Evict oldest if full
    if (this.cache.size >= this.maxSize) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(this.hash(messages, options), {
      response,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  stats(): { size: number; hitRate: string } {
    const entries = [...this.cache.values()];
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    return {
      size: this.cache.size,
      hitRate: entries.length ? `${((totalHits / (totalHits + entries.length)) * 100).toFixed(1)}%` : '0%',
    };
  }
}
```

### Step 2: Parallel Tool Execution (15 minutes)

```typescript
/**
 * Execute multiple independent tool calls in parallel
 */
async function executeToolsParallel(
  toolCalls: Array<{ name: string; args: any }>,
  tools: Record<string, (args: any) => Promise<any>>,
  options: { timeout?: number } = {},
): Promise<Array<{ name: string; result: string; error?: string; durationMs: number }>> {
  const timeout = options.timeout || 10_000;

  const promises = toolCalls.map(async (call) => {
    const start = Date.now();
    try {
      const result = await Promise.race([
        tools[call.name](call.args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tool timeout')), timeout)
        ),
      ]);
      return {
        name: call.name,
        result: String(result),
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        name: call.name,
        result: '',
        error: error.message,
        durationMs: Date.now() - start,
      };
    }
  });

  return Promise.all(promises);
}
```

### Step 3: Memory Search Cache (15 minutes)

```typescript
/**
 * Cache frequent memory searches (same query within TTL)
 */
class MemorySearchCache {
  private cache = new Map<string, { results: any[]; timestamp: number }>();
  private ttlMs = 30_000; // 30 seconds

  async search(
    query: string,
    searchFn: (q: string) => Promise<any[]>,
  ): Promise<any[]> {
    const key = query.toLowerCase().trim();
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached.results;
    }

    const results = await searchFn(query);
    this.cache.set(key, { results, timestamp: Date.now() });
    return results;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
```

### Step 4: Connection Pooling for Ollama (10 minutes)

```typescript
import { Agent } from 'http';

// Reuse HTTP connections to Ollama
const ollamaAgent = new Agent({
  keepAlive: true,
  maxSockets: 4,       // Max concurrent requests
  maxFreeSockets: 2,   // Keep 2 connections warm
  timeout: 60_000,
});

// Use in fetch calls
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'llama3.2:3b', prompt }),
  // @ts-ignore — Node.js fetch supports agent
  agent: ollamaAgent,
});
```

### Step 5: Streaming First Token (10 minutes)

```typescript
/**
 * Stream response to user as soon as first token arrives
 * Don't wait for complete response!
 */
async function* streamResponse(
  prompt: string,
  model: string,
): AsyncGenerator<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n').filter(Boolean)) {
      const data = JSON.parse(line);
      if (data.response) {
        yield data.response;  // Send each token immediately
      }
    }
  }
}
```

---

## ✅ CHECKLIST

- [ ] LLM response cache (identical prompts served instantly)
- [ ] Parallel tool execution (2x+ faster for multiple tools)
- [ ] Memory search cache (30s TTL)
- [ ] HTTP connection pooling for Ollama
- [ ] Streaming response (first token in <500ms)
- [ ] Understand the bottleneck hierarchy: LLM > tools > memory > guards

---

## 💡 KEY TAKEAWAY

**The #1 performance optimization for AI agents is streaming. Users perceive a response starting in 300ms as fast, even if the full response takes 3 seconds. Beyond streaming: cache identical LLM calls, run tools in parallel, cache memory searches, and pool HTTP connections. Profile first — measure actual latency per component — then optimize the biggest bottleneck.**

---

**Next → [Day 74: Monitoring + Observability](day-74.md)**
