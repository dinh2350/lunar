# Day 1 — Environment Setup + What is an LLM?

> 🎯 **DAY GOAL:** Install your AI tools and understand what an LLM actually is

---

## 📚 CONCEPT 1: What is an LLM?

### WHAT — Simple Definition

**LLM = Large Language Model.** A program that predicts the next word in a sentence.

You type: "The capital of Vietnam is ___"
The LLM predicts: "Hanoi"

That's it. At its core, every ChatGPT, Claude, Gemini — they all just predict the next word, over and over, until they finish a response.

### WHY — Why Does This Exist?

Before LLMs, if you wanted AI to answer questions, you needed:
- Thousands of hand-written rules ("if user asks X, return Y")
- Separate models for each task (translation, summarization, Q&A)
- Months of engineering per feature

LLMs changed everything: **one model that handles ANY text task.** Write, translate, summarize, code, reason — all from the same model. That's why the industry exploded.

### WHEN — When Do You Use LLMs?

| Use LLMs For | Don't Use LLMs For |
|---|---|
| Chat interfaces | Simple math (use code) |
| Text summarization | Exact string matching (use regex) |
| Code generation | Database queries (use SQL) |
| Content creation | Real-time data (LLMs have knowledge cutoff) |
| Reasoning over text | Anything requiring 100% accuracy |
| Translation | Passwords, encryption |

### HOW — How Does It Work?

Think of it like autocomplete on your phone, but 1000x smarter:

```
Step 1: You send a message
         "What is the capital of Vietnam?"

Step 2: LLM converts your words to numbers (tokens)
         [What][is][the][capital][of][Vietnam][?]
           ↓     ↓    ↓     ↓     ↓     ↓     ↓
         [1024] [72] [89]  [4521] [85] [29834] [30]

Step 3: Numbers go through a neural network (billions of parameters)
         ... math happens here (you don't need to know the math) ...

Step 4: Network outputs probability for next token
         "Hanoi" = 92% probability
         "Ho Chi Minh" = 3%
         "Saigon" = 1%

Step 5: Pick the most likely token → "Hanoi"

Step 6: Repeat from Step 3 until response is complete
         "The" → "capital" → "of" → "Vietnam" → "is" → "Hanoi" → "." → [STOP]
```

**Visual: How an LLM generates text**
```
Your Input         Neural Network            Output (word by word)
┌──────────┐      ┌──────────────┐         ┌─────────────────────┐
│ "What is │ ──── │              │ ──────► │ "The"               │
│ the      │      │  Billions of │         │ "The capital"       │
│ capital  │      │  parameters  │         │ "The capital of"    │
│ of       │      │  (weights)   │         │ "The capital of     │
│ Vietnam?"│      │              │         │  Vietnam is Hanoi." │
└──────────┘      └──────────────┘         └─────────────────────┘
                         ↑
                  Trained on trillions
                  of words from the internet
```

### 🔗 NODE.JS ANALOGY

Think of an LLM like a really smart **middleware function**:

```
// In Node.js, you have middleware:
app.use((req, res, next) => {
  // transform request → response
});

// An LLM is similar:
llm.chat((messages) => {
  // input: array of messages (conversation)
  // output: the next message (AI's response)
  // No database, no rules — just pattern matching from training
});
```

**The key difference:** Your middleware has explicit logic you wrote. The LLM's logic comes from absorbing patterns in trillions of words. You don't write IF/ELSE — the model learned them.

---

## 📚 CONCEPT 2: What is Ollama?

### WHAT — Simple Definition

**Ollama = A tool that lets you run LLMs on your own computer.** No cloud, no API key, no cost.

Normally, to use an LLM:
- ChatGPT → need OpenAI API key → costs money per request
- Claude → need Anthropic API key → costs money per request

But with Ollama:
- Download once → runs forever → completely free
- Works offline (airplane mode!)
- Your data never leaves your computer

### WHY — Why Use Ollama?

| With Cloud API (ChatGPT) | With Ollama (Local) |
|---|---|
| Costs $0.01-0.06 per request | Free forever |
| Requires internet | Works offline |
| Your data goes to OpenAI servers | Data stays on your Mac |
| Rate limits (429 errors) | No limits |
| API can change or shut down | You control everything |
| Fast (dedicated GPUs) | Slower (uses your CPU/GPU) |

**For learning and development, Ollama is perfect.** No bills, no limits, full control.

### WHEN — When to Use What?

```
Learning / Prototyping  → Ollama (free, local)
Need speed in production → Groq (free tier, very fast)
Need best quality        → GPT-4o or Claude (paid)
Need free + good quality → Gemini (free tier, Google)
```

### HOW — How Does Ollama Work?

```
┌──────────────────────────────────────────┐
│              Your Mac                     │
│                                           │
│   ┌─────────────┐     ┌──────────────┐   │
│   │ Your Code   │────►│  Ollama      │   │
│   │ (TypeScript)│◄────│  Server      │   │
│   └─────────────┘     │              │   │
│    localhost:          │  ┌─────────┐ │   │
│    any port            │  │ llama3  │ │   │
│                        │  │ (4GB)   │ │   │
│                        │  └─────────┘ │   │
│                        │  ┌─────────┐ │   │
│                        │  │ nomic   │ │   │
│                        │  │ (270MB) │ │   │
│                        │  └─────────┘ │   │
│                        └──────────────┘   │
│                         Port 11434        │
└──────────────────────────────────────────┘

Your Code calls http://localhost:11434/api/chat
Ollama loads the model into RAM and generates a response
```

### 🔗 NODE.JS ANALOGY

Ollama is like **running MongoDB locally** for development:

```
Cloud MongoDB Atlas = Cloud LLM (ChatGPT, Claude)
  → Needs internet, costs money, your data goes elsewhere

Local MongoDB (mongod) = Ollama
  → Free, offline, data stays local, you control everything

// Just like you do:
// mongod --port 27017        ← starts local MongoDB
// ollama serve               ← starts local LLM server

// And connect with:
// mongoose.connect('mongodb://localhost:27017')
// new Ollama({ host: 'http://localhost:11434' })
```

---

## 📚 CONCEPT 3: What is a Monorepo?

### WHAT — Simple Definition

**Monorepo = One Git repository with multiple packages inside.** Instead of 5 separate repos, you have 1 repo with 5 folders.

```
lunar/                    ← ONE repo
├── packages/
│   ├── agent/            ← Package 1: AI brain
│   ├── tools/            ← Package 2: tool functions
│   ├── memory/           ← Package 3: RAG + vector search
│   ├── connectors/       ← Package 4: Telegram, Discord, etc.
│   ├── gateway/          ← Package 5: HTTP server, entry point
│   └── shared/           ← Package 6: shared types
└── pnpm-workspace.yaml   ← tells pnpm "these are my packages"
```

### WHY — Why Monorepo?

| Separate Repos | Monorepo |
|---|---|
| Each package has its own repo | All packages in one repo |
| Hard to keep in sync | Always in sync |
| Need to publish to npm to share code | Packages import each other directly |
| 5 git repos to manage | 1 git repo to manage |
| Complex CI/CD (5 pipelines) | Simple CI/CD (1 pipeline) |

### WHEN — When to Use Monorepo?

- ✅ Multiple packages that depend on each other (like Lunar)
- ✅ Shared types across packages
- ✅ Want atomic commits (change agent + tools in one commit)
- ❌ Completely independent projects that never share code

### HOW — How Does pnpm Workspaces Work?

The `pnpm-workspace.yaml` file tells pnpm which folders are packages:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"    # every folder inside packages/ is a package
```

Then each package can import other packages:

```typescript
// In packages/agent/src/runner.ts:
import { executeTool } from '@lunar/tools';  // imports from packages/tools/
import type { Message } from '@lunar/shared';  // imports from packages/shared/
```

---

## 🔨 HANDS-ON: Setup Environment

### Step 1: Install Ollama (5 minutes)

```bash
# Download from https://ollama.com and install
# After install, verify:
ollama --version
# Should show: ollama version 0.x.x
```

### Step 2: Download AI Models (10-15 minutes, depends on internet)

```bash
# Main chat model — this is your AI brain
ollama pull llama3.3
# ↳ Downloads ~4GB, a very capable open-source model

# Embedding model — converts text to searchable numbers (we use this Week 3)
ollama pull nomic-embed-text
# ↳ Downloads ~270MB, small and fast
```

### Step 3: Test Your AI (5 minutes)

```bash
# Start a conversation:
ollama run llama3.3 "What is the capital of Vietnam?"
# Expected: "The capital of Vietnam is Hanoi."

# Try a harder question:
ollama run llama3.3 "Explain recursion like I'm 5 years old"
# Expected: A simple, clear explanation

# Try code generation:
ollama run llama3.3 "Write a TypeScript function that reverses a string"
# Expected: A working TypeScript function
```

**🤔 What happened?** You just talked to an AI running 100% on your computer. No internet needed. No API key. No cost.

### Step 4: Create the Lunar Monorepo (10 minutes)

```bash
# Go to your project folder
cd ~/Documents/project/lunar

# Initialize the root package
pnpm init
# ↳ Creates package.json

# Create workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "packages/*"
EOF
# ↳ Tells pnpm: "every folder in packages/ is a separate package"

# Create the package folders
mkdir -p packages/shared/src
mkdir -p packages/agent/src/llm
mkdir -p packages/tools/src
mkdir -p packages/memory/src
mkdir -p packages/connectors/src
mkdir -p packages/session/src
mkdir -p packages/gateway/src

# Verify the structure
find packages -type d | head -20
```

Expected output:
```
packages/shared/src
packages/agent/src/llm
packages/tools/src
packages/memory/src
packages/connectors/src
packages/session/src
packages/gateway/src
```

### Step 5: Configure TypeScript (10 minutes)

```bash
# Install TypeScript tools at the root (workspace-level)
pnpm add -D typescript tsx @types/node -w

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@lunar/*": ["packages/*/src"]
    }
  },
  "include": ["packages/*/src/**/*"]
}
EOF
```

**What each setting means (Node.js developer version):**
| Setting | What It Does | Why |
|---|---|---|
| `target: ES2022` | Output modern JavaScript | We use Node.js 22, it supports ES2022 |
| `module: Node16` | Use Node.js module system | Works with `import/export` + pnpm |
| `strict: true` | Catch more bugs at compile time | Like eslint but for types |
| `paths: @lunar/*` | Import packages by name | `import { x } from '@lunar/shared'` |

### Step 6: Verify Everything Works (5 minutes)

```bash
# Create a test file to verify TypeScript works
cat > packages/shared/src/index.ts << 'EOF'
export const VERSION = '0.1.0';
export const APP_NAME = 'Lunar';
console.log(`${APP_NAME} v${VERSION} — Ready!`);
EOF

# Run it with tsx (TypeScript executor — no compile step needed)
npx tsx packages/shared/src/index.ts
# Expected output: "Lunar v0.1.0 — Ready!"
```

If you see "Lunar v0.1.0 — Ready!" → everything works! 🎉

---

## ✅ CHECKLIST — Verify Before Moving to Day 2

- [ ] `ollama --version` shows a version number
- [ ] `ollama run llama3.3 "Hello"` gives an intelligent response
- [ ] Lunar monorepo structure exists (`packages/agent`, `packages/shared`, etc.)
- [ ] `npx tsx packages/shared/src/index.ts` prints "Lunar v0.1.0 — Ready!"
- [ ] You can explain in your own words: "An LLM is ___"

---

## 💡 KEY TAKEAWAY

**An LLM is a text-prediction API.** You send text in, you get text out. Ollama lets you run it locally for free. Everything else in this course builds on top of this one simple idea.

---

## ❓ SELF-CHECK QUESTIONS

Test yourself. Answer without looking up:

1. **What does LLM stand for?**
   <details><summary>Answer</summary>Large Language Model</details>

2. **How does an LLM generate a response? (1 sentence)**
   <details><summary>Answer</summary>It predicts the next word/token over and over until the response is complete.</details>

3. **Why use Ollama instead of ChatGPT API for learning?**
   <details><summary>Answer</summary>Free, no API key needed, works offline, data stays on your computer, no rate limits.</details>

4. **What is a monorepo?**
   <details><summary>Answer</summary>One Git repository containing multiple packages that can import each other.</details>

5. **What file tells pnpm which folders are packages?**
   <details><summary>Answer</summary>pnpm-workspace.yaml</details>

6. **If you ask an LLM "What's the weather right now?", will it give an accurate answer? Why or why not?**
   <details><summary>Answer</summary>No. LLMs only predict text based on training data — they can't access real-time information. They have a knowledge cutoff date and cannot check the actual weather.</details>

---

**Next → [Day 2: First LLM Call from TypeScript](day-02.md)**
