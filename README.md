# 🌙 Lunar — AI Agent Platform

> A self-hosted, zero-cost AI agent platform built with Node.js.
> Multi-channel, multi-model, with memory and tool calling.

## ✨ Features

- 🤖 **Multi-model** — Ollama (local), Gemini, Groq, OpenRouter
- 💬 **Multi-channel** — Telegram, Discord, WhatsApp, WebChat
- 🧠 **Long-term memory** — Vector search + BM25 hybrid
- 🔧 **Tool calling** — Extensible tool system with MCP support
- 🛡️ **Safety** — Input/output guards, PII detection, rate limiting
- 👥 **Sub-agents** — Coordinator + specialist agent delegation
- 🎨 **Multimodal** — Vision, audio (STT/TTS), image generation
- 📊 **Eval pipeline** — Python-based with LLM-as-Judge
- 💰 **Zero cost** — Runs entirely on local models

## 🚀 Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm, Ollama
ollama pull llama3.2:3b

# Clone and install
git clone https://github.com/yourusername/lunar.git
cd lunar
pnpm install

# Configure
cp .env.example .env
# Edit .env with your settings

# Start
pnpm dev
```

Visit `http://localhost:3000` for the control panel.

## 📐 Architecture

```
User ──▶ Channel (Telegram/Discord/Web)
              │
              ▼
         Gateway ──▶ Guard Pipeline
              │
              ▼
         Agent Engine ──▶ LLM Provider
              │                │
              ├── Tool Router  ├── Ollama (local)
              ├── Memory       ├── Gemini (free)
              └── Sub-agents   └── Groq (free)
```

## 📂 Project Structure

```
packages/
  agent/        — Core agent engine, sub-agents, multimodal
  memory/       — Vector + BM25 hybrid search, SQLite
  tools/        — Built-in tools (calculator, filesystem, bash, etc.)
  connectors/   — Telegram, WebChat channel adapters
  gateway/      — Fastify API server
  guardrails/   — Input/output safety pipeline
  mcp/          — MCP client + manager
  mcp-server/   — MCP server (Lunar memory tools)
  shared/       — Shared types and utilities
  session/      — Session management
apps/
  control/      — Next.js control panel UI
services/
  eval/         — Python evaluation service (FastAPI)
scripts/
  training/     — Fine-tuning pipeline
```

## � Day-by-Day Navigation

This project was built over **100 days**, one commit per day. Each day is tagged so you can follow along:

```bash
# Jump to any day's code
git checkout day-9          # See the code as it was on Day 9

# See what changed on a specific day
./goto-day.sh 9 diff        # Show Day 9's changes

# List all 100 days
./goto-day.sh list

# Return to latest code
./goto-day.sh back
```

<details>
<summary><strong>📋 Full Day Index (click to expand)</strong></summary>

#### Phase 1: Foundation (Days 1-20)
| Day | Topic |
|-----|-------|
| 1 | Project scaffold + TypeScript monorepo |
| 2 | CLI chat interface + LLM client |
| 3 | Slash commands + configuration |
| 4 | Conversation history + message handling |
| 5 | Streaming chat functionality |
| 6 | Tools package (calculator, datetime) |
| 7 | Agent loop with tool integration |
| 8 | Filesystem tools + bash execution |
| 9 | Tool approval system + error handling |
| 10 | Shared types + conversation logger |
| 11 | Text chunker + embeddings (memory) |
| 12 | SQLite vector store (sqlite-vec) |
| 13 | Hybrid search (BM25 + vector) |
| 14 | RAG pipeline (memory_search tool) |
| 15 | Temporal decay + MMR re-ranking |
| 16 | Session management (JSONL transcripts) |
| 17 | Telegram bot (grammY) |
| 18 | WebChat connector (WebSocket) |
| 19 | 3-tier memory file system |
| 20 | Gateway integration (Fastify + DI) |

#### Phase 2: Intelligence (Days 21-40)
| Day | Topic |
|-----|-------|
| 21 | Python crash course |
| 22 | FastAPI eval service |
| 23 | LLM-as-Judge evaluation |
| 24 | Eval dataset + automated runner |
| 25 | CI eval pipeline + quality gate |
| 26 | Docker fundamentals |
| 27 | Docker Compose (4 services) |
| 28 | Docker volumes, networks, security |
| 29 | Docker image optimization |
| 30 | Docker dev workflow + Makefile |
| 31 | Cloud fundamentals (VPS deploy) |
| 32 | Domain, HTTPS, reverse proxy (Caddy) |
| 33 | Monitoring, logging, alerting |
| 34 | Backup and recovery |
| 35 | Production deployment checklist |
| 36 | MCP client (Model Context Protocol) |
| 37 | MCP server (memory tools) |
| 38 | MCP + Lunar integration (ToolRouter) |
| 39 | Popular MCP servers (GitHub, fetch) |
| 40 | MCP HTTP transport (SSE) |

#### Phase 3: Scale (Days 41-70)
| Day | Topic |
|-----|-------|
| 41 | Control Panel UI (Next.js + shadcn) |
| 42 | Memory browser + Session viewer |
| 43 | Real-time streaming + live metrics |
| 44 | Settings panel |
| 45 | Dark mode + keyboard shortcuts |
| 46 | Eval dashboard |
| 47 | A/B testing framework |
| 48 | Regression detection |
| 49 | Custom eval metrics |
| 50 | Golden test set + gate |
| 51 | Input guardrails (GuardPipeline) |
| 52 | PII detection + data privacy |
| 53 | Output safety |
| 54 | Tool safety + sandboxing |
| 55 | Safety audit + red team |
| 56 | Sub-agent architecture |
| 57 | Agent communication protocol |
| 58 | Agent handoff + delegation |
| 59 | Error recovery + fallbacks |
| 60 | Multi-agent demo |
| 61 | Fine-tuning fundamentals (Ollama) |
| 62 | Training data preparation |
| 63 | Fine-tuning with Unsloth (QLoRA) |
| 64 | Fine-tuning evaluation |
| 65 | Model registry + hub push |
| 66 | Vision API fundamentals |
| 67 | Image understanding + OCR |
| 68 | Audio processing (STT/TTS) |
| 69 | Image generation |
| 70 | Multimodal integration router |

#### Phase 4: Launch (Days 71-100)
| Day | Topic |
|-----|-------|
| 71 | Testing strategy (Vitest) |
| 72 | E2E testing + CI pipeline |
| 73 | Performance optimization + caching |
| 74 | Monitoring + observability |
| 75 | Documentation |
| 76 | Production Docker setup |
| 77 | Backup, recovery + scaling |
| 78 | VPS deployment |
| 79 | Security hardening |
| 80 | Deployment checklist |
| 81 | Conversation UX patterns |
| 82 | Personality + branding |
| 83 | Edge cases + resilience |
| 84 | Accessibility + help system |
| 85 | UX audit |
| 86 | Beta launch strategy |
| 87 | Beta monitoring + triage |
| 88 | Iteration + fixes |
| 89 | Public launch prep |
| 90 | Launch day (v1.0.0) |
| 91-95 | Portfolio (blog, demo, LinkedIn) |
| 96-100 | Career (resume, interview, graduation) |

</details>

## �📚 Documentation

- [Architecture Guide](docs/architechture/architecture.md)
- [Learning Guide](docs/LEARNING_GUIDE.md)
- [Daily Lessons](docs/days/README.md)
- [API Reference](docs/api/README.md)
- [Contributing](CONTRIBUTING.md)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS, TypeScript 5 |
| Package Manager | pnpm workspaces |
| LLM | Ollama, Gemini, Groq |
| Database | SQLite + sqlite-vec + FTS5 |
| API Server | Fastify 5 |
| Control UI | Next.js 15 + shadcn/ui |
| Eval | Python + FastAPI |
| Deployment | Docker Compose |

## 📄 License

MIT
