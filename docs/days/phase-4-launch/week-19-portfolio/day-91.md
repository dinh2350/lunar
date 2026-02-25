# Day 91 — GitHub Profile + Project Showcase

> 🎯 **DAY GOAL:** Make your GitHub profile scream "AI Engineer" — profile README, pinned repos, commit history

---

## 🔨 HANDS-ON

### 1. GitHub Profile README

Create a repo named after your username (e.g., `yourname/yourname`) and add `README.md`:

```markdown
# Hi, I'm [Your Name] 👋

## 🤖 AI Engineer

I build intelligent systems with LLMs, agents, and local-first architecture.

### 🌙 Featured Project: [Lunar](https://github.com/yourname/lunar)
Self-hosted AI agent platform with long-term memory, tool use, and multi-channel support.
Built with Node.js, TypeScript, Ollama, SQLite.

### 🛠️ Tech Stack
**AI/ML:** Ollama, Gemini, RAG, Fine-tuning, LangChain, Vector Search
**Backend:** Node.js, TypeScript, Fastify, SQLite, Docker
**Frontend:** Next.js, React, Tailwind, shadcn/ui
**Infrastructure:** Docker, Caddy, GitHub Actions, VPS

### 📈 What I'm Working On
- 🔭 Building AI agents that run locally
- 🌱 Learning MLOps and model training
- 💬 Open to AI Engineer roles

### 📫 Contact
[LinkedIn](link) • [Twitter](link) • [Email](your@email.com)
```

### 2. Pin the Right Repos

```
Pinned repos (order matters):
1. 🌙 lunar          — AI agent platform (main project)
2. 📚 ai-experiments — Small AI/LLM experiments
3. 🔧 mcp-tools      — MCP server implementations  
4. 📝 blog           — Technical writing (optional)
5. 🎯 leetcode-ts    — Problem solving in TypeScript
6. 📦 dotfiles       — Dev environment setup
```

### 3. Commit History Quality

```bash
# Good: descriptive commits throughout the project
git log --oneline -20
# feat: add vision analysis with Ollama
# fix: handle timeout on large image uploads
# refactor: extract memory service from agent
# docs: add API reference for tool system
# test: add integration tests for Telegram channel

# Bad: sporadic, unclear commits
# update
# fix bug
# wip
# asdf
```

### 4. Repository Polish

```
For the Lunar repo, ensure:
├── README.md          ← Polished (from Day 89)
├── LICENSE            ← MIT
├── CONTRIBUTING.md    ← How to contribute
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── workflows/
│       └── ci.yml
├── docs/              ← This whole learning journey!
├── screenshots/       ← 3-5 key screenshots
└── demo.gif           ← Animated demo (optional)
```

---

## ✅ CHECKLIST

- [ ] Profile README created with AI Engineer focus
- [ ] Lunar repo pinned #1
- [ ] 5-6 repos pinned total
- [ ] Commit messages are clean and descriptive
- [ ] Issue templates added
- [ ] Screenshots folder with key visuals
- [ ] Profile photo is professional

---

**Next → [Day 92: Technical Blog Writing](day-92.md)**
