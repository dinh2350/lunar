# Lunar AI Agent — Demo Script

## Recording Setup

- **Tool:** OBS Studio / QuickTime (macOS)
- **Resolution:** 1920x1080, 30fps
- **Duration:** 5 minutes target
- **Audio:** Clear narration, no background music during demo
- **Terminal font:** 16pt minimum for readability

---

## Script (5 minutes)

### [0:00 – 0:30] Hook + Intro

**Visual:** Terminal with Lunar ASCII logo

> "What if you could build an AI assistant that runs entirely on your machine — with memory, tools, and zero monthly cost? That's Lunar."
>
> "I'm [Name], a Node.js developer who spent 100 days building a self-hosted AI agent. Let me show you what it can do."

### [0:30 – 1:30] Core Chat (Telegram)

**Visual:** Telegram conversation

1. Send: "Hey Lunar, what can you do?"
   - Show response listing capabilities
2. Send: "What's the weather in Ho Chi Minh City?"
   - Show tool call (weather tool) executing
3. Send: "Remember that I prefer TypeScript over JavaScript"
   - Show memory being stored

**Narration:** "Lunar connects to Telegram, Discord, or a web UI. It can call tools — here it's fetching real weather data — and it remembers things between conversations."

### [1:30 – 2:30] Memory Demo

**Visual:** Continue Telegram chat

1. Start a new conversation
2. Send: "What programming language do I prefer?"
   - Show Lunar recalling "TypeScript" from memory

**Narration:** "This is the key differentiator. Most chatbots forget everything. Lunar uses hybrid search — combining keyword matching with vector similarity — to recall context from past conversations."

**Visual:** Quick flash of SQLite FTS5 + sqlite-vec architecture diagram

### [2:30 – 3:30] Multi-Channel + Web UI

**Visual:** Switch to web control panel

1. Show dashboard with conversation stats
2. Show real-time chat in web UI
3. Show memory browser
4. Show eval results

**Narration:** "The control panel gives you full visibility — conversation history, memory browser, and automated quality evaluations."

**Visual:** Quick switch to Discord showing same agent responding

### [3:30 – 4:15] Architecture + Tech

**Visual:** Terminal showing docker-compose up

1. Show services starting (Ollama, Agent, Web UI, Caddy)
2. Show `pnpm test` running (22 tests passing)
3. Brief terminal view of project structure

**Narration:** "Under the hood: TypeScript monorepo, Ollama for local LLM inference, SQLite for memory, Fastify for the API. The whole stack runs in Docker."

### [4:15 – 5:00] Closing

**Visual:** GitHub repo page

> "100 days, 100 commits, zero dollars spent. The entire codebase is open source."
>
> "If you're a Node.js developer curious about AI engineering — this proves you already have the skills. Star the repo, fork it, make it yours."

**Visual:** GitHub star button highlight, blog post links

---

## B-Roll Shots Needed

- [ ] Terminal: Lunar ASCII art startup
- [ ] Telegram: 3-message conversation
- [ ] Web UI: Dashboard overview
- [ ] Web UI: Memory browser
- [ ] Docker: Services starting
- [ ] Terminal: Tests running
- [ ] GitHub: Repo page with stats

## Post-Production

- Add intro/outro cards (5s each)
- Add subtle background music (outro only)
- Add chapter markers for YouTube
- Export: MP4 H.264, 1080p
- Thumbnail: Terminal screenshot with "I Built an AI Agent in 100 Days" text overlay
