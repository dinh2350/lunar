# Day 59 — Error Recovery + Fallbacks

> 🎯 **DAY GOAL:** Build resilient sub-agent execution — retries, fallback agents, timeout handling, and graceful degradation

---

## 📚 CONCEPT 1: When Sub-Agents Fail

### WHAT — Simple Definition

**Sub-agents fail. LLMs hallucinate, APIs timeout, tools crash. Error recovery means your system keeps working when individual agents break — through retries, fallback agents, and graceful degradation.**

```
FAILURE TYPES:
┌────────────────────────────────────────────┐
│ 1. TIMEOUT    — Agent took too long        │
│ 2. LLM ERROR  — API rate limit / down      │
│ 3. BAD OUTPUT — Hallucination, wrong format │
│ 4. TOOL FAIL  — Tool call crashed           │
│ 5. LOOP       — Agent stuck in a loop       │
└────────────────────────────────────────────┘

RECOVERY STRATEGIES:
┌─────────────────────────────────────────────┐
│ RETRY      → Same agent, same task          │
│ RETRY+HINT → Same agent, add error context  │
│ FALLBACK   → Different agent, same task     │
│ SIMPLIFY   → Break task into smaller parts  │
│ DEGRADE    → Return partial / "I don't know"│
└─────────────────────────────────────────────┘
```

### WHY — Users Don't Care About Agent Internals

```
WITHOUT RECOVERY:
  User: "Summarize yesterday's conversation"
  Researcher: [timeout after 30s]
  System: "Error: Agent timeout" ← BAD UX
  
WITH RECOVERY:
  User: "Summarize yesterday's conversation"
  Researcher: [timeout after 30s]
  System: [retry with smaller context window]
  Researcher: [success!]
  User gets their summary ← GOOD UX
```

### 🔗 NODE.JS ANALOGY

```javascript
// Like circuit breakers + retries in microservices
const response = await retry(
  () => fetch('http://service-a/data'),
  {
    retries: 3,
    onFailure: () => fetch('http://service-b/data'),  // fallback
  }
);

// Sub-agent recovery is the same pattern!
```

---

## 🔨 HANDS-ON: Build Recovery System

### Step 1: Retry with Backoff (15 minutes)

Create `packages/agent/src/sub-agents/recovery.ts`:

```typescript
import type { AgentMessage, AgentResult } from './protocol.js';
import type { SpecialistAgent } from './specialist.js';
import { createTaskMessage } from './protocol.js';

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;        // Initial backoff
  backoffMultiplier: number; // Multiply backoff each retry
  retryableStatuses: string[];
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 2,
  backoffMs: 1000,
  backoffMultiplier: 2,
  retryableStatuses: ['error', 'timeout'],
};

/**
 * Execute a specialist with automatic retry + backoff
 */
export async function executeWithRetry(
  agent: SpecialistAgent,
  message: AgentMessage,
  config: Partial<RetryConfig> = {},
): Promise<AgentResult> {
  const cfg = { ...DEFAULT_RETRY, ...config };
  let lastResult: AgentResult | null = null;
  let backoff = cfg.backoffMs;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    // On retry, add error context to help agent self-correct
    const msg = attempt === 0
      ? message
      : addRetryContext(message, lastResult!, attempt);

    lastResult = await agent.execute(msg);

    // Success — return immediately
    if (lastResult.status === 'success' || lastResult.status === 'partial') {
      return lastResult;
    }

    // Non-retryable error
    if (!cfg.retryableStatuses.includes(lastResult.status)) {
      return lastResult;
    }

    // Wait before retry (except on last attempt)
    if (attempt < cfg.maxRetries) {
      await sleep(backoff);
      backoff *= cfg.backoffMultiplier;
    }
  }

  return lastResult!;
}

/**
 * Add the error from previous attempt to help agent self-correct
 */
function addRetryContext(
  original: AgentMessage,
  previousResult: AgentResult,
  attempt: number,
): AgentMessage {
  const payload = original.payload as any;
  return createTaskMessage(original.from, original.to, payload.instruction, {
    context: [
      ...payload.context,
      {
        type: 'previous_result' as const,
        content: `PREVIOUS ATTEMPT #${attempt} FAILED: ${previousResult.error || previousResult.output}\n\nPlease try a different approach.`,
        source: 'retry_system',
        relevance: 1.0,
      },
    ],
    constraints: payload.constraints,
    traceId: original.traceId,
    parentId: original.id,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Step 2: Fallback Chain (20 minutes)

Add to `recovery.ts`:

```typescript
export interface FallbackConfig {
  primary: SpecialistAgent;
  fallbacks: SpecialistAgent[];
  retryPerAgent: number;
}

/**
 * Try primary agent, then fall through to alternatives
 *
 * FLOW:
 *   primary (retry 2x) → fallback[0] (retry 2x) → fallback[1] → degrade
 */
export async function executeWithFallback(
  message: AgentMessage,
  config: FallbackConfig,
): Promise<AgentResult & { handledBy: string }> {
  const agents = [config.primary, ...config.fallbacks];

  for (const agent of agents) {
    // Update message target
    const agentMessage = {
      ...message,
      to: agent.name,
    };

    const result = await executeWithRetry(agent, agentMessage, {
      maxRetries: config.retryPerAgent,
    });

    if (result.status === 'success' || result.status === 'partial') {
      return { ...result, handledBy: agent.name };
    }

    console.warn(`Agent "${agent.name}" failed, trying next fallback...`);
  }

  // All agents failed — graceful degradation
  return {
    id: crypto.randomUUID(),
    messageId: message.id,
    from: 'recovery_system',
    traceId: message.traceId,
    status: 'error',
    output: "I'm having trouble processing this request. Let me try a simpler approach.",
    toolsUsed: [],
    tokensUsed: 0,
    durationMs: 0,
    confidence: 0,
    error: 'All agents failed',
    handledBy: 'none',
  };
}
```

### Step 3: Circuit Breaker (15 minutes)

Add to `recovery.ts`:

```typescript
/**
 * Tracks agent health — disables agents that keep failing
 *
 * STATES:
 *   CLOSED  → Agent works normally
 *   OPEN    → Agent is disabled (too many failures)
 *   HALF    → Testing if agent recovered
 *
 *   CLOSED ──(failures > threshold)──▶ OPEN
 *   OPEN ──(cooldown elapsed)──▶ HALF-OPEN
 *   HALF-OPEN ──(success)──▶ CLOSED
 *   HALF-OPEN ──(failure)──▶ OPEN
 */
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private lastFailure = 0;
  private threshold: number;
  private cooldownMs: number;

  constructor(threshold = 3, cooldownMs = 60_000) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
  }

  get isAvailable(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      // Check if cooldown has elapsed
      if (Date.now() - this.lastFailure > this.cooldownMs) {
        this.state = 'half-open';
        return true;  // Allow one test request
      }
      return false;
    }
    return true; // half-open allows one request
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getStatus(): { state: string; failures: number } {
    return { state: this.state, failures: this.failures };
  }
}

/**
 * Agent registry with circuit breakers
 */
export class ResilientAgentPool {
  private agents = new Map<string, {
    agent: SpecialistAgent;
    breaker: CircuitBreaker;
  }>();

  register(agent: SpecialistAgent, breakerConfig?: { threshold?: number; cooldownMs?: number }): void {
    this.agents.set(agent.name, {
      agent,
      breaker: new CircuitBreaker(breakerConfig?.threshold, breakerConfig?.cooldownMs),
    });
  }

  /**
   * Get available agents (skip those with open circuit breakers)
   */
  getAvailable(names: string[]): SpecialistAgent[] {
    return names
      .map(name => this.agents.get(name))
      .filter(entry => entry && entry.breaker.isAvailable)
      .map(entry => entry!.agent);
  }

  /**
   * Execute with circuit breaker tracking
   */
  async execute(agentName: string, message: AgentMessage): Promise<AgentResult> {
    const entry = this.agents.get(agentName);
    if (!entry) throw new Error(`Agent "${agentName}" not registered`);

    if (!entry.breaker.isAvailable) {
      throw new Error(`Agent "${agentName}" circuit is OPEN — temporarily disabled`);
    }

    const result = await entry.agent.execute(message);

    if (result.status === 'success' || result.status === 'partial') {
      entry.breaker.recordSuccess();
    } else {
      entry.breaker.recordFailure();
    }

    return result;
  }

  /**
   * Health dashboard
   */
  getHealth(): Record<string, { state: string; failures: number }> {
    const health: Record<string, any> = {};
    for (const [name, entry] of this.agents) {
      health[name] = entry.breaker.getStatus();
    }
    return health;
  }
}
```

### Step 4: Output Validation (10 minutes)

Add to `recovery.ts`:

```typescript
export interface OutputValidator {
  name: string;
  validate: (output: string, instruction: string) => {
    valid: boolean;
    reason?: string;
  };
}

// Common validators
export const validators: Record<string, OutputValidator> = {
  notEmpty: {
    name: 'notEmpty',
    validate: (output) => ({
      valid: output.trim().length > 0,
      reason: 'Output is empty',
    }),
  },

  noRefusal: {
    name: 'noRefusal',
    validate: (output) => {
      const refusals = ["I can't", "I cannot", "I'm unable", "As an AI"];
      const refused = refusals.some(r => output.includes(r));
      return { valid: !refused, reason: 'Agent refused the task' };
    },
  },

  minLength: {
    name: 'minLength',
    validate: (output) => ({
      valid: output.length >= 100,
      reason: 'Output too short (< 100 chars)',
    }),
  },

  isJSON: {
    name: 'isJSON',
    validate: (output) => {
      try {
        JSON.parse(output);
        return { valid: true };
      } catch {
        return { valid: false, reason: 'Output is not valid JSON' };
      }
    },
  },
};

/**
 * Validate agent output — retry with feedback if invalid
 */
export async function executeWithValidation(
  agent: SpecialistAgent,
  message: AgentMessage,
  validatorList: OutputValidator[],
  maxRetries = 2,
): Promise<AgentResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await agent.execute(message);

    if (result.status !== 'success') return result;

    // Run validators
    const failures = validatorList
      .map(v => ({ name: v.name, ...v.validate(result.output, (message.payload as any).instruction) }))
      .filter(r => !r.valid);

    if (failures.length === 0) return result; // All validators passed

    // Add validation feedback and retry
    const feedback = failures.map(f => `- ${f.name}: ${f.reason}`).join('\n');
    message = addRetryContext(message, {
      ...result,
      error: `Output validation failed:\n${feedback}\n\nPlease fix these issues.`,
    }, attempt + 1);
  }

  // Return last result even if validation failed
  return agent.execute(message);
}
```

---

## ✅ CHECKLIST

- [ ] Retry with exponential backoff
- [ ] Error context passed to retries (self-correction)
- [ ] Fallback chain tries alternative agents
- [ ] Graceful degradation when all fail
- [ ] Circuit breaker tracks agent health (closed/open/half-open)
- [ ] ResilientAgentPool manages breakers
- [ ] Output validators catch bad responses
- [ ] Validation failures trigger retry with feedback

---

## 💡 KEY TAKEAWAY

**Resilience is what separates demos from production. Three layers of defense: (1) Retry with error context so agents self-correct, (2) Fallback to alternative agents when one is broken, (3) Circuit breaker to stop hammering a failing agent. Add output validation to catch hallucinations before they reach users. The goal is: the user always gets a useful response, even when things go wrong internally.**

---

**Next → [Day 60: Multi-Agent Project + Week 12 Wrap](day-60.md)**
