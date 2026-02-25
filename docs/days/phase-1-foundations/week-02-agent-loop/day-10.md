# Day 10 — Polish + Architecture Alignment

> 🎯 **DAY GOAL:** Refactor your code to match Lunar's real architecture, add logging, and review the full agent system

---

## 📚 CONCEPT 1: Software Architecture for AI Systems

### WHAT — Simple Definition

**Organizing your AI code into separate packages where each package has ONE job.** Instead of one giant folder, you split into: agent (brain), tools (hands), memory (storage), shared (common types).

### WHY — Why Architecture Matters for AI Projects?

```
Without architecture (one big folder):
  src/
  ├── index.ts          ← 500 lines, does everything
  ├── tools.ts          ← random tools mixed together
  └── helpers.ts        ← grab bag of utilities

  Problems:
  - "Where do I add a new tool?" → unclear
  - "Which file handles LLM calls?" → search everywhere
  - "Can I reuse the memory module?" → no, it's tangled with everything

With architecture (monorepo packages):
  packages/
  ├── agent/     ← brain: LLM calls + agent loop
  ├── tools/     ← hands: bash, file, datetime
  ├── memory/    ← storage: vector DB, search
  ├── session/   ← history: conversation persistence  
  ├── shared/    ← types: shared interfaces
  └── gateway/   ← entry: starts everything

  Benefits:
  - Each folder = one responsibility
  - Can test each package independently
  - New team member can understand in 5 minutes
```

### WHEN — When to Refactor?

Right now! You have a working agent (from Days 6-9). Before adding more features (RAG, Telegram, etc.), organize the code cleanly. It's much harder to refactor later.

### HOW — Lunar's Package Structure

```
packages/
├── shared/          ← Shared types and utilities
│   └── src/
│       └── types.ts    ← Message, ToolDefinition, LLMConfig
│
├── agent/           ← The AI brain
│   └── src/
│       ├── llm/
│       │   ├── types.ts      ← LLMProvider interface
│       │   └── ollama.ts     ← Ollama implementation
│       ├── runner.ts         ← Agent loop (while → tool → respond)
│       ├── approval.ts       ← Tool approval system
│       └── cli.ts            ← REPL entry point
│
├── tools/           ← All tools
│   └── src/
│       ├── bash.ts           ← Shell execution
│       ├── filesystem.ts     ← File read/write/list
│       ├── datetime.ts       ← Current time
│       └── executor.ts       ← Central dispatcher
│
├── memory/          ← (Week 3: RAG + vector store)
├── session/         ← (Week 4: conversation persistence)
├── connectors/      ← (Week 4: Telegram, WebChat)
└── gateway/         ← (Week 4: entry point, HTTP server)
```

### 🔗 NODE.JS ANALOGY

This is exactly like a Node.js monorepo:

```
// npm workspaces / pnpm workspaces
// Each package has its own package.json
// They import from each other:

// packages/tools/src/executor.ts
import type { ToolDefinition } from '@lunar/shared';

// packages/agent/src/runner.ts
import { executeTool } from '@lunar/tools';
import type { Message } from '@lunar/shared';
```

---

## 📚 CONCEPT 2: Conversation Logging (JSONL)

### WHAT — Simple Definition

**Saving every conversation turn to a file so you can review, debug, and analyze later.** Each line in the file = one event (user message, AI response, tool call, tool result).

### WHY — Why Log Conversations?

```
1. DEBUGGING: "Why did the AI give a weird answer?"
   → Open the log → see the exact messages + tool calls + results

2. IMPROVEMENT: "How can I make the AI better?"
   → Analyze logs → find common failures → fix prompts or tools

3. TRAINING DATA: "Can I fine-tune a model?"
   → Convert logs to training format → fine-tune (Week 13)

4. METRICS: "How well is my AI performing?"
   → Count errors, measure response times, track tool usage
```

### WHEN — What to Log?

```
Every interaction:
  {"type":"user","content":"What time is it?","ts":"2026-02-25T10:00:00Z"}
  {"type":"tool_call","name":"get_current_datetime","args":{},"ts":"..."}
  {"type":"tool_result","name":"get_current_datetime","result":"2/25/2026, 10:00 AM","ts":"..."}
  {"type":"assistant","content":"It's 10:00 AM on February 25, 2026.","ts":"..."}
```

### HOW — JSONL Format

```
JSONL = JSON Lines
- One JSON object per line
- No commas between lines
- Easy to append (just add a line)
- Easy to parse (read line by line)
- Human readable (open in any editor)

vs JSON Array:
  [                           ← must load entire file to append
    {"msg": "hello"},
    {"msg": "world"}
  ]

vs JSONL:
  {"msg": "hello"}           ← just append new line
  {"msg": "world"}           ← no need to load the whole file
```

### 🔗 NODE.JS ANALOGY

JSONL logging = structured logging with `pino` or `winston`:

```typescript
// pino outputs JSONL:
const logger = pino();
logger.info({ userId: 123 }, 'User logged in');
// Output: {"level":30,"time":1708848000000,"msg":"User logged in","userId":123}

// Same pattern for conversation logging:
logger.info({ type: 'user', content: 'What time is it?' });
logger.info({ type: 'tool_call', name: 'get_current_datetime' });
```

---

## 🔨 HANDS-ON: Refactor + Add Logging

### Step 1: Create Shared Package (15 minutes)

Create `packages/shared/src/types.ts`:

```typescript
// ============================================
// Core message types (used everywhere)
// ============================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}

// ============================================
// Tool types
// ============================================

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

export interface ToolResult {
  name: string;
  result: string;
  success: boolean;
  durationMs: number;
}

// ============================================
// LLM types
// ============================================

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ============================================
// Envelope (from architecture: InboundEnvelope)
// ============================================

export interface InboundEnvelope {
  provider: 'cli' | 'telegram' | 'webchat' | 'discord';
  peerId: string;
  text: string;
  chatType: 'direct' | 'group';
  ts: string;
}
```

Create `packages/shared/package.json`:

```json
{
  "name": "@lunar/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "src/types.ts",
  "exports": {
    ".": "./src/types.ts"
  }
}
```

### Step 2: Add Conversation Logger (20 minutes)

Create `packages/agent/src/logger.ts`:

```typescript
import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

export interface LogEntry {
  type: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'system';
  content: string;
  metadata?: Record<string, any>;
  ts: string;
}

export class ConversationLogger {
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  async log(sessionId: string, entry: Omit<LogEntry, 'ts'>): Promise<void> {
    await mkdir(this.logDir, { recursive: true });

    const full: LogEntry = {
      ...entry,
      ts: new Date().toISOString(),
    };

    const filePath = path.join(this.logDir, `${sessionId}.jsonl`);
    await appendFile(filePath, JSON.stringify(full) + '\n');
  }

  async logUserMessage(sessionId: string, content: string) {
    await this.log(sessionId, { type: 'user', content });
  }

  async logAssistantMessage(sessionId: string, content: string) {
    await this.log(sessionId, { type: 'assistant', content });
  }

  async logToolCall(sessionId: string, name: string, args: any) {
    await this.log(sessionId, {
      type: 'tool_call',
      content: name,
      metadata: { args },
    });
  }

  async logToolResult(sessionId: string, name: string, result: string, success: boolean) {
    await this.log(sessionId, {
      type: 'tool_result',
      content: result.slice(0, 500),
      metadata: { name, success },
    });
  }
}
```

### Step 3: Wire Logging into Agent Runner (15 minutes)

Add logging calls to your `runner.ts`:

```typescript
// At the start of runAgent:
await logger.logUserMessage(sessionId, userMessage);

// After each tool call:
await logger.logToolCall(sessionId, name, args);

// After each tool result:
await logger.logToolResult(sessionId, name, result, success);

// After final response:
await logger.logAssistantMessage(sessionId, reply);
```

### Step 4: Add CLI Help Command (10 minutes)

Update `packages/agent/src/cli.ts` — add special commands:

```typescript
function handleCommand(input: string): boolean {
  if (input === '/help') {
    console.log(`
Available commands:
  /help     — Show this help message
  /tools    — List available tools
  /history  — Show conversation history
  /clear    — Clear conversation history
  /exit     — Exit the program
    `);
    return true;
  }

  if (input === '/tools') {
    const tools = getToolDefinitions();
    console.log('\nAvailable tools:');
    for (const tool of tools) {
      console.log(`  🔧 ${tool.function.name} — ${tool.function.description}`);
    }
    console.log('');
    return true;
  }

  return false;  // not a command, treat as chat message
}
```

### Step 5: Verify Final Structure (15 minutes)

Run this to check your project structure:

```bash
find packages -name '*.ts' | head -20
# Should show something like:
# packages/shared/src/types.ts
# packages/agent/src/llm/ollama.ts
# packages/agent/src/llm/types.ts
# packages/agent/src/runner.ts
# packages/agent/src/approval.ts
# packages/agent/src/logger.ts
# packages/agent/src/cli.ts
# packages/tools/src/bash.ts
# packages/tools/src/filesystem.ts
# packages/tools/src/datetime.ts
# packages/tools/src/executor.ts
```

---

## ✅ CHECKLIST

- [ ] Shared types moved to `@lunar/shared`
- [ ] Agent package imports from shared
- [ ] Tools package imports from shared
- [ ] Conversation logger writes JSONL files
- [ ] Every turn is logged (user, assistant, tool_call, tool_result)
- [ ] CLI has `/help`, `/tools`, `/history`, `/clear` commands
- [ ] Agent loop still works end-to-end after refactor

---

## 💡 KEY TAKEAWAY

**You just built the core of what AI Engineers build at companies.** The architecture scales — add more tools, better prompts, more models, more channels. The agent loop, approval system, error handling, and logging patterns stay the same. Everything from here builds ON TOP of what you have.

---

## ❓ SELF-CHECK QUESTIONS

1. **Why use a monorepo with separate packages instead of one big `src/` folder?**
   <details><summary>Answer</summary>Separate packages enforce boundaries. The tools package can't accidentally import agent internals. Each package can be tested independently. New developers can understand one package at a time. This mirrors how real companies organize AI codebases.</details>

2. **Why JSONL instead of a regular JSON file for conversation logs?**
   <details><summary>Answer</summary>JSONL is append-only — you just add a new line. With JSON arrays, you'd need to read the whole file, parse it, push to the array, and write it back. JSONL also handles crashes better — if the program dies mid-write, you lose at most one line, not the entire file.</details>

3. **What is an InboundEnvelope and why do we need it?**
   <details><summary>Answer</summary>An InboundEnvelope is a normalized message format. Telegram sends messages differently than Discord, which is different from WebChat. The envelope normalizes all of them to: `{provider, peerId, text, chatType}`. This means the agent engine doesn't need to know about Telegram or Discord — it just processes envelopes.</details>

4. **List the packages you'll have by Week 4 and what each one does.**
   <details><summary>Answer</summary>
   - `shared` — Types shared across all packages
   - `agent` — LLM calls, agent loop, approval, logging
   - `tools` — Tool definitions and executors
   - `memory` — Vector store, chunking, hybrid search (Week 3)
   - `session` — Conversation persistence (Week 4)
   - `connectors` — Telegram, WebChat adapters (Week 4)
   - `gateway` — HTTP server, starts everything (Week 4)
   </details>

---

### 🎉 WEEK 2 COMPLETE!

```
What you built this week:
├── ✅ Agent loop (while → tool → respond) — THE core pattern
├── ✅ 4+ tools (bash, file read/write, list dir, datetime)
├── ✅ Tool approval system (auto/ask/deny tiers)
├── ✅ Error handling (max iterations, tool errors, graceful recovery)
├── ✅ Conversation logging (JSONL)
├── ✅ Clean monorepo architecture
└── ✅ CLI with help commands

You can now explain: agent loop, tool calling, JSON Schema,
approval policies, error recovery, JSONL logging, monorepo architecture.

Next week: give the AI a MEMORY → RAG pipeline!
```

**Next → [Week 3, Day 11: Text Chunking + Embeddings](../week-03-rag-memory/day-11.md)**
