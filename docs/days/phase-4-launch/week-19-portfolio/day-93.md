# Day 93 — Demo Video + Presentation

> 🎯 **DAY GOAL:** Create a polished demo video and presentation slides for interviews/meetups

---

## 🔨 HANDS-ON

### 1. Demo Video Script (5 min version)

```
Structure: Problem → Solution → Demo → Architecture → Results

[0:00 - 0:30] INTRO
"Hi, I'm [name]. I built Lunar — a self-hosted AI agent platform 
that runs entirely on your machine with no paid APIs."

[0:30 - 1:00] THE PROBLEM
"Most AI assistants require cloud APIs, don't remember past 
conversations, and charge per token. I wanted something 
privacy-first, free, and actually useful day-to-day."

[1:00 - 3:00] LIVE DEMO
- Start with docker compose up
- Chat via Telegram
- Show memory: "Remember I prefer TypeScript"
- Show tools: "Search for latest Node.js release"  
- Show vision: Send an image for analysis
- Show web dashboard

[3:00 - 4:00] ARCHITECTURE
- Show architecture diagram
- Highlight key components:
  "Agent engine with tool routing, SQLite with vector search
   for memory, MCP for extensibility"

[4:00 - 4:30] TECHNICAL HIGHLIGHTS
- "Hybrid search: BM25 + vector similarity"
- "Multi-agent coordination with fallback"
- "Zero-cost: Ollama + free Gemini tier"

[4:30 - 5:00] CLOSING
- GitHub link
- "Built with Node.js, TypeScript, and 100 days of learning"
- "Questions? Find me at [links]"
```

### 2. Recording Setup

```
Tools (all free):
┌─────────────────────────────────────────────┐
│ Screen Recording: OBS Studio / QuickTime    │
│ Video Editing:    DaVinci Resolve (free)    │
│ Thumbnails:       Canva (free tier)         │
│ Hosting:          YouTube (unlisted/public) │
└─────────────────────────────────────────────┘

Recording tips:
• 1080p, clean desktop, dark theme
• Increase font size in terminal (18-20px)
• Hide notifications (Do Not Disturb)
• Pre-type long commands, paste during recording
• Record audio separately for better quality
```

### 3. Presentation Slides (for interviews/meetups)

```
Slide deck outline (10-12 slides):

1. Title: "Lunar: Self-Hosted AI Agent Platform"
2. Problem: Why I built this
3. Architecture: High-level diagram
4. Agent Engine: LLM → Tool Router → Response
5. Memory System: SQLite + FTS5 + sqlite-vec
6. Multi-Channel: Telegram, Discord, Web
7. Advanced: Sub-agents, fine-tuning, multimodal
8. Infrastructure: Docker, CI/CD, monitoring
9. Demo: Screenshots or embedded video
10. Lessons Learned: Top 3 insights
11. Numbers: Lines of code, tests, metrics
12. Q&A: Links and contact info

Tools: Google Slides, Slidev (code-based), or Figma
```

### 4. Key Metrics Slide

```
Project By the Numbers:
┌─────────────────────────────┐
│ 📁 ~15,000 lines TypeScript │
│ 🧪 ~200 tests               │
│ 🔧 12+ tools                │
│ 💬 4 channels                │
│ 🤖 5 specialist agents      │
│ 📦 SQLite: 0 ops cost       │
│ ⚡ p95 response: <5s        │
│ 📅 100 days to build        │
└─────────────────────────────┘
```

---

## ✅ CHECKLIST

- [ ] Demo video script written
- [ ] Recording environment set up (clean desktop, fonts)
- [ ] 5-min demo video recorded and edited
- [ ] Upload to YouTube
- [ ] Presentation slides created (10-12 slides)
- [ ] Key metrics calculated
- [ ] Thumbnail designed for video

---

**Next → [Day 94: LinkedIn + Professional Presence](day-94.md)**
