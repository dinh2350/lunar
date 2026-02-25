# Lunar — System Architecture

> **Project:** Lunar  
> **Version:** 1.0  
> **Date:** 2026-02-21  
> **Constraint:** Cost = $0 — all components are self-hosted or use free tiers  
> **Reference BRD:** [business-requirements.md](../plan/business-requirements.md)

---

## Table of Contents

1. [Zero-Cost Technology Stack](#1-zero-cost-technology-stack)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Component Architecture](#3-component-architecture)
   - 3.1 [Gateway Service](#31-gateway-service)
   - 3.2 [Agent Engine](#32-agent-engine)
   - 3.3 [Channel Connectors](#33-channel-connectors)
   - 3.4 [Memory System](#34-memory-system)
   - 3.5 [Tool Executor](#35-tool-executor)
   - 3.6 [Skills System](#36-skills-system)
   - 3.7 [Control UI](#37-control-ui)
   - 3.8 [Nodes System](#38-nodes-system)
4. [Data Architecture](#4-data-architecture)
5. [LLM & Embedding Strategy (Zero Cost)](#5-llm--embedding-strategy-zero-cost)
6. [Directory Structure](#6-directory-structure)
7. [API Design](#7-api-design)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [Security Architecture](#9-security-architecture)
10. [Technology Decision Matrix](#10-technology-decision-matrix)
11. [Use Case Coverage](#11-use-case-coverage)

---

## 1. Zero-Cost Technology Stack

All components selected are either **self-hosted open-source** or **free-tier** services.

### 1.1 Core Runtime

| Layer | Technology | License / Cost | Why |
|---|---|---|---|
| Runtime | **Node.js 22 LTS** | MIT / Free | Native async, excellent WebSocket, huge ecosystem |
| Language | **TypeScript 5** | Apache-2 / Free | Type safety, better DX |
| Package Manager | **pnpm** | MIT / Free | Fast, disk-efficient |
| Process Manager | **PM2** | AGPL / Free | Service supervision, auto-restart, log management |
| Monorepo | **pnpm workspaces** | Free | Single repo, multiple packages |

### 1.2 LLM Providers (Zero Cost)

| Provider | Free Tier | Model Examples | Notes |
|---|---|---|---|
| **Ollama** (self-hosted) | Unlimited (local) | Llama 3.3, Qwen2.5, Mistral, Gemma3, DeepSeek-R1 | Primary; runs on user's machine |
| **Google Gemini** | 15 RPM / 1M tokens/day | gemini-2.0-flash, gemini-1.5-flash | Best free cloud fallback |
| **Groq** | 14,400 req/day | llama-3.3-70b, mixtral-8x7b | Fast inference, generous free tier |
| **OpenRouter** | Some free models | deepseek, qwen, llama (free tag) | Aggregator with free model access |
| **Anthropic / OpenAI** | Bring-your-own-key | Claude, GPT-4o | Optional; user supplies key |

### 1.3 Embedding Providers (Zero Cost)

| Provider | Free Tier | Model | Notes |
|---|---|---|---|
| **Ollama** (self-hosted) | Unlimited (local) | `nomic-embed-text`, `mxbai-embed-large` | Primary embedding; fully offline |
| **Google Gemini** | Free tier | `gemini-embedding-001` | Cloud fallback |
| **Transformers.js** | Local / Free | All-MiniLM-L6-v2 (WASM) | Pure JS, no binary dependency |

### 1.4 Data & Storage

| Purpose | Technology | Cost | Notes |
|---|---|---|---|
| Session transcripts | **JSONL files** (disk) | Free | Human-readable, append-only |
| Session index | **SQLite** (better-sqlite3) | Free | Fast key-value store for session metadata |
| Vector memory index | **SQLite + sqlite-vec** | Free | Local ANN search, no external DB needed |
| Memory files | **Markdown** (disk) | Free | Plain text, git-friendly |
| Config | **JSON5** (disk) | Free | Comments allowed, human-editable |
| Cron state | **SQLite** | Free | Job history and next-run tracking |

### 1.5 Channel Connectors

| Channel | Library | Cost | Milestone |
|---|---|---|---|
| Telegram | **grammY** (MIT) | Free Bot API | v1.0 |
| Discord | **discord.js** (Apache-2) | Free Bot API | v1.0 |
| WhatsApp | **Baileys** (MIT) | Free — uses WhatsApp Web protocol | v1.0 |
| iMessage (macOS) | **imsg CLI** (open-source) | Free — local macOS bridge | v1.0 |
| iMessage (cross-platform) | **BlueBubbles** HTTP bridge | Free — works without macOS | v1.1 |
| WebChat (built-in) | Built-in (Next.js) | Free | v1.0 |
| Slack | **@slack/bolt** (MIT) | Free Bot API | v1.1 |
| Signal | **signal-cli** (AGPL) | Free | v1.1 |
| Mattermost | **@mattermost/client** (Apache-2) | Free Bot API | v2.0 |

### 1.6 Web & APIs

| Purpose | Technology | Cost |
|---|---|---|
| HTTP server | **Fastify 5** | MIT / Free |
| WebSocket | **ws** library | MIT / Free |
| Control UI | **Next.js 14** + **shadcn/ui** | MIT / Free |
| UI State | **Zustand** | MIT / Free |
| API types | **Zod** | MIT / Free |

### 1.7 Browser Automation

| Tool | Cost | Notes |
|---|---|---|
| **Playwright** (Chromium) | Apache-2 / Free | Headless browser for `browser_*` tools |

### 1.8 Tunnel / Remote Access (Zero Cost)

| Tool | Free Tier | Notes |
|---|---|---|
| **Cloudflare Tunnel** (cloudflared) | Free (unlimited) | Expose gateway to internet without open ports |
| **Tailscale** | Free (up to 100 devices) | Zero-config mesh VPN for remote access |
| **ngrok** | Free tier (1 tunnel) | Alternative for webhook receiving |

### 1.9 Development & Build

| Tool | Cost |
|---|---|
| **tsx** (TypeScript runner) | Free |
| **tsup** (bundler) | Free |
| **Vitest** (testing) | Free |
| **ESLint + Prettier** | Free |
| **Docker** (optional, sandbox) | Free |

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER DEVICES                                │
│                                                                     │
│   [Telegram]  [Discord]  [WhatsApp]  [iMessage]  [Browser/WebChat] │
└──────┬────────────┬──────────┬────────────┬──────────────┬──────────┘
       │            │          │            │              │
       │  (Bot API) │(Bot API) │(WA Web)    │ (imsg CLI)   │ (HTTP)
       ▼            ▼          ▼            ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LUNAR GATEWAY  :18789                          │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐   │
│  │  Channel Connectors  │   │  WebSocket RPC + HTTP API        │   │
│  │  (grammY / discord.js│   │  (Fastify + ws)                  │   │
│  │  / Baileys / imsg)   │   │  Control UI (:18789/ui)          │   │
│  └──────────┬───────────┘   └──────────────────────────────────┘   │
│             │ Normalized Envelope                                   │
│             ▼                                                       │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐   │
│  │   Message Router     │   │  Cron Scheduler  (node-cron)     │   │
│  │   (session resolve,  │◄──┤  Webhook Handler (/hook/:uuid)   │   │
│  │   agent dispatch)    │   │  Heartbeat Engine                │   │
│  └──────────┬───────────┘   └──────────────────────────────────┘   │
│             │                                                       │
│             ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      AGENT ENGINE                            │  │
│  │                                                              │  │
│  │  Context Builder → LLM Client → Tool Executor → Reply Sink  │  │
│  │       │                │              │                      │  │
│  │  [Memory]     [Ollama / Gemini]  [Bash / Browser / FS]      │  │
│  │  [Skills]     [Groq / OpenRouter] [memory_* tools]          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│             │                                                       │
│             ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    STORAGE LAYER                             │  │
│  │                                                              │  │
│  │  ~/.lunar/                                                   │  │
│  │  ├── agents/<id>/sessions/sessions.json                      │  │
│  │  ├── agents/<id>/sessions/<sessionId>.jsonl                  │  │
│  │  ├── agents/<id>/workspace/MEMORY.md                        │  │
│  │  ├── agents/<id>/workspace/memory/YYYY-MM-DD.md             │  │
│  │  ├── agents/<id>/workspace/skills/                          │  │
│  │  ├── memory/<agentId>.sqlite  (vector index)                │  │
│  │  └── lunar.json               (config)                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────┐          ┌───────────────────────┐
│  LOCAL LLM      │          │  CLOUD LLM (optional) │
│  Ollama         │          │  Gemini Free Tier      │
│  (Llama3/Qwen/  │          │  Groq Free Tier        │
│   Mistral/...)  │          │  OpenRouter Free       │
└─────────────────┘          └───────────────────────┘
```

---

## 3. Component Architecture

### 3.1 Gateway Service

The gateway is the root process. It starts all subsystems and owns the message lifecycle.

```
packages/gateway/
├── src/
│   ├── index.ts              ← entry point; starts all subsystems
│   ├── server.ts             ← Fastify + WebSocket server setup
│   ├── router.ts             ← inbound message router + bindings[] dispatch
│   ├── bindings/
│   │   ├── resolver.ts       ← evaluate bindings[] priority tiers
│   │   └── schema.ts         ← Zod schema for bindings config
│   ├── rpc/
│   │   ├── protocol.ts       ← WebSocket RPC message types
│   │   ├── handler.ts        ← RPC method dispatch
│   │   └── session-rpc.ts    ← sessions.list, sessions.reset, etc.
│   ├── devices/
│   │   ├── registry.ts       ← SQLite store: deviceId → token + role + approved
│   │   ├── handshake.ts      ← validate device identity on WS connect
│   │   └── pairing-rpc.ts    ← devices.list, devices.approve, devices.reject
│   ├── canvas/
│   │   ├── routes.ts         ← GET /__lunar__/canvas/* and /__lunar__/a2ui/*
│   │   └── host.ts           ← serve canvas HTML/CSS/JS; handle A2UI payloads
│   ├── slash/
│   │   └── handler.ts        ← /stop, /subagents, /exec slash command parser
│   ├── config/
│   │   ├── loader.ts         ← JSON5 config file reader + watcher
│   │   ├── schema.ts         ← Zod config schema
│   │   └── reload.ts         ← hot/restart reload logic
│   ├── health/
│   │   ├── endpoint.ts       ← GET /health
│   │   └── doctor.ts         ← config audit checks
│   └── daemon/
│       ├── launchd.ts        ← macOS launchd plist install
│       ├── systemd.ts        ← Linux systemd unit install
│       └── lock.ts           ← prevent duplicate gateway starts
```

**Startup sequence:**
```
1. Load + validate config (JSON5 + Zod)
2. Acquire gateway lock (prevent duplicate starts)
3. Initialize storage (SQLite, file dirs, devices.sqlite)
4. Start agent engine(s)
5. Start channel connectors (async)
6. Start cron scheduler
7. Start node registry (accept node WS connects)
8. Start Fastify HTTP + WebSocket server (canvas routes + API)
9. Emit "ready" health state
```

### 3.2 Agent Engine

The agent engine assembles context and drives the LLM ↔ tool execution loop.

```
packages/agent/
├── src/
│   ├── agent.ts              ← Agent class; owns one workspace + LLM config
│   ├── runner.ts             ← executes a single agent turn
│   ├── context-builder.ts    ← assembles system prompt + messages array
│   │                            (loads AGENTS.md, SOUL.md, USER.md, IDENTITY.md,
│   │                             HEARTBEAT.md, BOOTSTRAP.md, TOOLS.md, MEMORY.md)
│   ├── skill-injector.ts     ← loads + filters skills, builds XML block
│   ├── tool-loop.ts          ← LLM streaming + tool call execution loop
│   ├── subagent/
│   │   ├── spawner.ts        ← create child session key, enqueue background run
│   │   ├── announce.ts       ← post result summary back to requester channel
│   │   ├── concurrency.ts    ← maxConcurrent lane cap per agent
│   │   └── cascade.ts        ← cascade stop to all child sessions
│   ├── compaction/
│   │   ├── pruner.ts         ← trims old tool results from context
│   │   ├── compactor.ts      ← summarizes older turns (auto-compact)
│   │   └── memory-flush.ts   ← pre-compaction silent memory flush
│   └── llm/
│       ├── client.ts         ← unified LLM client interface
│       ├── ollama.ts         ← Ollama provider (primary, local)
│       ├── gemini.ts         ← Google Gemini provider (free tier)
│       ├── groq.ts           ← Groq provider (free tier)
│       ├── openrouter.ts     ← OpenRouter provider (free models)
│       └── openai-compat.ts  ← generic OpenAI-compatible API adapter
```

**Agent turn flow:**
```typescript
async function runTurn(session: Session, message: InboundMessage): Promise<Reply> {
  const context = await contextBuilder.build(session, message);
  // context = { systemPrompt, messages[], tools[] }

  let messages = context.messages;
  while (true) {
    const response = await llm.stream(context.systemPrompt, messages, context.tools);
    if (response.type === 'message') return response;           // done
    if (response.type === 'tool_call') {
      const result = await toolExecutor.run(response.toolCall); // execute
      messages = [...messages, response.raw, toolResultMsg(result)];
    }
  }
}
```

### 3.3 Channel Connectors

Each connector is an independent module that normalizes messages into `InboundEnvelope` objects.

```
packages/connectors/
├── src/
│   ├── base.ts               ← BaseConnector abstract class
│   ├── telegram/
│   │   ├── connector.ts      ← grammY bot setup
│   │   ├── media.ts          ← photo/audio/document handling
│   │   └── topics.ts         ← forum topic session isolation
│   ├── discord/
│   │   ├── connector.ts      ← discord.js client setup
│   │   └── threads.ts        ← thread session isolation
│   ├── whatsapp/
│   │   ├── connector.ts      ← Baileys connection manager
│   │   ├── auth.ts           ← QR code / multi-device auth
│   │   └── media.ts          ← media download + upload
│   ├── imessage/
│   │   └── connector.ts      ← imsg CLI wrapper (macOS)
│   ├── bluebubbles/
│   │   └── connector.ts      ← BlueBubbles HTTP bridge (cross-platform iMessage)
│   ├── slack/
│   │   └── connector.ts      ← @slack/bolt Events API + Bot Token
│   ├── signal/
│   │   └── connector.ts      ← signal-cli / signald bridge
│   ├── mattermost/
│   │   └── connector.ts      ← @mattermost/client WebSocket connector
│   └── webchat/
│       └── connector.ts      ← WebSocket-based built-in chat
```

**InboundEnvelope (normalized message):**
```typescript
interface InboundEnvelope {
  provider: 'telegram' | 'discord' | 'whatsapp' | 'imessage' | 'bluebubbles'
          | 'slack' | 'signal' | 'mattermost' | 'webchat';
  peerId: string;
  chatType: 'direct' | 'group' | 'channel' | 'thread';
  accountId?: string;           // which account instance (for multi-account channels)
  guildId?: string;             // Discord server id
  teamId?: string;              // Slack workspace id
  roles?: string[];             // Discord member roles (for role-based routing)
  text: string;
  media?: MediaAttachment[];
  conversationLabel?: string;
  threadId?: string;
  raw: unknown; // original provider payload
}

interface MediaAttachment {
  type: 'image' | 'audio' | 'document' | 'video';
  mimeType: string;
  url?: string;
  base64?: string;  // populated for vision LLM calls
  filePath?: string;
}
```

### 3.4 Memory System

```
packages/memory/
├── src/
│   ├── manager.ts            ← Memory facade: read/write/search
│   ├── markdown/
│   │   ├── reader.ts         ← MEMORY.md + daily log file reader
│   │   └── writer.ts         ← append/update Markdown files
│   ├── index/
│   │   ├── indexer.ts        ← chunk + embed Markdown files
│   │   ├── chunker.ts        ← 400-token chunks, 80-token overlap
│   │   ├── sqlite-store.ts   ← SQLite + sqlite-vec vector store
│   │   └── watcher.ts        ← fs.watch debounced re-index trigger
│   ├── search/
│   │   ├── hybrid.ts         ← BM25 + vector weighted merge
│   │   ├── bm25.ts           ← SQLite FTS5 BM25 implementation
│   │   ├── vector.ts         ← cosine similarity / sqlite-vec ANN
│   │   ├── decay.ts          ← temporal exponential decay
│   │   └── mmr.ts            ← Maximal Marginal Relevance re-rank
│   └── embeddings/
│       ├── provider.ts       ← auto-select embedding provider
│       ├── ollama.ts         ← Ollama nomic-embed-text (primary)
│       ├── gemini.ts         ← Gemini embedding (free fallback)
│       └── transformers.ts   ← Transformers.js WASM (offline fallback)
```

**Memory search pipeline:**
```
Query string
    │
    ├──▶ BM25 (FTS5) top-K candidates
    ├──▶ Vector (ANN) top-K candidates
    │
    ▼
Weighted merge (vector 70% + BM25 30%)
    │
    ▼
Temporal decay (if enabled, half-life 30d)
    │
    ▼
MMR re-ranking (if enabled, λ=0.7)
    │
    ▼
Top-N results → agent context
```

### 3.5 Tool Executor

```
packages/tools/
├── src/
│   ├── executor.ts           ← Tool dispatch + per-agent policy resolution
│   ├── approval.ts           ← allow / ask (send confirm to user) / deny
│   ├── sandbox.ts            ← Docker sandbox (global + per-agent mode/scope)
│   ├── bash/
│   │   └── tool.ts           ← shell command execution (child_process)
│   ├── filesystem/
│   │   ├── read.ts           ← fs_read
│   │   ├── write.ts          ← fs_write
│   │   └── list.ts           ← fs_list
│   ├── browser/
│   │   ├── tool.ts           ← Playwright Chromium launcher
│   │   ├── navigate.ts       ← browser_navigate
│   │   ├── extract.ts        ← browser_extract (DOM → structured)
│   │   ├── fill.ts           ← browser_fill (forms)
│   │   └── profile.ts        ← persistent Playwright context per platform
│   ├── session/
│   │   ├── spawn-tool.ts     ← sessions_spawn (launch sub-agent)
│   │   ├── history-tool.ts   ← sessions_history (read another session's transcript)
│   │   ├── list-tool.ts      ← sessions_list
│   │   ├── send-tool.ts      ← sessions_send (post to another session)
│   │   └── status-tool.ts    ← session_status
│   ├── nodes/
│   │   └── tool.ts           ← invoke node commands (canvas.*, camera.*, system.run)
│   └── memory/
│       ├── search-tool.ts    ← memory_search wrapper
│       ├── get-tool.ts       ← memory_get wrapper
│       └── write-tool.ts     ← memory_write wrapper
```

**Tool execution contract:**
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  approval: 'allow' | 'ask' | 'deny';
  execute(params: unknown, ctx: ToolContext): Promise<ToolResult>;
}
```

### 3.6 Skills System

```
packages/skills/
├── src/
│   ├── loader.ts             ← scan skill directories, parse SKILL.md
│   ├── gating.ts             ← filter by bins/env/config/os requirements
│   ├── injector.ts           ← build XML block for system prompt
│   ├── snapshot.ts           ← session-start snapshot + hot-reload
│   ├── watcher.ts            ← SKILL.md file watcher for hot-reload
│   └── clawhub-compat.ts     ← AgentSkills spec parser
├── bundled/                  ← shipped bundled skills
│   ├── google-calendar/SKILL.md
│   ├── gmail/SKILL.md
│   ├── github/SKILL.md
│   ├── browser/SKILL.md
│   ├── file-manager/SKILL.md
│   ├── reminder/SKILL.md
│   ├── weather/SKILL.md
│   └── notes/SKILL.md
```

**Skills prompt injection format:**
```xml
<available_skills>
  <skill>
    <name>google-calendar</name>
    <description>View and manage Google Calendar events</description>
    <location>/home/user/.lunar/skills/google-calendar</location>
  </skill>
</available_skills>
```

### 3.7 Control UI

```
packages/ui/
├── app/                      ← Next.js 14 app router
│   ├── layout.tsx
│   ├── page.tsx              ← Dashboard overview
│   ├── chat/[agentId]/
│   │   └── page.tsx          ← Chat interface
│   ├── sessions/
│   │   └── page.tsx          ← Session inspector
│   ├── skills/
│   │   └── page.tsx          ← Skills manager
│   ├── memory/
│   │   └── page.tsx          ← Memory browser
│   ├── cron/
│   │   └── page.tsx          ← Cron job manager
│   └── nodes/
│       └── page.tsx          ← Node list, pairing approval, invoke commands
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx    ← message stream
│   │   ├── MessageBubble.tsx
│   │   └── ToolCallCard.tsx  ← shows live tool execution
│   ├── dashboard/
│   │   ├── GatewayStatus.tsx
│   │   ├── AgentCard.tsx
│   │   └── ChannelStatus.tsx
│   ├── nodes/
│   │   ├── NodeCard.tsx      ← per-node status + capabilities
│   │   └── PairingRequest.tsx← approve/reject pending device pairs
│   └── ui/                   ← shadcn/ui components
├── lib/
│   ├── gateway-client.ts     ← WebSocket RPC client
│   └── store.ts              ← Zustand state
```

---

### 3.8 Nodes System

A **node** is a companion device (macOS, iOS, Android, or headless Linux/Windows) that connects to the Gateway WebSocket with `role: "node"` and exposes a device command surface via `node.invoke`.

```
packages/nodes/
├── src/
│   ├── registry.ts       ← connected node list (in-memory + SQLite)
│   ├── protocol.ts       ← node WS connect frame (role: "node", caps, commands)
│   ├── invoker.ts        ← gateway → node.invoke RPC bridge
│   ├── pairing.ts        ← per-device token approval store
│   └── exec-approvals.ts ← per-node exec allowlist (~/.lunar/exec-approvals.json)
```

**Node command surface:**

| Command | Platform | Description |
|---|---|---|
| `canvas.present` | iOS / Android / macOS | Load URL or local file in WebView |
| `canvas.navigate` | iOS / Android / macOS | Navigate to URL |
| `canvas.eval` | iOS / Android / macOS | Execute JS inside WebView |
| `canvas.snapshot` | iOS / Android / macOS | Capture PNG/JPG screenshot |
| `canvas.a2ui` | iOS / Android / macOS | Push A2UI JSONL payload |
| `camera.snap` | iOS / Android | Take photo (front/rear) |
| `camera.clip` | iOS / Android | Record video clip (mp4, ≤60s) |
| `screen.record` | iOS / Android / macOS | Screen recording (mp4, ≤60s) |
| `location.get` | iOS / Android | GPS coordinates |
| `sms.send` | Android | Send SMS via telephony |
| `system.run` | macOS / Headless | Execute shell command |
| `system.notify` | macOS / iOS | System notification |

**Node pairing flow:**
```
Node connects → sends { role: "node", deviceId, caps, commands }
        │
        ▼
Gateway checks device registry
  Unknown deviceId → create pairing request; notify Control UI
  Known + approved → issue session token; node is live
  Loopback origin  → auto-approve (if nodes.pairing.autoApproveLoopback: true)
```

**CLI:**
```bash
lunar nodes list
lunar nodes pending
lunar nodes approve <requestId>
lunar nodes reject <requestId>
lunar nodes invoke --node <id> --command canvas.snapshot
```

---

## 4. Data Architecture

### 4.1 File System Layout

```
~/.lunar/
├── lunar.json                          ← main config (JSON5)
├── devices.sqlite                      ← device pairing store
├── browser-profiles/                   ← persistent Playwright contexts
│   ├── youtube/
│   ├── facebook/
│   ├── instagram/
│   ├── twitter/
│   └── linkedin/
├── skills/                             ← user-global managed skills
│   └── <skill-name>/SKILL.md
├── agents/
│   └── <agentId>/                      ← one directory per agent
│       ├── agent.json                  ← agent-specific config + sandbox/tools overrides
│       ├── workspace/
│       │   ├── AGENTS.md               ← core instructions + tool policies
│       │   ├── SOUL.md                 ← persona, tone, identity rules
│       │   ├── USER.md                 ← user-provided self-context
│       │   ├── IDENTITY.md             ← agent name/identity block
│       │   ├── HEARTBEAT.md            ← cron/proactive turn instructions
│       │   ├── BOOTSTRAP.md            ← session-start setup instructions
│       │   ├── TOOLS.md                ← custom tool guidance for system prompt
│       │   ├── MEMORY.md               ← long-term memory
│       │   ├── memory/
│       │   │   ├── 2026-02-21.md       ← daily log (today)
│       │   │   ├── 2026-02-20.md       ← daily log (yesterday)
│       │   │   └── projects.md         ← named topic file
│       │   └── skills/                 ← agent-specific skills
│       └── sessions/
│           ├── sessions.json           ← session store map
│           ├── <sessionId>.jsonl       ← conversation transcript
│           ├── <sessionId>-topic-<threadId>.jsonl
│           └── <sessionId>-subagent-<uuid>.jsonl  ← sub-agent transcript
├── memory/
│   └── <agentId>.sqlite                ← vector index
└── cron/
    └── history.sqlite                  ← cron execution history
```

### 4.2 sessions.json Schema

```json
{
  "agent:main:main": {
    "sessionId": "ses_abc123",
    "updatedAt": "2026-02-21T08:30:00Z",
    "inputTokens": 12400,
    "outputTokens": 3200,
    "totalTokens": 15600,
    "contextTokens": 8900,
    "origin": {
      "label": "Minh's Telegram DM",
      "provider": "telegram",
      "from": "user:123456789"
    }
  }
}
```

### 4.3 Session Transcript JSONL

Each line in `.jsonl` is one of:
```jsonl
{"type":"user","content":"What's on my calendar today?","ts":"2026-02-21T08:30:00Z"}
{"type":"tool_call","name":"google-calendar","params":{"date":"today"},"ts":"2026-02-21T08:30:01Z"}
{"type":"tool_result","name":"google-calendar","result":"...","ts":"2026-02-21T08:30:02Z"}
{"type":"assistant","content":"You have 3 events today...","ts":"2026-02-21T08:30:03Z","tokens":{"input":1200,"output":85}}
```

### 4.4 SQLite Schema (Vector Index)

```sql
-- chunks table
CREATE TABLE chunks (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  token_count INTEGER,
  file_mtime  INTEGER,        -- for temporal decay
  created_at  INTEGER DEFAULT (unixepoch())
);

-- FTS5 for BM25
CREATE VIRTUAL TABLE chunks_fts USING fts5(content, content=chunks, content_rowid=rowid);

-- sqlite-vec virtual table for ANN search
CREATE VIRTUAL TABLE chunks_vec USING vec0(
  chunk_id TEXT,
  embedding FLOAT[768]  -- nomic-embed-text dimension
);

-- embeddings cache
CREATE TABLE embedding_cache (
  content_hash TEXT PRIMARY KEY,
  model        TEXT NOT NULL,
  embedding    BLOB NOT NULL,
  created_at   INTEGER DEFAULT (unixepoch())
);
```

### 4.5 Config Schema (lunar.json)

```json5
{
  // Gateway
  gateway: {
    port: 18789,
    bind: "loopback",      // "loopback" | "network"
    auth: { token: "..." },
    reload: { mode: "hybrid" },
    tls: { enabled: false }  // optional TLS + fingerprint pinning
  },

  // LLM providers
  models: {
    default: "ollama/llama3.3",      // FREE: local Ollama
    vision:  "ollama/llava:13b",     // vision model for image analysis
    providers: {
      ollama:     { baseUrl: "http://localhost:11434" },
      gemini:     { apiKey: "..." },  // free tier
      groq:       { apiKey: "..." },  // free tier
      openrouter: { apiKey: "..." }   // free models available
    }
  },

  // Agents
  agents: {
    defaults: {
      workspace: "~/.lunar/workspace",
      memorySearch: { provider: "ollama", model: "nomic-embed-text" },
      compaction: { reserveTokensFloor: 20000 },
      toolResultMaxTokens: 4000,   // truncate/summarize oversized tool results
      subagents: {
        maxSpawnDepth: 1,          // 1 = leaf only; 2 = orchestrator pattern
        maxChildrenPerAgent: 5,
        maxConcurrent: 8,
        archiveAfterMinutes: 60
      }
    },
    list: [
      {
        id: "main",
        name: "Lunar",
        // persona is now SOUL.md in workspace; this field is legacy/override
        persona: "You are Lunar...",
        sandbox: { mode: "off" },   // per-agent: "off" | "all"
        tools: {
          // per-agent allow/deny overrides (deny wins)
          // allow: ["read", "memory_search"],
          // deny:  ["bash", "browser"]
        }
      }
    ]
  },

  // Message routing — deterministic, most-specific-first
  // Replaces session.dmScope for multi-agent setups
  bindings: [
    // { agentId: "work",   match: { channel: "whatsapp", accountId: "biz" } },
    // { agentId: "family", match: { channel: "whatsapp", peer: { kind: "group", id: "120363...@g.us" } } },
    { agentId: "main",   match: { channel: "whatsapp" } },
    { agentId: "main",   match: { channel: "telegram" } }
  ],

  // Session (legacy single-agent routing; superseded by bindings[])
  session: {
    dmScope: "main",
    reset: { mode: "daily", atHour: 4 }
  },

  // Channels (enable as needed; supports multiple accounts per channel)
  channels: {
    telegram: {
      accounts: {
        default: { botToken: "...", dmPolicy: "pairing" }
      }
    },
    discord:  { enabled: false, token: "..." },
    whatsapp: {
      accounts: {
        personal: {},
        // biz: {}
      },
      dmPolicy: "allowlist",
      allowFrom: []
    }
  },

  // Browser persistent profiles (used by browser_* tools for logged-in platforms)
  browser: {
    profiles: {
      youtube:   { profileDir: "~/.lunar/browser-profiles/youtube" },
      facebook:  { profileDir: "~/.lunar/browser-profiles/facebook" },
      instagram: { profileDir: "~/.lunar/browser-profiles/instagram" },
      twitter:   { profileDir: "~/.lunar/browser-profiles/twitter" },
      linkedin:  { profileDir: "~/.lunar/browser-profiles/linkedin" }
    }
  },

  // Nodes
  nodes: {
    pairing: { autoApproveLoopback: true },
    exec: { security: "ask" }  // "ask" | "allowlist" | "full"
  },

  // Tools (global policies; per-agent overrides in agents.list[].tools)
  tools: {
    agentToAgent: { enabled: false, allow: [] }
  },

  // Cron
  cron: {
    jobs: [
      { id: "morning-briefing", schedule: "0 8 * * *", prompt: "Morning briefing..." }
    ]
  }
}
```

---

## 5. LLM & Embedding Strategy (Zero Cost)

### 5.1 LLM Provider Priority (Default)

```
User message arrives
        │
        ▼
1st: Ollama (local)          ──▶ FREE, unlimited, private
        │ (if not running / model not found)
        ▼
2nd: Google Gemini free tier ──▶ FREE, 15 RPM / 1M tokens/day
        │ (if rate-limited)
        ▼
3rd: Groq free tier          ──▶ FREE, 14,400 req/day, very fast
        │ (if rate-limited)
        ▼
4th: OpenRouter free models  ──▶ FREE models: deepseek, qwen, llama
        │ (if no free models available)
        ▼
5th: Error — prompt user to configure LLM
```

### 5.2 Recommended Local Models (Ollama)

| Use Case | Model | Size | Quality |
|---|---|---|---|
| General assistant | `llama3.3:70b-instruct-q4` | ~40 GB | Excellent |
| Low-RAM machines | `qwen2.5:7b-instruct` | ~4 GB | Good |
| Fast responses | `gemma3:4b-it` | ~2.5 GB | Acceptable |
| Coding tasks | `qwen2.5-coder:7b` | ~4 GB | Excellent for code |
| Tool use | `mistral:7b-instruct` | ~4 GB | Good tool calling |

### 5.3 Embedding Models (Ranked by Quality/Cost)

| Model | Provider | Dimensions | Cost | Notes |
|---|---|---|---|---|
| `nomic-embed-text` | Ollama (local) | 768 | Free | **Primary**; excellent quality, offline |
| `mxbai-embed-large` | Ollama (local) | 1024 | Free | Higher quality, more RAM |
| `all-minilm` | Transformers.js | 384 | Free | Pure JS/WASM, no Ollama needed |
| `gemini-embedding-001` | Google Gemini | 768 | Free tier | Cloud fallback |

### 5.4 Token Budget Management

To stay within free tier limits:

```typescript
// Groq free tier: 14,400 requests/day → ~10 req/hour
// Gemini free tier: 1M tokens/day → ~700 avg turns/day

const TOKEN_BUDGET = {
  gemini: { dailyTokens: 1_000_000, rpm: 15 },
  groq:   { dailyRequests: 14_400 }
};
```

The LLM client tracks usage and automatically falls back before hitting limits.

---

## 6. Directory Structure

### Monorepo Layout

```
lunar/                              ← root
├── package.json                    ← pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
│
├── packages/
│   ├── gateway/                    ← gateway service (router + bindings + devices + canvas)
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── agent/                      ← agent engine + LLM client + sub-agents
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── connectors/                 ← channel connectors (Telegram/Discord/WhatsApp/Signal/Slack/iMessage/BlueBubbles/Mattermost/WebChat)
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── memory/                     ← memory system + vector index
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── tools/                      ← tool executor (bash/fs/browser/session/nodes/memory)
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── skills/                     ← skills loader + injector
│   │   ├── package.json
│   │   ├── src/
│   │   └── bundled/                ← built-in SKILL.md files
│   │
│   ├── nodes/                      ← node registry + node WS protocol + invoker
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── session/                    ← session management + queue
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── cron/                       ← heartbeat scheduler
│   │   ├── package.json
│   │   └── src/
│   │
│   ├── ui/                         ← Next.js control panel
│   │   ├── package.json
│   │   └── app/
│   │
│   ├── cli/                        ← lunar CLI (install, onboard, status, nodes, devices)
│   │   ├── package.json
│   │   └── src/
│   │
│   └── shared/                     ← shared types, utils, config schema
│       ├── package.json
│       └── src/
│
├── docs/
│   ├── architechture/
│   │   └── architecture.md         ← this file
│   └── plan/
│       └── business-requirements.md
│
└── scripts/
    ├── install.sh                  ← one-liner installer
    └── dev.sh                      ← local dev startup
```

---

## 7. API Design

### 7.1 HTTP REST Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Liveness probe | None |
| `GET` | `/api/status` | Gateway status JSON | Token |
| `GET` | `/api/agents` | List all agents | Token |
| `GET` | `/api/sessions` | List sessions (query: agentId) | Token |
| `DELETE` | `/api/sessions/:sessionId` | Delete session | Token |
| `POST` | `/hook/:uuid` | Webhook trigger | Optional token |
| `GET` | `/` | Redirect to Control UI | None |
| `GET` | `/ui/*` | Next.js Control UI (static) | None |

### 7.2 WebSocket RPC Methods

| Method | Params | Response | Description |
|---|---|---|---|
| `agents.list` | `{}` | `Agent[]` | List all agents |
| `sessions.list` | `{ agentId }` | `Session[]` | List sessions for agent |
| `sessions.reset` | `{ sessionKey }` | `{ ok }` | Reset a session |
| `sessions.history` | `{ sessionKey, limit? }` | `Message[]` | Read session transcript |
| `sessions.send` | `{ sessionKey, message }` | `{ ok }` | Post message to another session |
| `sessions.spawn` | `{ agentId, task, model? }` | `{ runId, childSessionKey }` | Launch sub-agent |
| `agent.run` | `{ agentId, message, sessionKey? }` | stream | Run agent turn |
| `agent.stop` | `{ agentId, sessionKey }` | `{ ok }` | Stop running turn + cascade sub-agents |
| `cron.list` | `{}` | `CronJob[]` | List cron jobs |
| `cron.trigger` | `{ jobId }` | stream | Manually fire a cron job |
| `memory.search` | `{ agentId, query }` | `MemoryResult[]` | Search memory |
| `skills.list` | `{ agentId }` | `Skill[]` | List loaded skills |
| `devices.list` | `{}` | `Device[]` | List paired devices |
| `devices.approve` | `{ requestId }` | `{ ok }` | Approve device pairing request |
| `devices.reject` | `{ requestId }` | `{ ok }` | Reject device pairing request |
| `nodes.list` | `{}` | `Node[]` | List connected nodes |
| `nodes.invoke` | `{ nodeId, command, params }` | `{ result }` | Invoke node command |
| `gateway.status` | `{}` | `GatewayStatus` | Full status snapshot |

### 7.3 WebSocket Event Stream (Agent Run)

```typescript
// 1. Client sends:
{ type: "req", id: "r1", method: "agent.run", params: { agentId: "main", message: "hello" } }

// 2. Gateway immediately acks:
{ type: "res", id: "r1", ok: true, payload: { status: "accepted", runId: "run_xyz" } }

// 3. Streaming events:
{ type: "agent", runId: "run_xyz", event: "thinking",  delta: "" }
{ type: "agent", runId: "run_xyz", event: "token",     delta: "Hello! " }
{ type: "agent", runId: "run_xyz", event: "token",     delta: "How can I " }
{ type: "agent", runId: "run_xyz", event: "tool_start",tool: "memory_search", params: {...} }
{ type: "agent", runId: "run_xyz", event: "tool_end",  tool: "memory_search", result: {...} }
{ type: "agent", runId: "run_xyz", event: "token",     delta: "help you today?" }
{ type: "agent", runId: "run_xyz", event: "done",      status: "ok", reply: "Hello! How can I help you today?" }

// 4. Presence events (server-push):
{ type: "event", event: "presence", payload: { agentId: "main", sessionKey: "agent:main:main", status: "typing" } }
{ type: "event", event: "presence", payload: { agentId: "main", sessionKey: "agent:main:main", status: "idle" } }

// 5. Node pairing request (server-push):
{ type: "event", event: "node_pairing", payload: { requestId: "req_abc", deviceId: "dev_123", displayName: "My iPhone" } }
```

---

## 8. Infrastructure & Deployment

### 8.1 Installation (One-Liner)

```bash
curl -fsSL https://lunar.ai/install.sh | bash
# OR
npm install -g @lunar-ai/cli
```

The installer:
1. Checks Node.js ≥ 22 (installs via nvm if missing)
2. Installs `@lunar-ai/cli` globally
3. Checks for Ollama (prompts to install if missing)
4. Runs `lunar onboard`

### 8.2 Service Supervision

**macOS (launchd):**
```bash
lunar gateway install   # creates ~/Library/LaunchAgents/ai.lunar.gateway.plist
lunar gateway status
lunar gateway restart
```

**Linux (systemd):**
```bash
lunar gateway install   # creates ~/.config/systemd/user/lunar.service
systemctl --user enable lunar
systemctl --user start lunar
```

### 8.3 Ollama Setup (Local LLM — Zero Cost)

```bash
# Install Ollama (free, open-source)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended models
ollama pull llama3.3          # general purpose
ollama pull nomic-embed-text  # embeddings for memory search
ollama pull qwen2.5:7b        # lighter model for low-RAM machines
```

### 8.4 Remote Access (Zero Cost Options)

**Option A — Tailscale (recommended):**
```bash
# Install Tailscale (free for personal use, up to 100 devices)
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
# Access gateway at: http://100.x.x.x:18789
```

**Option B — Cloudflare Tunnel (webhooks + remote UI):**
```bash
# Free, no port forwarding needed
cloudflared tunnel --url http://localhost:18789
# Creates: https://random-name.trycloudflare.com → :18789
```

**Option C — SSH Tunnel:**
```bash
ssh -N -L 18789:127.0.0.1:18789 user@my-server
```

### 8.5 Development Setup

```bash
git clone https://github.com/your-org/lunar
cd lunar
pnpm install
cp .env.example .env
# Add: OLLAMA_BASE_URL=http://localhost:11434

pnpm dev         # starts gateway + ui in watch mode
# Gateway: http://localhost:18789
# UI:      http://localhost:3000
```

### 8.6 Deployment Environments

| Environment | LLM | Embedding | Notes |
|---|---|---|---|
| **Developer laptop** | Ollama (local) | Ollama nomic-embed-text | Full offline capability |
| **Home server (Raspberry Pi 5)** | Ollama (smaller models) | Ollama all-minilm | 8 GB RAM minimum |
| **Home server (Mac Mini)** | Ollama (full models) | Ollama nomic-embed-text | Ideal setup |
| **VPS (free tier: Oracle)** | Groq + Gemini free | Gemini embedding | Oracle ARM VPS is free forever |
| **Low-spec (1 GB RAM)** | Groq + Gemini cloud | Transformers.js WASM | Gemini 2.0 Flash free tier |

> **Oracle Cloud Always Free Tier:** 4 OCPUs + 24 GB RAM ARM instance — enough for Ollama + Lunar + all connectors, completely free.

---

## 9. Security Architecture

### 9.1 Authentication Flow

```
Client connects to WebSocket
        │
        ▼
Gateway checks bind mode
  loopback → auto-approve device if autoApproveLoopback
  network  → require token in connect frame
        │
        ▼
{ type: "connect", auth: { token: "Bearer <secret>" }, deviceId: "dev_abc" }
        │
  valid + known device  → hello-ok
  valid + new device    → pairing request created → client polls or UI approves
  invalid token         → close(4401, "unauthorized")
        │
        ▼
Approved device receives session token for future connects
```

Token is stored in `lunar.json` (`gateway.auth.token`). Generated via:
```bash
lunar token generate
```

Device pairing managed via:
```bash
lunar devices list
lunar devices approve <requestId>
lunar devices reject <requestId>
```

### 9.2 DM Pairing Flow (Sender Allowlist)

```
New sender sends DM to bot
        │
        ▼
Gateway checks sender against allowlist
        │
  NOT in allowlist → silently ignore (or reply "access denied")
        │
  IN allowlist (pairing approved)
        ▼
Route to agent, process turn
```

Pairing approved via Control UI or `lunar pair approve <peerId>`.

### 9.3 Tool Approval Flow (`ask` mode)

```
Agent decides to call bash tool
        │
        ▼
Approval check → "ask"
        │
        ▼
Gateway sends confirmation to user's chat:
  "🔧 I want to run: `rm -rf ./temp`. Allow? [yes/no]"
        │
  User replies "yes" → execute tool
  User replies "no"  → skip, inform agent
  Timeout (30s)      → skip, inform agent
```

### 9.4 Secret Isolation

```
Agent run starts
        │
        ▼
Snapshot env: process.env original state
        │
        ▼
Inject skill secrets: process.env.GOOGLE_API_KEY = config.skills.gmail.apiKey
        │
        ▼
Agent runs (LLM + tools)
        │
        ▼
Restore env: delete injected vars, restore originals
```

---

## 10. Technology Decision Matrix

| Decision | Chosen | Rejected Alternatives | Reason |
|---|---|---|---|
| **Runtime** | Node.js 22 | Python, Deno, Bun | Ecosystem, WebSocket libs, Baileys requires Node |
| **Primary LLM** | Ollama (local) | Paid APIs | Zero cost, private, offline |
| **Cloud LLM fallback** | Gemini free + Groq free | OpenAI ($), Anthropic ($) | Both have generous free tiers |
| **Embedding** | Ollama nomic-embed-text | OpenAI ada-002 ($) | Free, high quality, offline |
| **Vector DB** | SQLite + sqlite-vec | Chroma, Qdrant, Pinecone | Zero dependency, embedded, free |
| **Session storage** | JSONL + SQLite | PostgreSQL, Redis | No external services, human-readable |
| **WhatsApp** | Baileys | Meta Cloud API | Meta API requires business verification; Baileys is free |
| **Telegram** | grammY | Telegraf | Better TypeScript support, actively maintained |
| **Discord** | discord.js | eris, oceanic.js | Industry standard, best-maintained |
| **Browser automation** | Playwright (Chromium) | Puppeteer, Selenium | Best API, free bundled Chromium |
| **HTTP server** | Fastify | Express, Hono | Fastest Node.js HTTP server, built-in schema validation |
| **Control UI** | Next.js + shadcn/ui | React SPA, Vue | App router, SSR, shadcn is copy-paste free components |
| **Tunnel (remote)** | Cloudflare Tunnel | Ngrok (paid) | Cloudflare tunnel is free unlimited |
| **Process manager** | PM2 | supervisord, systemd direct | Works on all platforms, easy log management |
| **Config format** | JSON5 | YAML, TOML | JSON-compatible, supports comments |


---

## 11. Use Case Coverage

> Cross-reference of use cases in [use-cases.md](../plan/use-cases.md) against the architecture.

| Category | UCs | Covered | Partial | Missing |
|---|---|---|---|---|
| Daily Life & Productivity | UC-01 – UC-04 | ✅ 4 | — | — |
| Information & Research | UC-05 – UC-07 | ✅ 3 | — | — |
| Memory & Knowledge Base | UC-08 – UC-10 | ✅ 3 | — | — |
| Developer Workflows | UC-11 – UC-13 | ✅ 3 | — | — |
| File & System Management | UC-14 – UC-16 | ✅ 3 | — | — |
| Proactive & Automated | UC-17 – UC-19 | ✅ 3 | — | — |
| Multi-Turn Conversations | UC-20 – UC-21 | ✅ 2 | — | — |
| Multi-Channel | UC-22 – UC-23 | ✅ 2 | — | — |
| Social Network | UC-24 – UC-32 | — | ⚠️ 3 | ❌ 6 |
| Channel Building & Growth | UC-33 – UC-44 | — | ⚠️ 2 | ❌ 10 |
| **Total** | **44** | **23** | **5** | **16** |

**Legend:** ✅ Fully covered · ⚠️ Partially covered (infrastructure exists, skill/extension missing) · ❌ Not covered (requires additional skills — see §3.6 bundled skills and §3.5 browser profiles)

**Social network gaps** (UC-24–32) require bundled skills: `youtube`, `tiktok`, `facebook`, `instagram`, `twitter`, `linkedin` (see §3.6), plus persistent browser profiles (see §3.5 + §4.5 `browser.profiles`) and vision model support (see §4.5 `models.vision`).

**Channel growth gaps** (UC-33–44) additionally require: `youtube-studio`, `content-planner`, `seo-research`, `social-analytics`, `collab-finder` skills, and tool result truncation via `agents.defaults.toolResultMaxTokens` (see §4.5).

---

### 11.1 Coverage Summary

| Category | UCs | Covered | Partial | Missing |
|---|---|---|---|---|
| Daily Life & Productivity | UC-01 – UC-04 | ✅ 4 | — | — |
| Information & Research | UC-05 – UC-07 | ✅ 3 | — | — |
| Memory & Knowledge Base | UC-08 – UC-10 | ✅ 3 | — | — |
| Developer Workflows | UC-11 – UC-13 | ✅ 3 | — | — |
| File & System Management | UC-14 – UC-16 | ✅ 3 | — | — |
| Proactive & Automated | UC-17 – UC-19 | ✅ 3 | — | — |
| Multi-Turn Conversations | UC-20 – UC-21 | ✅ 2 | — | — |
| Multi-Channel | UC-22 – UC-23 | ✅ 2 | — | — |
| Social Network | UC-24 – UC-32 | — | ⚠️ 3 | ❌ 6 |
| Channel Building & Growth | UC-33 – UC-44 | — | ⚠️ 2 | ❌ 10 |
| **Total** | **44** | **23** | **5** | **16** |

**Legend:** ✅ Fully covered · ⚠️ Partially covered (infrastructure exists, skill/extension missing) · ❌ Not covered (requires architecture addition)

---

### 11.2 Fully Covered Use Cases (UC-01 – UC-23)

All use cases in sections 1–8 of use-cases.md are **fully addressed** by the current architecture:

| Requirement | Architecture Component |
|---|---|
| Cron-triggered proactive messages (UC-01, 03, 17–19) | `packages/cron/` + `node-cron` |
| Google Calendar / Gmail skills (UC-01–04) | `packages/skills/bundled/google-calendar/` + `gmail/` |
| Browser scraping for research (UC-05, 07) | `packages/tools/browser/` — Playwright |
| Document read / Q&A (UC-06, 14) | `packages/tools/filesystem/read.ts` |
| Memory read/write/search (UC-08–10) | `packages/memory/` — full hybrid BM25 + vector pipeline |
| GitHub webhook + skill (UC-11) | Gateway `/hook/:uuid` + `skills/bundled/github/` |
| Bash tool execution (UC-12, 15–16) | `packages/tools/bash/tool.ts` |
| Tool approval `ask` mode (UC-04, 15) | `packages/tools/approval.ts` |
| Webhook inbound triggers (UC-11, 18) | Gateway `/hook/:uuid` endpoint |
| Multi-session isolation (UC-22–23) | `packages/session/` — dmScope + session key scheme |
| iMessage connector (UC-23) | `packages/connectors/imessage/` |

---

### 11.3 Gaps — Social Network Use Cases (UC-24 – UC-32)

#### GAP-01: Missing Social Platform Skills ❌ Critical

The architecture defines only 8 bundled skills. Social network use cases require **6 additional skills**:

| Missing Skill | Required By | What It Does |
|---|---|---|
| `youtube` | UC-24, UC-25 | Scrape video transcripts, channel pages, public analytics |
| `tiktok` | UC-26 | Scrape Explore page, hashtag trends, creator analytics |
| `facebook` | UC-27 | Scrape groups/pages (requires saved login session) |
| `instagram` | UC-28 | Scrape hashtag pages, Explore; vision caption workflow |
| `twitter` | UC-29 | Scrape x.com search with live filter; monitor mentions |
| `linkedin` | UC-30 | Scrape job search, company pages, profile data |

**Required addition:**
```
packages/skills/bundled/
├── youtube/SKILL.md      ← ADD
├── tiktok/SKILL.md       ← ADD
├── facebook/SKILL.md     ← ADD
├── instagram/SKILL.md    ← ADD
├── twitter/SKILL.md      ← ADD
└── linkedin/SKILL.md     ← ADD
```

Each SKILL.md instructs the agent to use `browser_navigate` + `browser_extract` with platform-specific flow descriptions and CSS selector patterns.

---

#### GAP-02: Browser Session / Cookie Persistence ❌ Critical

Social platform use cases (UC-24–32) require the agent to be **logged into** YouTube, Facebook, Instagram, LinkedIn, and X. The current `packages/tools/browser/` launches a **fresh Playwright session each time** — no login state is preserved.

**Required addition** in `packages/tools/browser/`:

```
packages/tools/browser/
├── tool.ts
├── navigate.ts
├── extract.ts
├── fill.ts
└── profile.ts      ← ADD: persistent Playwright browser context per platform
```

```typescript
// profile.ts
const context = await chromium.launchPersistentContext(
  `~/.lunar/browser-profiles/${platform}`,
  { headless: true }
);
```

**CLI addition:**
```bash
lunar browser login <platform>   # opens non-headless browser; user logs in once
```

**Config addition** (`lunar.json`):
```json5
browser: {
  profiles: {
    youtube:   { profileDir: "~/.lunar/browser-profiles/youtube" },
    facebook:  { profileDir: "~/.lunar/browser-profiles/facebook" },
    instagram: { profileDir: "~/.lunar/browser-profiles/instagram" },
    twitter:   { profileDir: "~/.lunar/browser-profiles/twitter" },
    linkedin:  { profileDir: "~/.lunar/browser-profiles/linkedin" }
  }
}
```

---

#### GAP-03: Vision / Image Analysis Pipeline ⚠️ Partial

UC-28 (Instagram Caption Planner) requires the agent to analyze an uploaded image using a vision-capable LLM.

- ✅ `InboundEnvelope.media[]` captures attachments
- ✅ Ollama supports multimodal models (llava, gemma3 vision); Gemini free tier also supports vision
- ❌ No documented path from `media[]` → multimodal LLM call in `context-builder.ts`

**Required update** in `packages/agent/src/context-builder.ts`:
```typescript
if (message.media?.some(m => m.type === 'image')) {
  // Inject images as vision content parts into the messages array
  messages.push({
    role: 'user',
    content: [
      ...message.media
        .filter(m => m.type === 'image')
        .map(m => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.base64}` } })),
      { type: 'text', text: message.text }
    ]
  });
}
```

**Config addition:**
```json5
models: {
  vision: "ollama/llava:13b",  // ADD: dedicated vision model
  // or: "gemini/gemini-2.0-flash"  (vision on free tier)
}
```

**`MediaAttachment` type update** in `packages/shared/`:
```typescript
interface MediaAttachment {
  type: 'image' | 'audio' | 'document' | 'video';
  mimeType: string;
  url?: string;
  base64?: string;   // ADD
  filePath?: string; // ADD
}
```

---

### 11.4 Gaps — Channel Building & Growth Use Cases (UC-33 – UC-44)

#### GAP-04: YouTube Studio Analytics Skill ❌ Critical

UC-33 (Channel Analytics), UC-38 (Comment Analysis), UC-39 (Upload Time Finder), and UC-40 (Growth Report) require accessing `studio.youtube.com` — an authenticated, JavaScript-heavy dashboard.

**Required addition:**
```
packages/skills/bundled/
└── youtube-studio/SKILL.md   ← ADD: specialized skill for Studio analytics
```

Depends on **GAP-02** (browser profile with Google auth saved).

---

#### GAP-05: Missing Channel Growth Skills ❌ Critical

UC-34–UC-42 require structured cross-platform content research workflows.

| Missing Skill | Required By |
|---|---|
| `youtube-studio` | UC-33, UC-38, UC-39, UC-40 |
| `content-planner` | UC-36 — content calendar generation + scheduling |
| `seo-research` | UC-37 — keyword research + competitor title pattern analysis |
| `social-analytics` | UC-40 — aggregate stats from multiple platforms |
| `collab-finder` | UC-41 — structured creator search + contact extraction |

**Required additions:**
```
packages/skills/bundled/
├── youtube-studio/SKILL.md   ← ADD (depends on GAP-02)
├── content-planner/SKILL.md  ← ADD
├── seo-research/SKILL.md     ← ADD
├── social-analytics/SKILL.md ← ADD
└── collab-finder/SKILL.md    ← ADD
```

---

#### GAP-06: Long Tool Result Truncation ⚠️ Partial

UC-43 (Script Generator) and UC-44 (Shorts Slicer) fetch full video transcripts via `browser_extract` — these can be 5,000–10,000 tokens, overflowing smaller Ollama models.

**Required update** in `packages/agent/src/context-builder.ts`:
```typescript
// Truncate or summarize oversized tool results before injecting into context
const MAX_TOOL_RESULT_TOKENS = config.agent.toolResultMaxTokens ?? 4000;
if (estimateTokens(toolResult) > MAX_TOOL_RESULT_TOKENS) {
  toolResult = await llm.summarize(toolResult, 'Extract key highlights and timestamps');
}
```

**Config addition:**
```json5
agent: {
  toolResultMaxTokens: 4000,   // ADD
}
```

---

#### GAP-07: `nodes_run` Tool Missing ⚠️ Low Priority

The BRD (BR-TE-01) lists `nodes_run` as a built-in tool. It is not present in `packages/tools/`.

**Required addition (v2.0):**
```
packages/tools/
└── nodes/
    └── tool.ts    ← ADD: SSH-based remote node command execution
```

---

#### GAP-08: Slack Connector Missing ⚠️ Low Priority

The BRD (BR-CC-04) includes Slack as a v1.1 connector. It is absent from the architecture's connector list and tech stack table.

**Required addition (v1.1):**
```
packages/connectors/
└── slack/
    └── connector.ts   ← ADD: Slack Events API + Bot Token (@slack/bolt)
```

Tech stack row to add:
| Channel | Library | Cost |
|---|---|---|
| Slack (v1.1) | **@slack/bolt** (MIT) | Free Bot API |

---

### 11.5 Summary of Required Architecture Updates

| Gap | Priority | Component | Milestone |
|---|---|---|---|
| **GAP-01** 6 social platform skills | 🔴 High | `packages/skills/bundled/` — 6 new SKILL.md files | v1.1 |
| **GAP-02** Browser session persistence | 🔴 High | `packages/tools/browser/profile.ts` + `lunar browser login` CLI | v1.1 |
| **GAP-03** Vision / image → LLM pipeline | 🟡 Medium | `context-builder.ts` + `models.vision` config + `MediaAttachment.base64` | v1.1 |
| **GAP-04** YouTube Studio analytics skill | 🟡 Medium | `bundled/youtube-studio/SKILL.md` (depends on GAP-02) | v1.1 |
| **GAP-05** 5 channel growth skills | 🟡 Medium | `content-planner`, `seo-research`, `social-analytics`, `collab-finder` SKILL.md | v1.1 |
| **GAP-06** Long transcript truncation | 🟡 Medium | `context-builder.ts` + `toolResultMaxTokens` config | v1.0 |
| **GAP-07** `nodes_run` tool | 🟢 Low | `packages/tools/nodes/tool.ts` | v2.0 |
| **GAP-08** Slack connector | 🟢 Low | `packages/connectors/slack/` + `@slack/bolt` | v1.1 |
| **GAP-09** Mobile nodes (iOS/Android/headless) | 🔴 High | `packages/nodes/` — node WS protocol + registry | v2.0 |
| **GAP-10** Canvas surface | 🔴 High | Gateway HTTP `/__lunar__/canvas/` + node commands | v2.0 |
| **GAP-11** Sub-agents | 🔴 High | `packages/agent/src/subagent/` + `sessions_spawn` tool | v1.1 |
| **GAP-12** Signal connector | 🟡 Medium | `packages/connectors/signal/` | v1.1 |
| **GAP-13** Device pairing system | 🔴 High | `packages/gateway/src/devices/` — per-device tokens | v1.1 |
| **GAP-14** Per-agent sandbox + tool policy | 🟡 Medium | `agents.list[].sandbox` + `tools.allow/deny` config | v1.1 |
| **GAP-15** Workspace template files | 🟡 Medium | `SOUL.md`, `AGENTS.md`, `USER.md`, `BOOTSTRAP.md` in workspace | v1.0 |
| **GAP-16** Message binding / routing rules | 🔴 High | `bindings[]` config + `packages/gateway/src/router.ts` rewrite | v1.1 |
| **GAP-17** Voice pipeline | 🟢 Low | `packages/voice/` — wake word, talk mode, transcription | v2.0 |
| **GAP-18** Session tools (inter-agent) | 🟡 Medium | `packages/tools/session/` — `sessions_send`, `sessions_history` | v1.1 |
| **GAP-19** Slash commands | 🟡 Medium | Slash command parser in `packages/gateway/src/router.ts` | v1.1 |
| **GAP-20** Gmail Pub/Sub trigger | 🟢 Low | `packages/connectors/gmail-pubsub/` | v1.1 |
| **GAP-21** Mattermost connector | 🟢 Low | `packages/connectors/mattermost/` (plugin pattern) | v2.0 |
| **GAP-22** BlueBubbles iMessage path | 🟢 Low | `packages/connectors/bluebubbles/` | v1.1 |
| **GAP-23** Message queue + presence events | 🟡 Medium | Per-session queue lanes + `presence` WS event in §7.3 | v1.1 |

---

### 11.6 Use Cases That Require NO Architecture Changes

These work out of the box once the core system is built — they use only existing `browser_navigate` + `browser_extract` + `memory_*` tools:

| Use Cases | Reason |
|---|---|
| UC-25 YouTube Channel Monitor | `browser_navigate` public channel URLs — no login needed |
| UC-29 Twitter/X Keyword Monitor | `browser_navigate` public x.com search |
| UC-31 Cross-Platform Content Repurposing | `browser_extract` any URL + LLM reformat |
| UC-35 Competitor Channel Deep Dive | `browser_navigate` public YouTube channel pages |
| UC-36 Content Calendar Builder | Pure LLM + `memory_write` — no external tool needed |
| UC-37 SEO Optimizer (public results) | `browser_navigate` YouTube search results |
| UC-42 Content Gap Analysis | `browser_navigate` public channel video lists |
| UC-43 Hook & Script Generator | Pure LLM + `memory_search` |

---

### 11.7 Gap Analysis — Lunar vs OpenClaw

> **Reference:** [OpenClaw documentation](https://docs.openclaw.ai/) (self-hosted gateway, MIT licensed).  
> **Purpose:** Identify architectural capabilities present in OpenClaw that Lunar does not yet implement.

---

#### 11.7.1 Gap Summary

| Priority | # Gaps | Key Areas |
|---|---|---|
| 🔴 Critical | 4 | Mobile nodes, Canvas, Sub-agents, Binding/routing rules |
| 🟡 Medium | 7 | Per-agent sandbox, workspace templates, session tools, slash commands, Signal, Mattermost, queue/presence |
| 🟢 Low | 4 | Voice, Gmail Pub/Sub, BlueBubbles, Mattermost plugin |

---

#### 11.7.2 Critical Gaps

##### GAP-09: Mobile Nodes (iOS / Android / Headless) ❌ Critical

OpenClaw has a first-class **node** architecture where iOS, Android, and headless Linux/Windows machines connect to the Gateway WebSocket with `role: "node"` and expose device command surfaces.

| Node Command | Description |
|---|---|
| `canvas.*` | WebView/Canvas surface — present, hide, navigate, eval JS, snapshot PNG/JPG |
| `camera.*` | Take photos, record video clips (front/rear) |
| `screen.record` | Screen recording (mp4) |
| `location.get` | GPS coordinates |
| `sms.send` | Send SMS via Android telephony |
| `system.run` | Execute shell commands on the node host |
| `system.notify` | macOS/iOS system notifications |

Lunar has **no node concept** — `packages/tools/nodes/tool.ts` (GAP-07) is noted as SSH-only and v2.0. This is a much larger gap than a simple SSH wrapper.

**Required additions:**
```
packages/nodes/
├── src/
│   ├── registry.ts       ← connected node list (in-memory + SQLite)
│   ├── protocol.ts       ← node WS connect frame (role: "node", caps, commands)
│   ├── invoker.ts        ← gateway → node.invoke RPC bridge
│   ├── pairing.ts        ← per-device token approval store
│   └── exec-approvals.ts ← per-node exec allowlist
```

**Config addition:**
```json5
nodes: {
  pairing: { autoApproveLoopback: true },
  exec: { security: "ask" }  // "ask" | "allowlist" | "full"
}
```

**Control UI additions:** `/nodes` page — list nodes, approve pairing requests, invoke commands.

---

##### GAP-10: Canvas Surface ❌ Critical

OpenClaw serves a Canvas (WebView) at `/__openclaw__/canvas/` and `/__openclaw__/a2ui/` on the gateway HTTP server. Nodes (iOS/Android/macOS) present this WebView. The agent (or CLI) can:
- `canvas.present` — load a URL or local file
- `canvas.navigate` — navigate to a new URL
- `canvas.eval` — run arbitrary JS inside the WebView
- `canvas.snapshot` — capture PNG/JPG screenshot
- `canvas.a2ui` — push A2UI JSONL payloads

Lunar has **no canvas concept** at all.

**Required additions:**
```
packages/gateway/src/
└── canvas/
    ├── routes.ts         ← GET /__lunar__/canvas/* and /__lunar__/a2ui/*
    └── host.ts           ← serve canvas HTML/CSS/JS; handle A2UI payloads
```

Depends on **GAP-09** (nodes) for mobile canvas. The gateway-side canvas routes are self-contained and can ship independently.

---

##### GAP-11: Sub-Agents ❌ Critical

OpenClaw supports `sessions_spawn` (tool) and `/subagents` (slash command) which run a **background agent turn** in its own session and announce results back to the requester chat. Key properties:
- Non-blocking: returns `{ runId, childSessionKey }` immediately
- Session key: `agent:<id>:subagent:<uuid>`
- Announce step posts result summary back to requester's channel
- Supports nested depth (max 5; depth 2 = orchestrator pattern)
- Per-depth tool policies (depth-1 orchestrators get `sessions_spawn`; depth-2 leaves do not)
- Cascade stop: `/stop` kills all children

Lunar's agent runner only supports a linear `runTurn()` loop — there is no spawn, no announce, no child session concept.

**Required additions:**
```
packages/agent/src/
└── subagent/
    ├── spawner.ts        ← create child session, enqueue run
    ├── announce.ts       ← post result back to requester channel
    ├── concurrency.ts    ← maxConcurrent lane cap
    └── cascade.ts        ← cascade stop to all children

packages/tools/src/
└── session/
    ├── spawn-tool.ts     ← sessions_spawn tool
    ├── history-tool.ts   ← sessions_history tool
    ├── list-tool.ts      ← sessions_list tool
    └── send-tool.ts      ← sessions_send tool
```

**Config addition:**
```json5
agents: {
  defaults: {
    subagents: {
      maxSpawnDepth: 1,          // 1 = leaf only; 2 = orchestrator pattern
      maxChildrenPerAgent: 5,
      maxConcurrent: 8,
      archiveAfterMinutes: 60
    }
  }
}
```

**Session key scheme update** in `packages/session/`:
```
agent:<id>:main              ← existing
agent:<id>:subagent:<uuid>   ← ADD
agent:<id>:subagent:<uuid>:subagent:<uuid>  ← depth-2
```

---

##### GAP-13: Device Pairing System ❌ Critical

OpenClaw issues **per-device tokens** — every WS client (CLI, macOS app, web UI, nodes) includes a device identity on `connect`. New device IDs require explicit approval; local (loopback/tailnet) connects can be auto-approved.

Lunar's current auth is binary: loopback skips auth entirely; network requires a single shared bearer token. There is no per-device identity or approval flow for operator clients.

**Required additions:**
```
packages/gateway/src/
└── devices/
    ├── registry.ts       ← SQLite store: deviceId → token + role + approved
    ├── handshake.ts      ← validate device identity on WS connect
    └── pairing-rpc.ts    ← devices.list, devices.approve, devices.reject
```

**Storage addition:**
```
~/.lunar/
└── devices.sqlite        ← device pairing store
```

**CLI additions:**
```bash
lunar devices list
lunar devices approve <requestId>
lunar devices reject <requestId>
```

---

##### GAP-16: Message Binding / Routing Rules ❌ Critical

OpenClaw uses a deterministic `bindings[]` array with priority tiers:
1. `peer` match (exact DM/group id)
2. `parentPeer` match (thread inheritance)
3. `guildId + roles` (Discord role-based routing)
4. `guildId` (Discord server-level)
5. `teamId` (Slack workspace)
6. `accountId` match
7. Channel-level match
8. Default agent fallback

Lunar's `router.ts` only supports `session.dmScope` — a single global agent ID for all DMs. Multi-agent routing for different senders, groups, or accounts requires a complete router rewrite.

**Required update** in `packages/gateway/src/router.ts` + config schema:
```json5
bindings: [
  // Most specific first
  { agentId: "work",   match: { channel: "whatsapp", accountId: "biz" } },
  { agentId: "family", match: { channel: "whatsapp", peer: { kind: "group", id: "120363...@g.us" } } },
  { agentId: "main",   match: { channel: "whatsapp" } },  // catch-all
  { agentId: "main",   match: { channel: "telegram" } }
]
```

Removes the need for `session.dmScope` (deprecated once bindings are in place).

---

#### 11.7.3 Medium Gaps

##### GAP-14: Per-Agent Sandbox & Tool Policy ⚠️ Medium

OpenClaw supports per-agent overrides for sandbox mode and tool allow/deny lists in `agents.list[]`. Lunar's sandbox is global only (`packages/tools/sandbox.ts`).

**Config addition:**
```json5
agents: {
  list: [
    {
      id: "family",
      sandbox: { mode: "all", scope: "agent" },
      tools: {
        allow: ["read", "memory_search"],
        deny:  ["bash", "fs_write", "browser"]
      }
    }
  ]
}
```

**Required update** in `packages/tools/src/executor.ts` — resolve effective tool policy by merging agent-level overrides onto global defaults before dispatch.

---

##### GAP-15: Workspace Template Files ⚠️ Medium

OpenClaw uses structured Markdown template files that are injected into the system prompt:

| File | Purpose | Lunar Equivalent |
|---|---|---|
| `AGENTS.md` | Core agent instructions + tool policies | ❌ None |
| `SOUL.md` | Persona, tone, identity rules | ❌ None (inline `persona` string in config) |
| `USER.md` | User-provided context about themselves | ❌ None |
| `IDENTITY.md` | Agent name/identity block | ❌ None |
| `HEARTBEAT.md` | Proactive/cron turn instructions | ❌ None |
| `BOOTSTRAP.md` | Run-start setup instructions | ❌ None |
| `TOOLS.md` | Custom tool guidance injected into prompt | ❌ None |
| `MEMORY.md` | Long-term memory | ✅ Exists |

**Required addition** in `packages/agent/src/context-builder.ts` — load and stitch these files into the system prompt in priority order. File layout update:
```
~/.lunar/agents/<id>/workspace/
├── AGENTS.md       ← ADD: core instructions
├── SOUL.md         ← ADD: persona (replaces agents.list[].persona string)
├── USER.md         ← ADD: user context
├── IDENTITY.md     ← ADD: identity block
├── HEARTBEAT.md    ← ADD: cron/proactive instructions
├── BOOTSTRAP.md    ← ADD: session-start setup
├── TOOLS.md        ← ADD: tool guidance
└── MEMORY.md       ← EXISTING
```

---

##### GAP-12: Signal Connector ⚠️ Medium

OpenClaw supports Signal as a channel. Lunar only has Telegram, Discord, WhatsApp, iMessage, WebChat.

**Required addition (v1.1):**
```
packages/connectors/
└── signal/
    └── connector.ts   ← Signal connector (signal-cli or signald bridge)
```

Tech stack row to add:
| Channel | Library | Cost |
|---|---|---|
| Signal (v1.1) | **signal-cli** (AGPL) or **signald** | Free |

---

##### GAP-18: Session Tools (Inter-Agent / History Access) ⚠️ Medium

OpenClaw exposes session management as **callable tools** inside agent turns, enabling agents to read history from other sessions and send messages cross-session:

| Tool | Description |
|---|---|
| `sessions_list` | List sessions for an agent |
| `sessions_history` | Read transcript of another session |
| `sessions_send` | Post a message to another session |
| `sessions_spawn` | Spawn a sub-agent (see GAP-11) |
| `session_status` | Get current run status |

Lunar's agent can only interact with its own current session via `memory_*` tools.

**Required additions** in `packages/tools/src/session/` — see GAP-11 directory structure above.

---

##### GAP-19: Slash Commands ⚠️ Medium

OpenClaw parses messages starting with `/` as control commands dispatched before they reach the agent:

| Command | Description |
|---|---|
| `/stop` | Abort current run + all sub-agents |
| `/subagents list/kill/log/spawn` | Sub-agent management |
| `/exec host=node` | Override exec target per session |

Lunar has no slash command parser. All messages go directly to the agent.

**Required addition** in `packages/gateway/src/router.ts`:
```typescript
// Before routing to agent:
if (envelope.text.startsWith('/')) {
  const handled = await slashCommandHandler.handle(envelope);
  if (handled) return;
}
```

---

##### GAP-23: Message Queue + Presence Events ⚠️ Medium

OpenClaw uses an explicit **per-session queue** with named lanes (`subagent`, default) for concurrency control. It also emits `presence` WS events (online/typing states) that Lunar's WS event stream (§7.3) does not include.

**Required additions:**
- `packages/session/src/queue.ts` — per-session FIFO queue with configurable concurrency lanes
- `presence` event type in `packages/gateway/src/rpc/protocol.ts`
- `{ type: "event", event: "presence", payload: { agentId, status: "typing" | "idle" } }` in WS stream

---

#### 11.7.4 Low-Priority Gaps

| Gap | OpenClaw Has | Required For Lunar | Milestone |
|---|---|---|---|
| **GAP-17** Voice pipeline | Voice wake, talk mode, audio transcription hook | `packages/voice/` — wake word engine + TTS/STT | v2.0 |
| **GAP-20** Gmail Pub/Sub trigger | Real-time Gmail inbound via Pub/Sub push subscription | `packages/connectors/gmail-pubsub/` | v1.1 |
| **GAP-21** Mattermost connector | Mattermost via `@mattermost/client` plugin pattern | `packages/connectors/mattermost/` | v2.0 |
| **GAP-22** BlueBubbles iMessage path | HTTP bridge to BlueBubbles server (non-macOS capable) | `packages/connectors/bluebubbles/` | v1.1 |
| Bonjour / mDNS discovery | Local gateway discovery via Bonjour | `packages/gateway/src/discovery/bonjour.ts` | v2.0 |
| Gateway lock | Prevent duplicate gateway process starts | `packages/gateway/src/daemon/lock.ts` | v1.0 |
| TLS for WebSocket | Optional TLS + fingerprint pinning on WS | `gateway.tls` config block | v1.1 |
| Agent-to-agent messaging | `tools.agentToAgent` explicit opt-in | `tools.agentToAgent.enabled` config + router support | v1.1 |
| OpenProse / text normalization | Markdown → chat text rendering layer | `packages/shared/src/prose.ts` | v1.1 |
| Polls automation | Structured poll creation + result tallying | `packages/automation/src/poll/` | v2.0 |
