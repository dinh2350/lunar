# Day 92 — Technical Blog Writing

> 🎯 **DAY GOAL:** Write 2-3 blog posts about what you built — this is your best marketing as an engineer

---

## 📚 CONCEPT: Why Blog?

**What?** Technical articles explaining what you built and what you learned.

**Why?**
- Shows depth of understanding (not just "I used X")
- Attracts recruiters + hiring managers
- Builds credibility in the AI community
- Forces you to understand topics deeply

**Where to publish:** Dev.to (easy), Hashnode, Medium, or your own site.

---

## 🔨 HANDS-ON

### Blog Post #1: "How I Built a Self-Hosted AI Agent with Node.js"

```markdown
Outline:
1. **Hook** — "I wanted an AI assistant that runs entirely on my machine"
2. **The Problem** — Privacy, cost, vendor lock-in
3. **Architecture** — High-level diagram (Gateway → Agent → Tools → Memory)
4. **Key Decisions**
   - Why Ollama over OpenAI
   - Why SQLite over Postgres
   - Why TypeScript over Python
5. **Interesting Challenges**
   - Making RAG actually useful
   - Handling tool calls reliably
   - Managing conversation context
6. **Results** — Screenshot, metrics, demo link
7. **What I'd Do Differently** — Lessons learned
8. **Links** — GitHub, demo, next article
```

### Blog Post #2: "Building Long-Term Memory for AI Agents with SQLite + Vector Search"

```markdown
Outline:
1. **Hook** — "Most AI chatbots forget everything after each session"
2. **The Memory Problem** — Context windows are limited
3. **Solution: Hybrid Search**
   - FTS5 for keyword search (BM25)
   - sqlite-vec for semantic search
   - Combined ranking with RRF
4. **Implementation** — Code snippets with explanations
5. **Prompt Engineering** — How to inject memory into prompts
6. **Before/After** — Example conversations showing memory working
7. **Performance** — Query times, storage, scaling
```

### Blog Post #3: "From Node.js Developer to AI Engineer: My 100-Day Journey"

```markdown
Outline:
1. **Where I Started** — "I was a Node.js developer who knew nothing about AI"
2. **The Plan** — 100 days, building one project
3. **Key Phases**
   - Weeks 1-4: Foundations (TypeScript, LLM basics)
   - Weeks 5-8: Production (Docker, MCP, Cloud)
   - Weeks 9-14: Advanced (Sub-agents, Fine-tuning, Multimodal)  
   - Weeks 15-20: Launch (Testing, Deploy, Portfolio)
4. **What Surprised Me**
   - LLMs are easier than expected
   - Prompt engineering is harder than expected
   - Local models are impressively good
5. **Advice for Others** — Build something real, don't just watch tutorials
6. **What's Next** — Career goals, continued learning
```

### Writing Tips

```
Format for engagement:
┌──────────────────────────────────────┐
│ ✅ Short paragraphs (2-3 sentences) │
│ ✅ Code snippets with context        │
│ ✅ Diagrams and screenshots          │
│ ✅ Personal voice + opinions         │
│ ✅ Actionable takeaways              │
│ ❌ Wall of text                      │
│ ❌ Tutorial without personality      │
│ ❌ No visuals                        │
└──────────────────────────────────────┘
```

---

## ✅ CHECKLIST

- [ ] Blog post #1 drafted (architecture overview)
- [ ] Blog post #2 drafted (deep dive on memory)
- [ ] Blog post #3 outlined (learning journey)
- [ ] Add diagrams / screenshots to each post
- [ ] Publish on Dev.to or Hashnode
- [ ] Share links on Twitter/LinkedIn

---

**Next → [Day 93: Demo Video + Presentation](day-93.md)**
