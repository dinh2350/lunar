# Day 57 — Agent Communication Protocol

> 🎯 **DAY GOAL:** Build a structured way for agents to communicate — pass context, share results, handle errors, and track execution

---

## 📚 CONCEPT 1: How Agents Talk to Each Other

### WHAT — Simple Definition

**An Agent Communication Protocol defines HOW agents pass information between each other: structured messages with context, results, and status. Like an internal API between agents.**

```
COORDINATOR ──message──▶ SPECIALIST ──result──▶ COORDINATOR

MESSAGE FORMAT:
┌─────────────────────────────────────┐
│ AgentMessage                        │
│  id: "msg-001"                      │
│  from: "coordinator"                │
│  to: "coder"                        │
│  type: "task"                       │
│  payload:                           │
│    instruction: "Fix the bug in..." │
│    context: [relevant memories]     │
│    constraints:                     │
│      maxTokens: 2000                │
│      timeout: 30000                 │
│  parentId: null (first in chain)    │
│  timestamp: 2026-02-25T10:30:00Z   │
└─────────────────────────────────────┘

RESULT FORMAT:
┌─────────────────────────────────────┐
│ AgentResult                         │
│  id: "res-001"                      │
│  messageId: "msg-001"               │
│  from: "coder"                      │
│  status: "success"                  │
│  output: "Fixed the null check..."  │
│  toolsUsed: ["read_file", "write"]  │
│  tokensUsed: 1847                   │
│  durationMs: 3200                   │
│  confidence: 0.85                   │
└─────────────────────────────────────┘
```

### WHY — Structure Prevents Chaos

```
WITHOUT PROTOCOL:
  Coordinator: "Hey coder, fix the bug"
  Coder: [runs, uses 10000 tokens, takes 60 seconds]
  Coordinator: "...what happened? what did you change?"
  → No tracking, no limits, no context sharing

WITH PROTOCOL:
  Coordinator: {task, context, constraints: {maxTokens: 2000, timeout: 30s}}
  Coder: {status: "success", output, toolsUsed, tokensUsed: 1847, duration: 3.2s}
  → Tracked, limited, auditable, reproducible
```

---

## 🔨 HANDS-ON: Build Communication Protocol

### Step 1: Message Types (15 minutes)

Create `packages/agent/src/sub-agents/protocol.ts`:

```typescript
import { randomUUID } from 'crypto';

// ─── Message Types ───

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'context' | 'feedback' | 'cancel';
  payload: TaskPayload | ContextPayload | FeedbackPayload;
  parentId?: string;       // For threading
  traceId: string;         // For tracking entire workflow
  timestamp: Date;
}

export interface TaskPayload {
  instruction: string;
  context: ContextItem[];
  constraints: TaskConstraints;
}

export interface ContextPayload {
  items: ContextItem[];
  source: string;
}

export interface FeedbackPayload {
  messageId: string;
  rating: 'good' | 'needs_improvement' | 'retry';
  notes: string;
}

export interface ContextItem {
  type: 'memory' | 'file' | 'conversation' | 'previous_result';
  content: string;
  source: string;
  relevance: number;  // 0-1
}

export interface TaskConstraints {
  maxTokens: number;
  timeout: number;       // ms
  maxToolCalls: number;
  allowedTools: string[];
  temperature?: number;
}

// ─── Result Types ───

export interface AgentResult {
  id: string;
  messageId: string;   // Which message this responds to
  from: string;
  traceId: string;
  status: 'success' | 'error' | 'partial' | 'timeout' | 'cancelled';
  output: string;
  toolsUsed: ToolCallRecord[];
  tokensUsed: number;
  durationMs: number;
  confidence: number;   // 0-1, how confident the agent is
  error?: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
}

// ─── Factory Functions ───

export function createTaskMessage(
  from: string,
  to: string,
  instruction: string,
  options: {
    context?: ContextItem[];
    constraints?: Partial<TaskConstraints>;
    traceId?: string;
    parentId?: string;
  } = {}
): AgentMessage {
  return {
    id: randomUUID(),
    from,
    to,
    type: 'task',
    payload: {
      instruction,
      context: options.context || [],
      constraints: {
        maxTokens: 2000,
        timeout: 30_000,
        maxToolCalls: 5,
        allowedTools: [],
        ...options.constraints,
      },
    },
    traceId: options.traceId || randomUUID(),
    parentId: options.parentId,
    timestamp: new Date(),
  };
}

export function createResult(
  messageId: string,
  from: string,
  traceId: string,
  data: Partial<AgentResult>
): AgentResult {
  return {
    id: randomUUID(),
    messageId,
    from,
    traceId,
    status: 'success',
    output: '',
    toolsUsed: [],
    tokensUsed: 0,
    durationMs: 0,
    confidence: 0.5,
    ...data,
  };
}
```

### Step 2: Execution Tracker (20 minutes)

Create `packages/agent/src/sub-agents/tracker.ts`:

```typescript
import type { AgentMessage, AgentResult } from './protocol.js';

interface TraceStep {
  message: AgentMessage;
  result?: AgentResult;
  startTime: Date;
  endTime?: Date;
  children: TraceStep[];
}

export class ExecutionTracker {
  private traces = new Map<string, TraceStep[]>();

  /**
   * Record that a message was sent
   */
  startStep(message: AgentMessage): void {
    const steps = this.traces.get(message.traceId) || [];
    steps.push({
      message,
      startTime: new Date(),
      children: [],
    });
    this.traces.set(message.traceId, steps);
  }

  /**
   * Record that a result was received
   */
  completeStep(result: AgentResult): void {
    const steps = this.traces.get(result.traceId);
    if (!steps) return;

    const step = steps.find(s => s.message.id === result.messageId);
    if (step) {
      step.result = result;
      step.endTime = new Date();
    }
  }

  /**
   * Get full trace for a workflow
   */
  getTrace(traceId: string): TraceStep[] {
    return this.traces.get(traceId) || [];
  }

  /**
   * Get summary statistics for a trace
   */
  getTraceSummary(traceId: string): {
    totalSteps: number;
    completedSteps: number;
    totalTokens: number;
    totalDurationMs: number;
    agentsUsed: string[];
    toolsUsed: string[];
    status: 'running' | 'completed' | 'error';
  } {
    const steps = this.traces.get(traceId) || [];
    
    const completed = steps.filter(s => s.result);
    const totalTokens = completed.reduce((sum, s) => sum + (s.result?.tokensUsed || 0), 0);
    const totalDuration = completed.reduce((sum, s) => sum + (s.result?.durationMs || 0), 0);
    const agents = [...new Set(steps.map(s => s.message.to))];
    const tools = [...new Set(completed.flatMap(s => s.result?.toolsUsed.map(t => t.name) || []))];
    const hasError = completed.some(s => s.result?.status === 'error');

    return {
      totalSteps: steps.length,
      completedSteps: completed.length,
      totalTokens,
      totalDurationMs: totalDuration,
      agentsUsed: agents,
      toolsUsed: tools,
      status: hasError ? 'error' : completed.length === steps.length ? 'completed' : 'running',
    };
  }

  /**
   * Format trace as readable text (for debugging / UI)
   */
  formatTrace(traceId: string): string {
    const steps = this.traces.get(traceId) || [];
    const lines: string[] = [`Trace: ${traceId}`];

    for (const step of steps) {
      const duration = step.result?.durationMs || 0;
      const status = step.result?.status || 'running';
      const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳';

      lines.push(
        `  ${icon} ${step.message.from} → ${step.message.to} (${duration}ms)`,
        `     Task: ${(step.message.payload as any).instruction?.slice(0, 60)}...`,
      );

      if (step.result) {
        lines.push(
          `     Tokens: ${step.result.tokensUsed} | Tools: ${step.result.toolsUsed.map(t => t.name).join(', ') || 'none'}`,
          `     Output: ${step.result.output.slice(0, 80)}...`,
        );
      }
    }

    const summary = this.getTraceSummary(traceId);
    lines.push(
      `\n  Summary: ${summary.completedSteps}/${summary.totalSteps} steps | ${summary.totalTokens} tokens | ${summary.totalDurationMs}ms`,
    );

    return lines.join('\n');
  }
}
```

### Step 3: Context Builder (15 minutes)

Create `packages/agent/src/sub-agents/context-builder.ts`:

```typescript
import type { ContextItem } from './protocol.js';

/**
 * Builds relevant context for a sub-agent task.
 * Gathers from: memory, conversation history, previous results.
 */
export class ContextBuilder {
  private memorySearch: (query: string) => Promise<any[]>;

  constructor(memorySearch: (query: string) => Promise<any[]>) {
    this.memorySearch = memorySearch;
  }

  /**
   * Build context for a task instruction
   */
  async buildContext(
    instruction: string,
    options: {
      conversationHistory?: Array<{ role: string; content: string }>;
      previousResults?: Array<{ agent: string; output: string }>;
      maxItems?: number;
    } = {}
  ): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const maxItems = options.maxItems || 10;

    // 1. Search memory for relevant context
    try {
      const memories = await this.memorySearch(instruction);
      for (const mem of memories.slice(0, 5)) {
        items.push({
          type: 'memory',
          content: mem.content,
          source: mem.source || 'memory',
          relevance: mem.score || 0.5,
        });
      }
    } catch {
      // Memory unavailable — continue without it
    }

    // 2. Add relevant conversation history
    if (options.conversationHistory) {
      const recent = options.conversationHistory.slice(-6);
      for (const msg of recent) {
        items.push({
          type: 'conversation',
          content: `${msg.role}: ${msg.content}`,
          source: 'conversation',
          relevance: 0.7,
        });
      }
    }

    // 3. Add previous agent results (for pipeline pattern)
    if (options.previousResults) {
      for (const prev of options.previousResults) {
        items.push({
          type: 'previous_result',
          content: `[${prev.agent} output]: ${prev.output}`,
          source: prev.agent,
          relevance: 0.9,
        });
      }
    }

    // Sort by relevance, take top N
    return items
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxItems);
  }

  /**
   * Format context items for inclusion in a prompt
   */
  static formatForPrompt(items: ContextItem[]): string {
    if (items.length === 0) return '';

    return `<context>
${items.map(item => 
  `[${item.type}|${item.source}|relevance:${item.relevance.toFixed(2)}]
${item.content}`
).join('\n\n')}
</context>`;
  }
}
```

---

## ✅ CHECKLIST

- [ ] AgentMessage and AgentResult types defined
- [ ] Factory functions for creating messages/results
- [ ] ExecutionTracker records message→result pairs
- [ ] Trace summary with stats
- [ ] Human-readable trace formatting
- [ ] ContextBuilder gathers memory + conversation + previous results
- [ ] Context formatted for agent prompts

---

## 💡 KEY TAKEAWAY

**Structured communication is what makes multi-agent systems reliable. Without a protocol, agents are just calling each other with loose strings. With a protocol, every interaction is tracked (traceId), constrained (limits), and auditable (execution tracker). The ContextBuilder ensures each agent gets relevant information without wasting tokens. This is the foundation for building complex multi-agent workflows.**

---

**Next → [Day 58: Agent Handoff + Delegation](day-58.md)**
