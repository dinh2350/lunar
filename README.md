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

## 📚 Documentation

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
