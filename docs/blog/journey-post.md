# From Node.js Developer to AI Engineer: My 100-Day Journey

> What I learned building an AI agent from scratch — and how you can do it too.

## Why 100 Days?

I was a Node.js developer who kept reading about AI agents, RAG, and function calling — but never built one. I set a challenge: **build a production AI agent in 100 days, one commit per day.**

## The Timeline

### Phase 1: Foundation (Days 1-20)
**Theme:** Get something working.

- Days 1-5: TypeScript monorepo scaffolding, Ollama integration
- Days 6-10: Tool system, memory with SQLite + FTS5
- Days 11-15: Telegram channel, conversation context
- Days 16-20: Vector search (sqlite-vec), guard pipeline

**Key learning:** LLMs are unpredictable. You need guardrails (injection detection, output validation) from day 1.

### Phase 2: Intelligence (Days 21-40)
**Theme:** Make it smart.

- Days 21-25: Sub-agent architecture, prompt templates
- Days 26-30: Eval framework, quality metrics, regression tests
- Days 31-35: Multi-provider strategy (Ollama + Gemini + Groq)
- Days 36-40: Advanced RAG, session management

**Key learning:** Eval is essential. Without automated quality checks, you can't iterate on prompts confidently.

### Phase 3: Scale (Days 41-70)
**Theme:** Make it real.

- Days 41-50: Discord + Web channels, real-time streaming
- Days 51-60: Next.js control panel, analytics dashboard
- Days 61-70: Admin tools, settings, advanced features

**Key learning:** Multi-channel support forces clean abstractions. The same agent brain should work across any interface.

### Phase 4: Launch (Days 71-100)
**Theme:** Ship it.

- Days 71-75: Testing (Vitest, CI, performance)
- Days 76-80: Production deployment (Docker, VPS, security)
- Days 81-85: UX polish, accessibility
- Days 86-90: Beta launch, monitoring, iteration
- Days 91-100: Portfolio, blog, job prep

**Key learning:** "It works on my machine" isn't enough. Docker, backups, and monitoring matter.

## Skills I Gained

| Before | After |
|--------|-------|
| REST APIs | AI agent architectures |
| SQL queries | Vector search + RAG |
| Unit tests | Eval-driven development |
| Express/Fastify | LLM orchestration |
| Frontend apps | Streaming AI interfaces |

## Advice for Node.js Devs Getting into AI

1. **You already know more than you think.** Async I/O, streaming, TypeScript — all directly applicable.
2. **Start with Ollama.** Free, local, no API keys needed.
3. **Build something real.** Tutorials won't teach you edge cases.
4. **Eval early.** It's the AI equivalent of TDD.
5. **Don't ignore the boring stuff.** Memory, caching, and error handling separate toys from tools.

## By the Numbers

- **100 days**, **100 commits**
- **17,000+ lines** of TypeScript
- **12 tools**, **4 channels**, **3 LLM providers**
- **22 automated tests**, **8 eval scenarios**
- **$0/month** operational cost

## What's Next

- Fine-tuning models on conversation data
- Voice interface (Whisper + TTS)
- Multi-agent collaboration
- Contributing to open-source AI tooling

**The best time to start building with AI was 6 months ago. The second best time is today.**

---

**GitHub:** [github.com/yourusername/lunar](https://github.com/yourusername/lunar)

## Publishing Checklist

- [ ] Publish "Architecture" post on Dev.to / Hashnode
- [ ] Publish "Memory Deep Dive" on Dev.to / Hashnode
- [ ] Publish "100-Day Journey" on Dev.to / personal blog
- [ ] Cross-post summaries to Twitter/X
- [ ] Share in relevant Discord/Reddit communities
- [ ] Add canonical URLs between platforms
