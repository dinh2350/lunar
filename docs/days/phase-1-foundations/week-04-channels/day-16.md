# Day 16 — Session Management (JSONL Transcripts)

> 🎯 **DAY GOAL:** Make conversations survive program restarts — persistent session storage

---

## 📚 CONCEPT 1: Sessions

### WHAT — Simple Definition

**A session is one continuous conversation between a user and the AI.** It has an ID, a history of messages, and metadata. Sessions let the AI "remember" what was said earlier, even after restarting.

### WHY — Why Sessions?

```
WITHOUT sessions:
  Message 1: "My name is Hao"     → AI: "Nice to meet you, Hao!"
  [restart program]
  Message 2: "What's my name?"    → AI: "I don't know your name." 😔

WITH sessions:
  Message 1: "My name is Hao"     → AI: "Nice to meet you, Hao!"
  [restart program]
  [loads session from disk]
  Message 2: "What's my name?"    → AI: "Your name is Hao!" ✅
```

### HOW — Session ID Convention

```
Session ID = agent:agentId:provider:peerId

Examples:
  agent:main:telegram:user:123456     ← Telegram DM with user 123456
  agent:main:webchat:session:abc-def  ← WebChat with session abc-def
  agent:main:cli:local                ← Local CLI session

WHY this format?
  - One user on Telegram = one session
  - Same user on WebChat = DIFFERENT session
  - Each channel gets its own conversation context
```

### HOW — JSONL Transcript Storage

```
File: sessions/agent:main:telegram:user:123456.jsonl

{"role":"user","content":"My name is Hao","ts":"2026-02-25T10:00:00Z"}
{"role":"assistant","content":"Nice to meet you, Hao!","ts":"2026-02-25T10:00:02Z"}
{"role":"user","content":"What time is it?","ts":"2026-02-25T10:05:00Z"}
{"role":"tool_call","name":"get_current_datetime","args":{},"ts":"2026-02-25T10:05:01Z"}
{"role":"tool_result","name":"get_current_datetime","result":"10:05 AM","ts":"2026-02-25T10:05:01Z"}
{"role":"assistant","content":"It's 10:05 AM.","ts":"2026-02-25T10:05:02Z"}

Each line = one event, in chronological order.
Append-only. Never delete or modify lines.
```

### 🔗 NODE.JS ANALOGY

```typescript
// Sessions = like express-session, but stored as flat files
//
// express-session stores in Redis/Memory:
//   req.session.userId = 123;
//   req.session.cart = [...];
//
// Lunar sessions store in JSONL files:
//   session.appendTurn({ role: 'user', content: 'Hello' });
//   const history = session.loadHistory();
//
// Same concept: persist state across requests/restarts.
```

---

## 🔨 HANDS-ON: Build Session Manager

### Step 1: Create Session Package (30 minutes)

Create `packages/session/src/manager.ts`:

```typescript
import { existsSync } from 'fs';
import { readFile, appendFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import type { Message } from '@lunar/shared';

export interface SessionTurn {
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'system';
  content: string;
  name?: string;       // tool name (for tool_call/tool_result)
  args?: any;          // tool arguments (for tool_call)
  ts: string;          // ISO timestamp
}

export class SessionManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /** Build a session ID from provider + peer info */
  resolveSessionId(provider: string, peerId: string, agentId = 'main'): string {
    return `agent:${agentId}:${provider}:${peerId}`;
  }

  /** Load full conversation history from JSONL file */
  async loadHistory(sessionId: string): Promise<SessionTurn[]> {
    const filePath = this.getFilePath(sessionId);
    if (!existsSync(filePath)) return [];

    const content = await readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.length > 0);

    return lines.map(line => {
      try {
        return JSON.parse(line) as SessionTurn;
      } catch {
        return null;
      }
    }).filter(Boolean) as SessionTurn[];
  }

  /** Load only the last N turns (for context window management) */
  async loadRecentHistory(sessionId: string, maxTurns = 20): Promise<SessionTurn[]> {
    const history = await this.loadHistory(sessionId);
    return history.slice(-maxTurns);
  }

  /** Append a single turn to the session transcript */
  async appendTurn(sessionId: string, turn: Omit<SessionTurn, 'ts'>): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    await mkdir(path.dirname(filePath), { recursive: true });

    const fullTurn: SessionTurn = {
      ...turn,
      ts: new Date().toISOString(),
    };

    await appendFile(filePath, JSON.stringify(fullTurn) + '\n');
  }

  /** Convert session turns to LLM-compatible messages */
  toMessages(turns: SessionTurn[]): Message[] {
    return turns
      .filter(t => t.role === 'user' || t.role === 'assistant')
      .map(t => ({
        role: t.role as 'user' | 'assistant',
        content: t.content,
      }));
  }

  /** List all sessions */
  async listSessions(): Promise<string[]> {
    await mkdir(this.basePath, { recursive: true });
    const files = await readdir(this.basePath);
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''));
  }

  private getFilePath(sessionId: string): string {
    // Sanitize session ID for filesystem (replace : with -)
    const safeId = sessionId.replace(/:/g, '-');
    return path.join(this.basePath, `${safeId}.jsonl`);
  }
}
```

### Step 2: Integrate with Agent Runner (20 minutes)

Update your main CLI entry point to use sessions:

```typescript
import { SessionManager } from '../../session/src/manager.js';

const sessionManager = new SessionManager('./data/sessions');
const sessionId = sessionManager.resolveSessionId('cli', 'local');

// On startup: load previous conversation
const history = await sessionManager.loadRecentHistory(sessionId, 20);
console.log(`📜 Loaded ${history.length} previous turns`);

// On each user message:
async function handleMessage(userInput: string): Promise<string> {
  // 1. Save user message
  await sessionManager.appendTurn(sessionId, { role: 'user', content: userInput });

  // 2. Load recent history for context
  const recentHistory = await sessionManager.loadRecentHistory(sessionId, 20);
  const messages = sessionManager.toMessages(recentHistory);

  // 3. Run agent with history
  const result = await runAgent(llm, userInput, SYSTEM_PROMPT, messages);

  // 4. Save assistant response
  await sessionManager.appendTurn(sessionId, { role: 'assistant', content: result.reply });

  return result.reply;
}
```

### Step 3: Test Persistence (10 minutes)

```
Run 1:
  You: My favorite color is blue
  Lunar: Got it! Blue is a great color.
  You: /exit

Run 2 (restart):
  📜 Loaded 2 previous turns
  You: What's my favorite color?
  Lunar: Your favorite color is blue! ✅

Check the file:
  cat data/sessions/agent-main-cli-local.jsonl
  → See all turns saved with timestamps
```

---

## ✅ CHECKLIST

- [ ] SessionManager saves/loads JSONL transcripts
- [ ] Session ID includes provider + peerId
- [ ] Conversations survive program restarts
- [ ] Recent history (last 20 turns) loaded for context
- [ ] Tool calls logged in session alongside messages

---

## 💡 KEY TAKEAWAY

**Sessions make your AI persistent. Save every turn to JSONL. On restart, load history back. The AI "remembers" everything. Simple append-only files — no complex database needed for conversations.**

---

## ❓ SELF-CHECK QUESTIONS

1. **Why limit to 20 recent turns instead of loading everything?**
   <details><summary>Answer</summary>LLMs have context limits. Loading 500 turns would exceed the window. 20 recent turns gives enough context for the current conversation while staying within limits. For older info, the AI uses memory_search (RAG) instead.</details>

2. **Why append-only instead of rewriting the file?**
   <details><summary>Answer</summary>Append is (1) fast — just add a line, no need to read+parse+serialize the whole file, (2) crash-safe — if the program dies mid-write, you lose at most one line, and (3) preserves history — you never accidentally delete turns.</details>

---

**Next → [Day 17: Telegram Bot](day-17.md)**
