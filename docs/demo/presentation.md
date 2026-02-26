# Lunar — Self-Hosted AI Agent Platform

## Presentation Outline (10-12 slides)

---

### Slide 1: Title
**Lunar: A Self-Hosted AI Agent Built in 100 Days**
- Your Name — AI Engineer
- GitHub / Twitter / LinkedIn links

---

### Slide 2: The Problem
- Cloud AI is expensive ($20-100/mo for serious use)
- APIs send your data to third parties
- Chatbots forget everything between sessions
- No customization or extensibility

**→ Can we build a private, free, intelligent AI assistant?**

---

### Slide 3: Architecture Overview
```
[Channels] → [Gateway] → [Guard Pipeline] → [Agent Engine] → [LLM]
                                                    ↕
                                              [Memory] [Tools]
```
- TypeScript monorepo (pnpm workspaces)
- Ollama for local inference
- SQLite + FTS5 + sqlite-vec for memory
- Fastify API + Next.js control panel

---

### Slide 4: The Agent Loop
- Think → Act → Observe → Repeat
- Function calling with 12+ tools
- Guard pipeline (injection detection, PII, length limits)
- Multi-provider fallback (Ollama → Gemini → Groq)

---

### Slide 5: Memory System
| Component | Purpose |
|-----------|---------|
| BM25 (FTS5) | Keyword search |
| sqlite-vec | Semantic similarity |
| RRF | Rank fusion |

**Result:** 93% retrieval accuracy, <50ms latency

---

### Slide 6: Multi-Channel
- Telegram bot
- Discord bot
- Web UI (Next.js + streaming)
- CLI interface
- All sharing the same agent brain

---

### Slide 7: Eval-Driven Development
- 8 eval scenarios with automated grading
- Quality metrics: relevance, accuracy, helpfulness
- Regression detection in CI
- "TDD for AI"

---

### Slide 8: Live Demo
*(Switch to live demo or pre-recorded video)*

---

### Slide 9: Key Metrics
| Metric | Value |
|--------|-------|
| Development time | 100 days |
| Total commits | 100 |
| Lines of code | 17,000+ |
| Tools | 12 |
| Channels | 4 |
| LLM providers | 3 |
| Monthly cost | $0 |
| Test coverage | 22 tests |

---

### Slide 10: What I Learned
1. Eval > unit tests for AI systems
2. Hybrid search beats pure vector search
3. Guard pipelines are non-negotiable
4. Streaming UX matters more than raw speed
5. TypeScript is great for AI engineering

---

### Slide 11: What's Next
- Fine-tuning on conversation data
- Voice interface (Whisper + TTS)
- Multi-agent collaboration
- Plugin marketplace

---

### Slide 12: Thank You
- **GitHub:** github.com/yourusername/lunar
- **Blog:** dev.to/yourusername
- **LinkedIn:** linkedin.com/in/yourname
- **Contact:** your@email.com

*"The best way to learn AI engineering is to build something real."*

---

## Presentation Tips

- **Time:** 15-20 minutes including demo
- **Audience:** Tech meetup / interview panel / conference
- **Tools:** Google Slides, Keynote, or reveal.js
- **Font:** Inter or System UI, minimum 24pt body text
- **Colors:** Match Lunar brand (indigo/violet accent on dark bg)
- **Demo backup:** Have pre-recorded video in case of live demo issues
