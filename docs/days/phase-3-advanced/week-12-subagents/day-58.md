# Day 58 — Agent Handoff + Delegation

> 🎯 **DAY GOAL:** Build handoff logic — coordinator delegates tasks, passes context, and handles hand-back with results

---

## 📚 CONCEPT 1: Handoff = Context Transfer + Control Transfer

### WHAT — Simple Definition

**Agent Handoff is when one agent gives control of a sub-task to another agent, passing along the relevant context. Like a manager delegating a task to a team member with clear instructions.**

```
HANDOFF FLOW:
┌──────────────┐
│  Coordinator  │
│  "User wants  │
│   a blog post │
│   about AI"   │
└──────┬───────┘
       │ HANDOFF: {instruction, context, constraints}
       ▼
┌──────────────┐      ┌──────────────┐
│  Researcher   │─────▶│    Writer     │
│  "Find 5 key  │      │  "Write post  │
│   AI trends"  │      │   using these │
│               │      │   5 trends"   │
└──────────────┘      └──────┬───────┘
                              │ HAND-BACK: {result, confidence}
                              ▼
                      ┌──────────────┐
                      │  Coordinator  │
                      │  "Here's the  │
                      │   final post" │
                      └──────────────┘
```

### WHY — Single Agent Can't Do Everything Well

```
ONE AGENT DOING EVERYTHING:
  System prompt: "You are researcher + writer + editor + fact-checker..."
  → Confused about current role
  → Too long system prompt
  → Inconsistent quality

DELEGATED TO SPECIALISTS:
  Researcher → focused, relevant facts
  Writer → clear, engaging prose
  Editor → catches errors, improves flow
  → Each agent has ONE clear job
```

### 🔗 NODE.JS ANALOGY

```
// Like Express middleware delegation
app.use(authMiddleware);    // Auth specialist handles auth
app.use(validateMiddleware); // Validator specialist handles validation
app.use(routeHandler);      // Business logic specialist

// Each middleware does ONE thing, passes to next
// That's exactly what sub-agent handoff does!
```

---

## 🔨 HANDS-ON: Build Handoff System

### Step 1: Specialist Agent Base (20 minutes)

Create `packages/agent/src/sub-agents/specialist.ts`:

```typescript
import type { AgentMessage, AgentResult, TaskPayload } from './protocol.js';
import { createResult } from './protocol.js';
import { ContextBuilder } from './context-builder.js';

export interface SpecialistConfig {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  defaultConstraints: {
    maxTokens: number;
    timeout: number;
    maxToolCalls: number;
    temperature: number;
  };
}

export class SpecialistAgent {
  private config: SpecialistConfig;
  private llmCall: (messages: any[], options: any) => Promise<any>;

  constructor(
    config: SpecialistConfig,
    llmCall: (messages: any[], options: any) => Promise<any>,
  ) {
    this.config = config;
    this.llmCall = llmCall;
  }

  get name() { return this.config.name; }
  get description() { return this.config.description; }

  /**
   * Execute a task message and return a result
   */
  async execute(message: AgentMessage): Promise<AgentResult> {
    const start = Date.now();
    const payload = message.payload as TaskPayload;

    try {
      // Build prompt with context
      const contextText = ContextBuilder.formatForPrompt(payload.context);

      const messages = [
        { role: 'system', content: this.config.systemPrompt },
        {
          role: 'user',
          content: [
            contextText,
            `\nTask: ${payload.instruction}`,
            `\nConstraints: max ${payload.constraints.maxTokens} tokens, max ${payload.constraints.maxToolCalls} tool calls`,
          ].filter(Boolean).join('\n'),
        },
      ];

      // Call LLM with constraints
      const response = await this.callWithConstraints(messages, payload.constraints);

      return createResult(message.id, this.config.name, message.traceId, {
        status: 'success',
        output: response.content,
        toolsUsed: response.toolCalls || [],
        tokensUsed: response.tokensUsed || 0,
        durationMs: Date.now() - start,
        confidence: this.estimateConfidence(response),
      });

    } catch (error) {
      return createResult(message.id, this.config.name, message.traceId, {
        status: 'error',
        output: '',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
        confidence: 0,
      });
    }
  }

  private async callWithConstraints(messages: any[], constraints: any) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), constraints.timeout);

    try {
      return await this.llmCall(messages, {
        maxTokens: constraints.maxTokens,
        temperature: constraints.temperature || this.config.defaultConstraints.temperature,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private estimateConfidence(response: any): number {
    // Simple heuristic — can be improved
    if (!response.content) return 0;
    if (response.content.length < 50) return 0.3;
    if (response.content.includes("I'm not sure") || response.content.includes("I don't know")) return 0.4;
    return 0.8;
  }
}
```

### Step 2: Coordinator with Delegation (25 minutes)

Create `packages/agent/src/sub-agents/coordinator.ts`:

```typescript
import type { AgentMessage, AgentResult } from './protocol.js';
import { createTaskMessage, createResult } from './protocol.js';
import { SpecialistAgent } from './specialist.js';
import { ExecutionTracker } from './tracker.js';
import { ContextBuilder } from './context-builder.js';

interface DelegationPlan {
  pattern: 'router' | 'pipeline' | 'parallel';
  steps: DelegationStep[];
}

interface DelegationStep {
  agent: string;
  instruction: string;
  dependsOn?: string[];    // agent names this step needs results from
}

export class CoordinatorAgent {
  private specialists = new Map<string, SpecialistAgent>();
  private tracker: ExecutionTracker;
  private contextBuilder: ContextBuilder;
  private plannerLlm: (messages: any[], options: any) => Promise<any>;

  constructor(
    plannerLlm: (messages: any[], options: any) => Promise<any>,
    memorySearch: (query: string) => Promise<any[]>,
  ) {
    this.plannerLlm = plannerLlm;
    this.tracker = new ExecutionTracker();
    this.contextBuilder = new ContextBuilder(memorySearch);
  }

  registerSpecialist(agent: SpecialistAgent): void {
    this.specialists.set(agent.name, agent);
  }

  /**
   * Main entry: handle a user request by planning + delegating
   */
  async handle(
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<string> {
    // 1. Plan how to handle this request
    const plan = await this.planDelegation(userMessage);

    if (!plan) {
      // Simple query — handle directly
      return this.handleDirectly(userMessage, conversationHistory);
    }

    // 2. Execute the plan
    const traceId = crypto.randomUUID();
    const results = await this.executePlan(plan, traceId, conversationHistory);

    // 3. Synthesize final response from agent results
    const finalResponse = await this.synthesize(userMessage, results);

    // 4. Log trace for debugging
    console.log(this.tracker.formatTrace(traceId));

    return finalResponse;
  }

  /**
   * Decide which agents to use and in what pattern
   */
  private async planDelegation(userMessage: string): Promise<DelegationPlan | null> {
    const agentDescriptions = [...this.specialists.entries()]
      .map(([name, agent]) => `- ${name}: ${agent.description}`)
      .join('\n');

    const response = await this.plannerLlm([
      {
        role: 'system',
        content: `You are a task planner. Given a user request and available agents, decide:
1. Can this be handled directly (no delegation needed)? → respond: {"delegate": false}
2. Should one agent handle it? → respond: {"delegate": true, "pattern": "router", "steps": [{"agent": "name", "instruction": "..."}]}
3. Should multiple agents work in sequence? → respond: {"delegate": true, "pattern": "pipeline", "steps": [{"agent": "name", "instruction": "...", "dependsOn": []}]}
4. Should multiple agents work in parallel? → respond: {"delegate": true, "pattern": "parallel", "steps": [...]}

Available agents:
${agentDescriptions}

RESPOND WITH JSON ONLY.`,
      },
      { role: 'user', content: userMessage },
    ], { temperature: 0 });

    try {
      const plan = JSON.parse(response.content);
      if (!plan.delegate) return null;
      return plan as DelegationPlan;
    } catch {
      return null; // Failed to parse — handle directly
    }
  }

  /**
   * Execute a delegation plan
   */
  private async executePlan(
    plan: DelegationPlan,
    traceId: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();

    switch (plan.pattern) {
      case 'router': {
        // Single agent handles it
        const step = plan.steps[0];
        const result = await this.delegate(
          step.agent, step.instruction, traceId, { conversationHistory }
        );
        results.set(step.agent, result);
        break;
      }

      case 'pipeline': {
        // Sequential — each agent gets previous results
        for (const step of plan.steps) {
          const previousResults = step.dependsOn?.map(dep => ({
            agent: dep,
            output: results.get(dep)?.output || '',
          }));

          const result = await this.delegate(
            step.agent, step.instruction, traceId,
            { conversationHistory, previousResults }
          );
          results.set(step.agent, result);

          // Stop pipeline if a step fails
          if (result.status === 'error') break;
        }
        break;
      }

      case 'parallel': {
        // All agents work simultaneously
        const promises = plan.steps.map(step =>
          this.delegate(step.agent, step.instruction, traceId, { conversationHistory })
            .then(result => [step.agent, result] as const)
        );

        const settled = await Promise.allSettled(promises);
        for (const item of settled) {
          if (item.status === 'fulfilled') {
            results.set(item.value[0], item.value[1]);
          }
        }
        break;
      }
    }

    return results;
  }

  /**
   * Delegate a task to a specific specialist
   */
  private async delegate(
    agentName: string,
    instruction: string,
    traceId: string,
    options: {
      conversationHistory?: Array<{ role: string; content: string }>;
      previousResults?: Array<{ agent: string; output: string }>;
    } = {}
  ): Promise<AgentResult> {
    const specialist = this.specialists.get(agentName);
    if (!specialist) {
      return createResult('unknown', agentName, traceId, {
        status: 'error',
        error: `Agent "${agentName}" not found`,
      });
    }

    // Build context for the specialist
    const context = await this.contextBuilder.buildContext(instruction, options);

    // Create structured message
    const message = createTaskMessage('coordinator', agentName, instruction, {
      context: context,
      traceId,
    });

    // Track and execute
    this.tracker.startStep(message);
    const result = await specialist.execute(message);
    this.tracker.completeStep(result);

    return result;
  }

  /**
   * Combine multiple agent results into one response
   */
  private async synthesize(
    originalRequest: string,
    results: Map<string, AgentResult>,
  ): Promise<string> {
    if (results.size === 1) {
      const [, result] = [...results.entries()][0];
      return result.output;
    }

    const agentOutputs = [...results.entries()]
      .map(([name, result]) => `[${name} — ${result.status}]: ${result.output}`)
      .join('\n\n---\n\n');

    const response = await this.plannerLlm([
      {
        role: 'system',
        content: 'Combine multiple agent outputs into a single coherent response for the user. Do not mention agents or internal details.',
      },
      {
        role: 'user',
        content: `Original request: ${originalRequest}\n\nAgent outputs:\n${agentOutputs}`,
      },
    ], { temperature: 0.3 });

    return response.content;
  }

  private async handleDirectly(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const response = await this.plannerLlm([
      { role: 'system', content: 'You are a helpful AI assistant.' },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message },
    ], { temperature: 0.7 });

    return response.content;
  }
}
```

### Step 3: Wire It Up (10 minutes)

Create `packages/agent/src/sub-agents/setup.ts`:

```typescript
import { CoordinatorAgent } from './coordinator.js';
import { SpecialistAgent } from './specialist.js';

export function createAgentTeam(
  llmCall: (messages: any[], options: any) => Promise<any>,
  memorySearch: (query: string) => Promise<any[]>,
): CoordinatorAgent {
  const coordinator = new CoordinatorAgent(llmCall, memorySearch);

  // Register specialists
  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'writer',
    description: 'Writes, edits, and improves text content',
    systemPrompt: 'You are an expert writer. Write clear, engaging content. Be concise.',
    allowedTools: [],
    defaultConstraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 0, temperature: 0.7 },
  }, llmCall));

  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'coder',
    description: 'Writes, reviews, and debugs code',
    systemPrompt: 'You are an expert programmer. Write clean, tested, documented code.',
    allowedTools: ['read_file', 'write_file', 'run_command'],
    defaultConstraints: { maxTokens: 3000, timeout: 45_000, maxToolCalls: 10, temperature: 0.2 },
  }, llmCall));

  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'researcher',
    description: 'Searches memory and external sources for information',
    systemPrompt: 'You are a research specialist. Find and summarize relevant information.',
    allowedTools: ['search_memory', 'web_search'],
    defaultConstraints: { maxTokens: 1500, timeout: 20_000, maxToolCalls: 5, temperature: 0.3 },
  }, llmCall));

  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'analyst',
    description: 'Analyzes data, extracts insights, draws conclusions',
    systemPrompt: 'You are a data analyst. Analyze information and provide clear insights.',
    allowedTools: ['search_memory'],
    defaultConstraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 3, temperature: 0.3 },
  }, llmCall));

  return coordinator;
}
```

---

## ✅ CHECKLIST

- [ ] SpecialistAgent base class with `execute(message)` method
- [ ] CoordinatorAgent plans delegation (direct / router / pipeline / parallel)
- [ ] Delegation passes structured context to specialists
- [ ] Pipeline pattern chains agent results
- [ ] Parallel pattern runs agents simultaneously
- [ ] Synthesizer combines multi-agent outputs
- [ ] ExecutionTracker logs every handoff
- [ ] Setup function wires the team together

---

## 💡 KEY TAKEAWAY

**Handoff is delegation + context transfer. The coordinator decides WHICH agent handles WHAT, passes relevant context, and collects results. Three patterns (router, pipeline, parallel) cover most real-world orchestration needs. The key insight: each specialist has ONE focused job with its own system prompt, which dramatically improves output quality over a single do-everything agent.**

---

**Next → [Day 59: Error Recovery + Fallbacks](day-59.md)**
