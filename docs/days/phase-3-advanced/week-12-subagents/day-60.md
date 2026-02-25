# Day 60 — Multi-Agent Demo + Week 12 Wrap

> 🎯 **DAY GOAL:** Build a complete multi-agent demo that ties together everything from this week: coordinator, specialists, communication, handoff, and recovery

---

## 📚 CONCEPT: Putting It All Together

### WHAT — The Full Multi-Agent System

```
USER MESSAGE
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│ COORDINATOR                                               │
│  1. Plan delegation (router / pipeline / parallel)        │
│  2. Build context for each specialist                     │
│  3. Execute with recovery (retry → fallback → degrade)    │
│  4. Synthesize final response                             │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ RESILIENT AGENT POOL                                 │ │
│  │                                                      │ │
│  │  🔬 researcher ──[circuit breaker]──▶ execute        │ │
│  │  ✍️  writer     ──[circuit breaker]──▶ execute       │ │
│  │  💻 coder      ──[circuit breaker]──▶ execute        │ │
│  │  📊 analyst    ──[circuit breaker]──▶ execute        │ │
│  │  🧠 memory_mgr ──[circuit breaker]──▶ execute        │ │
│  │                                                      │ │
│  │  Each: retry(2) → fallback → validate → return       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  📝 EXECUTION TRACKER                                     │
│    trace-id → step1 → step2 → step3 → summary            │
└──────────────────────────────────────────────────────────┘
     │
     ▼
FINAL RESPONSE TO USER
```

---

## 🔨 HANDS-ON: Complete Demo

### Step 1: Full Integration (30 minutes)

Create `packages/agent/src/sub-agents/demo.ts`:

```typescript
import { CoordinatorAgent } from './coordinator.js';
import { SpecialistAgent, type SpecialistConfig } from './specialist.js';
import { ResilientAgentPool, executeWithRetry, executeWithFallback, validators, executeWithValidation } from './recovery.js';
import { ExecutionTracker } from './tracker.js';

// ─── Mock LLM for demo (replace with real Ollama/Gemini call) ───

async function mockLlmCall(
  messages: any[],
  options: any = {},
): Promise<{ content: string; tokensUsed: number }> {
  const lastMsg = messages[messages.length - 1].content;
  
  // Simulate different specialist responses
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
  
  return {
    content: `[Mock response to: "${lastMsg.slice(0, 80)}..."]`,
    tokensUsed: Math.floor(100 + Math.random() * 500),
  };
}

// ─── Define Specialist Configs ───

const SPECIALISTS: SpecialistConfig[] = [
  {
    name: 'researcher',
    description: 'Searches memory and knowledge base for relevant information',
    systemPrompt: `You are a research specialist for the Lunar AI agent.
Your job: Find relevant information from memory and context.
Be thorough but concise. Cite sources when possible.`,
    allowedTools: ['search_memory', 'web_search'],
    defaultConstraints: { maxTokens: 1500, timeout: 20_000, maxToolCalls: 5, temperature: 0.3 },
  },
  {
    name: 'writer',
    description: 'Creates, edits, and improves text content',
    systemPrompt: `You are a writing specialist for the Lunar AI agent.
Your job: Write clear, engaging, well-structured content.
Match the user's tone and style. Be creative but accurate.`,
    allowedTools: [],
    defaultConstraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 0, temperature: 0.7 },
  },
  {
    name: 'coder',
    description: 'Writes, reviews, debugs, and explains code',
    systemPrompt: `You are a coding specialist for the Lunar AI agent.
Your job: Write clean, tested, well-documented code.
Follow best practices. Explain your reasoning.`,
    allowedTools: ['read_file', 'write_file', 'run_command'],
    defaultConstraints: { maxTokens: 3000, timeout: 45_000, maxToolCalls: 10, temperature: 0.2 },
  },
  {
    name: 'analyst',
    description: 'Analyzes data, extracts insights, and summarizes findings',
    systemPrompt: `You are an analysis specialist for the Lunar AI agent.
Your job: Analyze information and provide clear, actionable insights.
Use data to support conclusions. Be objective.`,
    allowedTools: ['search_memory'],
    defaultConstraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 3, temperature: 0.3 },
  },
];

// ─── Demo Scenarios ───

async function demoRouterPattern() {
  console.log('\n═══ DEMO 1: Router Pattern ═══');
  console.log('User asks a coding question → routes to coder specialist\n');

  const coder = new SpecialistAgent(SPECIALISTS[2], mockLlmCall);
  
  const { createTaskMessage } = await import('./protocol.js');
  const message = createTaskMessage('coordinator', 'coder', 
    'Write a TypeScript function that debounces API calls',
    { constraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 5, allowedTools: [] } }
  );

  const result = await executeWithRetry(coder, message);
  
  console.log(`  Status: ${result.status}`);
  console.log(`  Tokens: ${result.tokensUsed}`);
  console.log(`  Duration: ${result.durationMs}ms`);
  console.log(`  Confidence: ${result.confidence}`);
  console.log(`  Output: ${result.output.slice(0, 100)}...`);
}

async function demoPipelinePattern() {
  console.log('\n═══ DEMO 2: Pipeline Pattern ═══');
  console.log('Research → Write → Review (each feeds into next)\n');

  const researcher = new SpecialistAgent(SPECIALISTS[0], mockLlmCall);
  const writer = new SpecialistAgent(SPECIALISTS[1], mockLlmCall);
  const analyst = new SpecialistAgent(SPECIALISTS[3], mockLlmCall);
  const tracker = new ExecutionTracker();

  const { createTaskMessage } = await import('./protocol.js');
  const traceId = crypto.randomUUID();

  // Step 1: Research
  const researchMsg = createTaskMessage('coordinator', 'researcher',
    'Find key trends in AI agents for 2026',
    { traceId }
  );
  tracker.startStep(researchMsg);
  const researchResult = await researcher.execute(researchMsg);
  tracker.completeStep(researchResult);
  console.log(`  ✅ Research: ${researchResult.status} (${researchResult.durationMs}ms)`);

  // Step 2: Write (using research results as context)
  const writeMsg = createTaskMessage('coordinator', 'writer',
    'Write a blog post about AI agent trends using the research provided',
    {
      traceId,
      context: [{
        type: 'previous_result',
        content: researchResult.output,
        source: 'researcher',
        relevance: 1.0,
      }],
    }
  );
  tracker.startStep(writeMsg);
  const writeResult = await writer.execute(writeMsg);
  tracker.completeStep(writeResult);
  console.log(`  ✅ Write: ${writeResult.status} (${writeResult.durationMs}ms)`);

  // Step 3: Review
  const reviewMsg = createTaskMessage('coordinator', 'analyst',
    'Review this blog post for accuracy and suggest improvements',
    {
      traceId,
      context: [{
        type: 'previous_result',
        content: writeResult.output,
        source: 'writer',
        relevance: 1.0,
      }],
    }
  );
  tracker.startStep(reviewMsg);
  const reviewResult = await analyst.execute(reviewMsg);
  tracker.completeStep(reviewResult);
  console.log(`  ✅ Review: ${reviewResult.status} (${reviewResult.durationMs}ms)`);

  // Print trace
  console.log(`\n${tracker.formatTrace(traceId)}`);
}

async function demoCircuitBreaker() {
  console.log('\n═══ DEMO 3: Circuit Breaker ═══');
  console.log('Agent fails repeatedly → circuit opens → recovers\n');

  const pool = new ResilientAgentPool();
  
  // Register with low threshold for demo
  const coder = new SpecialistAgent(SPECIALISTS[2], mockLlmCall);
  pool.register(coder, { threshold: 2, cooldownMs: 5_000 });

  console.log(`  Initial health:`, pool.getHealth());
  
  // Simulate after some failures (manually record)  
  const { createTaskMessage } = await import('./protocol.js');
  const msg = createTaskMessage('demo', 'coder', 'test task');
  
  // Execute normally
  const result = await pool.execute('coder', msg);
  console.log(`  After success:`, pool.getHealth());
}

async function demoFallback() {
  console.log('\n═══ DEMO 4: Fallback Chain ═══');
  console.log('Primary agent → try fallback → try another fallback\n');

  const primary = new SpecialistAgent(SPECIALISTS[2], mockLlmCall);
  const fallback1 = new SpecialistAgent(SPECIALISTS[1], mockLlmCall);
  const fallback2 = new SpecialistAgent(SPECIALISTS[3], mockLlmCall);

  const { createTaskMessage } = await import('./protocol.js');
  const message = createTaskMessage('coordinator', 'coder', 'Explain how async/await works');

  const result = await executeWithFallback(message, {
    primary,
    fallbacks: [fallback1, fallback2],
    retryPerAgent: 1,
  });

  console.log(`  Handled by: ${result.handledBy}`);
  console.log(`  Status: ${result.status}`);
}

// ─── Run All Demos ───

async function main() {
  console.log('🌙 LUNAR Sub-Agent System Demo');
  console.log('================================\n');

  await demoRouterPattern();
  await demoPipelinePattern();
  await demoCircuitBreaker();
  await demoFallback();

  console.log('\n================================');
  console.log('✅ All demos completed!');
}

main().catch(console.error);
```

---

## 📋 Week 12 Summary

### What We Built

| Day | Topic | Key Files |
|-----|-------|-----------|
| 56 | Sub-agent architecture | `coordinator.ts` with 5 specialist types |
| 57 | Communication protocol | `protocol.ts`, `tracker.ts`, `context-builder.ts` |
| 58 | Agent handoff + delegation | `specialist.ts`, `coordinator.ts`, `setup.ts` |
| 59 | Error recovery + fallbacks | `recovery.ts` (retry, fallback, circuit breaker, validators) |
| 60 | Full multi-agent demo | `demo.ts` (all patterns working together) |

### Architecture Created

```
packages/agent/src/sub-agents/
├── protocol.ts          # Message types + factory functions
├── tracker.ts           # Execution trace tracking
├── context-builder.ts   # Build relevant context for agents
├── specialist.ts        # Base specialist agent class
├── coordinator.ts       # Orchestration + delegation
├── recovery.ts          # Retry, fallback, circuit breaker
├── setup.ts             # Wire up the agent team
└── demo.ts              # Integration demo
```

### Key Patterns Learned

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Router | One agent can handle it | "Write a poem" → writer |
| Pipeline | Sequential processing | Research → Write → Review |
| Parallel | Independent subtasks | Summarize + Translate simultaneously |
| Retry | Transient failures | API timeout → retry with backoff |
| Fallback | Agent can't handle task | Coder fails → writer tries |
| Circuit breaker | Persistent failures | Disable broken agent temporarily |

---

## ✅ WEEK 12 CHECKLIST

- [ ] Coordinator plans and delegates tasks
- [ ] 5 specialist agents with focused system prompts
- [ ] Structured message protocol (AgentMessage ↔ AgentResult)
- [ ] Execution tracking with trace IDs
- [ ] Context builder shares relevant info between agents
- [ ] Pipeline chains agent outputs
- [ ] Parallel executes independent tasks simultaneously
- [ ] Retry with exponential backoff + error context
- [ ] Fallback chain with graceful degradation
- [ ] Circuit breaker protects against cascading failures
- [ ] Output validators catch bad responses
- [ ] Demo runs all patterns end-to-end

---

## 💡 KEY TAKEAWAY

**Multi-agent systems are like well-organized teams. The coordinator is the manager — it doesn't do the work itself, it plans, delegates, and synthesizes. Each specialist has ONE focused job with clear boundaries. Communication happens through structured messages, not loose strings. And resilience (retry → fallback → degrade) ensures the system works even when individual agents fail. This is the pattern used by production AI systems like ChatGPT, Claude, and Devin.**

---

## ❓ SELF-CHECK QUESTIONS

1. When should you use pipeline vs. parallel pattern?
2. Why does the retry system pass error context to the retried agent?
3. What are the three states of a circuit breaker?
4. Why do specialists have separate system prompts instead of one big prompt?
5. How does the ExecutionTracker help with debugging?

---

**Next → [Week 13: Fine-tuning & Customization](../week-13-finetuning/day-61.md)**
