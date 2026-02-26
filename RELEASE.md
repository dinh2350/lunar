# 🌙 Lunar v1.0.0

First public release of Lunar — a self-hosted AI agent platform.

## Highlights

- 🤖 **Full AI agent** with tool use and long-term memory
- 💬 **Multi-channel:** Telegram, Discord, WhatsApp, Web
- 🎨 **Multimodal:** Vision, voice, image generation
- 👥 **Multi-agent:** Coordinator with specialist agents
- 🔒 **Privacy-first:** Runs locally with Ollama
- 💰 **Zero cost:** No paid API keys required
- 🧠 **Hybrid search:** BM25 + vector similarity for memory
- 🛡️ **Safety:** Input/output guards, PII detection, rate limiting
- 📊 **Eval pipeline:** Python-based with LLM-as-Judge
- 🐳 **Docker ready:** Production compose with Caddy auto-HTTPS

## Quick Start

```bash
git clone https://github.com/yourusername/lunar.git
cd lunar
cp .env.example .env
pnpm install
pnpm dev
```

## Tech Stack

Node.js 22 · TypeScript 5 · Fastify · SQLite · Ollama · Next.js 15 · Docker

## What's Next

- Plugin system for community tools
- Mobile app
- Voice-first mode
- More LLM providers

## Documentation

See the [README](README.md) for setup instructions and [docs/](docs/) for the full learning guide.
