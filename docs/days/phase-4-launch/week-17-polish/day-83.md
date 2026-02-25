# Day 83 — Edge Cases + Resilience

> 🎯 **DAY GOAL:** Handle every weird thing users will throw at Lunar — empty messages, huge inputs, spam, concurrent requests

---

## 🔨 HANDS-ON: Edge Case Handling

### 1. Input Validation Layer

```typescript
interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
}

function validateInput(message: string): ValidationResult {
  // Empty / whitespace only
  if (!message?.trim()) {
    return { valid: false, error: "empty" };
  }
  
  // Too long (>10K chars)
  if (message.length > 10_000) {
    return {
      valid: true,
      sanitized: message.slice(0, 10_000) + "\n\n[Message truncated — too long]",
    };
  }
  
  // Too many lines (>500)
  const lines = message.split('\n');
  if (lines.length > 500) {
    return {
      valid: true,
      sanitized: lines.slice(0, 500).join('\n') + "\n\n[Truncated at 500 lines]",
    };
  }
  
  return { valid: true, sanitized: message.trim() };
}
```

### 2. Anti-Spam / Flood Control

```typescript
class FloodGuard {
  private timestamps = new Map<string, number[]>();
  
  check(userId: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const window = 60_000; // 1 minute
    const maxMessages = 20;
    
    const times = (this.timestamps.get(userId) || [])
      .filter(t => now - t < window);
    
    if (times.length >= maxMessages) {
      const oldest = times[0];
      return { allowed: false, retryAfter: Math.ceil((oldest + window - now) / 1000) };
    }
    
    times.push(now);
    this.timestamps.set(userId, times);
    return { allowed: true };
  }
}
```

### 3. Concurrent Request Handling

```typescript
class RequestQueue {
  private active = new Map<string, Promise<void>>();
  
  async enqueue(userId: string, handler: () => Promise<void>) {
    // Wait for user's previous request to finish
    const existing = this.active.get(userId);
    if (existing) {
      await existing;
    }
    
    const promise = handler().finally(() => {
      if (this.active.get(userId) === promise) {
        this.active.delete(userId);
      }
    });
    
    this.active.set(userId, promise);
    return promise;
  }
}
```

### 4. Timeout + Fallback

```typescript
async function handleWithTimeout(
  message: string,
  timeoutMs = 30_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await agent.handle(message, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return "I'm taking too long on this. Let me try a simpler answer...";
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

---

## ✅ CHECKLIST

- [ ] Empty message handling
- [ ] Long message truncation
- [ ] Flood control per user
- [ ] Request queue (no concurrent per user)
- [ ] Timeout with graceful fallback
- [ ] Handle invalid UTF-8 / special chars
- [ ] Graceful shutdown (finish active requests)

---

**Next → [Day 84: Accessibility + Help System](day-84.md)**
