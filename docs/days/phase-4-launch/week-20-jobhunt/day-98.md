# Day 98 — Job Search Strategy

> 🎯 **DAY GOAL:** Build a systematic approach to finding AI Engineer roles — where to look, how to apply, how to stand out

---

## 🔨 HANDS-ON

### 1. Where to Find AI Engineer Jobs

```
Tier 1 — AI-Focused Job Boards:
┌───────────────────────────────────────────────┐
│ 🎯 ai-jobs.net         — AI-specific roles    │
│ 🎯 aimljobs.fyi        — ML/AI curated        │
│ 🎯 joinai.com          — AI startups           │
└───────────────────────────────────────────────┘

Tier 2 — General (filter for AI):
┌───────────────────────────────────────────────┐
│ 💼 LinkedIn Jobs       — "AI Engineer"         │
│ 💼 Indeed              — "LLM" or "AI Agent"   │
│ 💼 Glassdoor           — Research salaries too  │
└───────────────────────────────────────────────┘

Tier 3 — Startup-Focused:
┌───────────────────────────────────────────────┐
│ 🚀 YC Work at a Startup (workatastartup.com) │
│ 🚀 AngelList / Wellfound                      │
│ 🚀 Hacker News: "Who is hiring?" (monthly)   │
└───────────────────────────────────────────────┘

Tier 4 — Remote:
┌───────────────────────────────────────────────┐
│ 🌍 RemoteOK           — Remote AI roles       │
│ 🌍 We Work Remotely   — Filter: engineering   │
│ 🌍 Toptal/Turing      — Freelance AI work     │
└───────────────────────────────────────────────┘
```

### 2. Job Title Keywords to Search

```
Primary:
- "AI Engineer"
- "LLM Engineer"
- "ML Engineer" (some overlap)
- "AI Application Developer"

Secondary:
- "Prompt Engineer"  
- "AI Platform Engineer"
- "Conversational AI Engineer"
- "NLP Engineer"

Node.js + AI specific:
- "Full-stack AI Engineer"
- "Backend Engineer (AI)"
- "Software Engineer, AI/ML"
```

### 3. Application Tracker

```typescript
// Simple spreadsheet or Notion board
interface Application {
  company: string;
  role: string;
  url: string;
  appliedDate: string;
  status: 'researching' | 'applied' | 'phone_screen' | 
          'technical' | 'onsite' | 'offer' | 'rejected';
  notes: string;
  followUpDate?: string;
}

// Target: 5-10 applications per week
// Response rate: ~10-15% (industry average)
// So 50 apps → ~5-7 responses → ~2-3 interviews → 1 offer
```

### 4. Customized Cover Letter Template

```markdown
Hi [Hiring Manager],

I'm a TypeScript/Node.js developer who transitioned to AI 
engineering by building Lunar — a self-hosted AI agent platform 
with long-term memory, tool use, and multi-channel support.

What caught my eye about [Company]: [specific thing from job post 
or company blog — show you did research].

Relevant to this role:
• Built production RAG with hybrid search (BM25 + vector) on SQLite
• Designed multi-agent system with 5 specialists and auto-failover
• Fine-tuned Llama 3 with QLoRA for domain-specific tasks
• Shipped to production with Docker, CI/CD, and monitoring

You can see the full project at github.com/you/lunar and a 
5-minute demo at [YouTube link].

I'd love to discuss how my experience building AI systems from 
scratch maps to [specific challenge from job description].

Best,
[Your Name]
```

### 5. Standing Out

```
What makes you different from other applicants:
┌─────────────────────────────────────────────────┐
│ ✅ You BUILT something real (not just tutorials)│
│ ✅ You have a public GitHub with working code   │
│ ✅ You blogged about your technical decisions   │
│ ✅ You have a demo video proving it works       │
│ ✅ You understand the full stack (not just API) │
│ ✅ You know both TypeScript AND Python          │
│ ✅ You deployed to production with monitoring   │
└─────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST

- [ ] Create application tracking spreadsheet
- [ ] Identify 20 target companies
- [ ] Apply to 5 roles this week
- [ ] Customize cover letter for each application
- [ ] Set up job alerts on LinkedIn + 2 other boards
- [ ] Follow target companies on LinkedIn/Twitter

---

**Next → [Day 99: Continuous Learning Plan](day-99.md)**
