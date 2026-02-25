# Day 20 — Gateway Integration (Wire Everything Together)

> 🎯 **DAY GOAL:** Build the Gateway server that connects agent + memory + tools + channels into one `pnpm dev` command

---

## 📚 CONCEPT 1: The Gateway Pattern

### WHAT — Simple Definition

**A single entry point that receives requests from any channel and routes them to the agent engine.**

```
┌──────────────────────────────────────────────────────────┐
│  GATEWAY (Fastify server)                                 │
│                                                           │
│  /api/health   → status check                            │
│  /api/chat     → HTTP API for direct access              │
│  /ws/chat      → WebSocket for real-time UI              │
│  /webhook/tg   → Telegram webhook (future)               │
│                                                           │
│  On startup:                                              │
│    1. Initialize VectorStore (SQLite + embeddings)        │
│    2. Initialize MemoryFiles + MemoryIndexer              │
│    3. Initialize SessionManager                           │
│    4. Register tools (memory_search, memory_write, etc.)  │
│    5. Create Agent Engine                                 │
│    6. Start channel connectors (Telegram, WebChat)        │
│    7. Listen on port 3100                                 │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### WHY — Why a Gateway?

```
Without Gateway:
  ❌ Each channel starts its own agent instance
  ❌ No shared memory between channels  
  ❌ Multiple processes to manage
  ❌ No health checks or monitoring

With Gateway:
  ✅ Single process, single `pnpm dev`
  ✅ All channels share one memory system
  ✅ Health endpoint for monitoring
  ✅ Centralized logging
  ✅ Easy to add new channels later
```

### 🔗 NODE.JS ANALOGY

```
Gateway = Express/Fastify app with middleware
  └── Agent Engine = your business logic / controller
       ├── Tools = service layer functions
       ├── Memory = database / ORM
       └── Channels = route handlers (each for different client)

Same as: app.use(auth); app.use('/api', router); app.listen(3000);
But for AI: gateway.registerChannel(telegram); gateway.registerChannel(webchat); gateway.listen(3100);
```

---

## 📚 CONCEPT 2: Dependency Injection in the Gateway

### WHAT — Simple Definition

**Instead of each module creating its own dependencies, the Gateway creates them once and passes (injects) them where needed.**

### HOW — The Wiring Diagram

```
Gateway creates:
  store = new VectorStore(dbPath)           ← one SQLite DB
  memoryFiles = new MemoryFiles(workspace)  ← access to MEMORY.md + daily notes
  indexer = new MemoryIndexer(store, memoryFiles)  ← auto-indexer
  sessions = new SessionManager(dataDir)    ← session transcripts
  
  tools = [
    memorySearchTool → needs store
    memoryWriteTool  → needs store + memoryFiles + indexer
    bashTool         → standalone
    readFileTool     → standalone
  ]

  agent = new AgentEngine({ llm, tools, sessions, store })

  telegramBot = createTelegramBot(agent, sessions)
  webChat = createWebChatServer(agent, sessions)
```

### 🔗 NODE.JS ANALOGY

```
// Without DI — each module creates its own DB connection
// router.ts
const db = new Database(); // ← duplicate!

// With DI — index.ts creates once, passes to all
const db = new Database();         // ← one instance
const userService = new UserService(db);
const orderService = new OrderService(db);
const app = createApp(userService, orderService);

// SAME in Lunar:
const store = new VectorStore(dbPath);
const agent = new AgentEngine({ store, ...rest });
const telegram = createTelegramBot(agent, sessions);
```

---

## 🔨 HANDS-ON: Build the Gateway

### Step 1: Install Fastify (5 minutes)

```bash
cd packages/gateway
pnpm add fastify @fastify/websocket @fastify/cors
```

### Step 2: Create Gateway Entry Point (40 minutes)

Create `packages/gateway/src/index.ts`:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import path from 'path';
import { VectorStore } from '@lunar/memory';
import { MemoryFiles } from '@lunar/memory';
import { MemoryIndexer } from '@lunar/memory';
import { SessionManager } from '@lunar/memory';
import { createAgentEngine } from '@lunar/agent';
import { getTools } from '@lunar/tools';
import { createWebChatHandler } from './channels/webchat.js';
import { createTelegramBot } from './channels/telegram.js';
import type { LunarConfig } from '@lunar/shared';

// ---- Configuration ----

const config: LunarConfig = {
  port: parseInt(process.env.LUNAR_PORT || '3100'),
  agentId: process.env.LUNAR_AGENT || 'main',
  llm: {
    provider: 'ollama',
    model: process.env.LUNAR_MODEL || 'qwen2.5:7b',
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  },
  workspace: path.join(
    process.env.HOME || '~',
    '.lunar', 'agents', process.env.LUNAR_AGENT || 'main', 'workspace'
  ),
  dataDir: path.join(
    process.env.HOME || '~',
    '.lunar', 'agents', process.env.LUNAR_AGENT || 'main', 'data'
  ),
};

// ---- Bootstrap ----

async function main() {
  console.log('🌙 Lunar Gateway starting...');

  // 1. Memory layer
  const dbPath = path.join(config.dataDir, 'vectors.db');
  const store = new VectorStore(dbPath);
  const memoryFiles = new MemoryFiles(config.workspace);
  const indexer = new MemoryIndexer(store, memoryFiles);

  // Index existing memory files on startup
  const startIdx = Date.now();
  const totalChunks = await indexer.indexAll();
  console.log(`  📚 Indexed ${totalChunks} chunks in ${Date.now() - startIdx}ms`);

  // 2. Session manager
  const sessions = new SessionManager(config.dataDir);

  // 3. Tools
  const tools = getTools({ store, memoryFiles, indexer, workspace: config.workspace });

  // 4. Agent engine
  const agent = createAgentEngine({
    llm: config.llm,
    tools,
    sessions,
    store,
    systemPrompt: buildSystemPrompt(config),
  });

  // 5. Fastify server
  const app = Fastify({ logger: false });
  await app.register(cors);
  await app.register(websocket);

  // ---- Routes ----

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    agent: config.agentId,
    model: config.llm.model,
    uptime: process.uptime(),
  }));

  // HTTP chat endpoint (for testing / external integrations)
  app.post('/api/chat', async (req, reply) => {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };
    const sid = sessionId || `api-${Date.now()}`;
    const response = await agent.chat(message, sid, 'api');
    return { response, sessionId: sid };
  });

  // WebSocket chat (for UI)
  app.register(async function (fastify) {
    fastify.get('/ws/chat', { websocket: true }, createWebChatHandler(agent, sessions));
  });

  // ---- Start channels ----

  // Telegram (if token available)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const bot = createTelegramBot(agent, sessions, process.env.TELEGRAM_BOT_TOKEN);
    bot.start();
    console.log('  🤖 Telegram bot started');
  }

  // ---- Listen ----

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`  🌐 Gateway listening on http://localhost:${config.port}`);
  console.log(`  📡 WebSocket: ws://localhost:${config.port}/ws/chat`);
  console.log(`  ❤️  Health: http://localhost:${config.port}/api/health`);
  console.log('🌙 Lunar is ready!\n');
}

// ---- System Prompt ----

function buildSystemPrompt(config: LunarConfig): string {
  return `You are Lunar, a helpful AI assistant.
You have access to a personal workspace and memory system.

WORKSPACE: ${config.workspace}
TODAY: ${new Date().toISOString().split('T')[0]}

CAPABILITIES:
- Search your memory with memory_search
- Save important information with memory_write
- Read/write files in the workspace
- Run bash commands

GUIDELINES:
- For factual questions about the user → search memory first
- When user tells you something personal → save to permanent memory
- For tasks, meetings, etc. → save to daily notes
- Always ground your answers in memory search results when available
- Be concise and helpful`;
}

main().catch((err) => {
  console.error('❌ Gateway failed to start:', err);
  process.exit(1);
});
```

### Step 3: Package.json Scripts (10 minutes)

Root `package.json`:

```json
{
  "scripts": {
    "dev": "pnpm --filter @lunar/gateway dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  }
}
```

Gateway `packages/gateway/package.json`:

```json
{
  "name": "@lunar/gateway",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@lunar/agent": "workspace:*",
    "@lunar/memory": "workspace:*",
    "@lunar/tools": "workspace:*",
    "@lunar/shared": "workspace:*",
    "fastify": "^5.0.0",
    "@fastify/websocket": "^10.0.0",
    "@fastify/cors": "^9.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

### Step 4: Verify Integration (15 minutes)

```bash
# Start Lunar
pnpm dev

# Expected output:
# 🌙 Lunar Gateway starting...
#   📚 Indexed 12 chunks in 340ms
#   🌐 Gateway listening on http://localhost:3100
#   📡 WebSocket: ws://localhost:3100/ws/chat
#   ❤️  Health: http://localhost:3100/api/health
# 🌙 Lunar is ready!

# Test health endpoint
curl http://localhost:3100/api/health
# {"status":"ok","agent":"main","model":"qwen2.5:7b","uptime":5.2}

# Test HTTP chat
curl -X POST http://localhost:3100/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello! My name is Hao."}'
# {"response":"Hello Hao! Nice to meet you...","sessionId":"api-1234567890"}

# Test WebSocket (use wscat or browser)
npx wscat -c ws://localhost:3100/ws/chat
> {"type":"message","content":"What is your name?"}
< {"type":"message","content":"I'm Lunar, your AI assistant!"}
```

---

## 📚 CONCEPT 3: Week 4 Architecture Checkpoint

### The Full Picture After 20 Days

```
                     ┌─────────────────────────┐
                     │      USER CHANNELS       │
                     │  CLI  Telegram  WebChat  │
                     └────────┬────────────────┘
                              │
                     ┌────────▼────────┐
                     │    GATEWAY       │  ← Day 20
                     │  (Fastify 5)    │
                     │  port 3100      │
                     └────────┬────────┘
                              │
                 ┌────────────▼────────────┐
                 │      AGENT ENGINE       │  ← Days 7-9
                 │  while(true) {          │
                 │    response = llm.chat()│
                 │    if (tool_call)       │
                 │      execute(tool)      │
                 │    else                 │
                 │      return response    │
                 │  }                      │
                 └─────┬───────────┬───────┘
                       │           │
              ┌────────▼──┐   ┌───▼──────────┐
              │   TOOLS   │   │   SESSIONS   │  ← Day 16
              │ memory_*  │   │  JSONL logs  │
              │ bash      │   └──────────────┘
              │ readFile  │
              └────────┬──┘
                       │
          ┌────────────▼────────────┐
          │     MEMORY SYSTEM       │
          │                         │
          │  VectorStore (SQLite)   │  ← Day 12
          │  Hybrid Search          │  ← Day 13
          │  Temporal Decay + MMR   │  ← Day 15
          │  MemoryFiles (Markdown) │  ← Day 19
          │  Auto-Indexer           │  ← Day 19
          └─────────────────────────┘
```

### What You've Built in 20 Days

| Component | Package | Days |
|---|---|---|
| LLM Client | `@lunar/llm` | 1-5 |
| Agent Loop | `@lunar/agent` | 6-10 |
| Chunking + Embeddings | `@lunar/memory` | 11 |
| Vector Store | `@lunar/memory` | 12 |
| Hybrid Search | `@lunar/memory` | 13 |
| RAG Pipeline | `@lunar/agent` | 14 |
| Score Tuning | `@lunar/memory` | 15 |
| Sessions | `@lunar/memory` | 16 |
| Telegram Bot | `@lunar/gateway` | 17 |
| WebChat | `@lunar/gateway` | 18 |
| Memory Files | `@lunar/memory` | 19 |
| Gateway | `@lunar/gateway` | 20 |

---

## ✅ CHECKLIST

- [ ] Gateway starts with `pnpm dev`
- [ ] Health endpoint returns status
- [ ] HTTP /api/chat works
- [ ] WebSocket /ws/chat works
- [ ] Telegram bot starts if token is set
- [ ] All memory is shared between channels
- [ ] Can have a full conversation with memory persistence

---

## 💡 KEY TAKEAWAY

**The Gateway is the glue. It creates all dependencies once (store, memory, sessions, tools, agent) and passes them to each channel. One process, one database, all channels share the same brain. You now have a complete AI agent running locally!**

---

## 🏆 PHASE 1 COMPLETE!

**You've built a working AI Agent from scratch in 20 days:**
- ✅ Talks to local LLMs via Ollama
- ✅ Calls tools (bash, files, memory)
- ✅ Searches memory with hybrid BM25 + vector search
- ✅ Remembers facts permanently and daily notes with decay
- ✅ Accessible via CLI, Telegram, and WebChat
- ✅ All in TypeScript, zero cloud cost

**Next Phase → Python + Evaluation + Docker + Cloud + MCP**

---

**Next → [Day 21: Python Crash Course](../../phase-2-production/week-05-python-eval/day-21.md)**
