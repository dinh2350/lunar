# How I Built a Self-Hosted AI Agent with Node.js

> A deep dive into Lunar — an AI assistant with memory, tools, and multi-channel support. All running locally, zero cost.

## The Problem

I wanted an AI assistant that:
- Runs entirely on my machine (privacy)
- Remembers past conversations (memory)
- Can take actions (tools)
- Works on Telegram, Discord, and Web
- Costs $0/month to operate

Cloud AI APIs are expensive at scale, don't remember anything between sessions, and send all your data to third parties. I decided to build my own.

## Architecture

```
User ──▶ Channel (Telegram/Discord/Web)
              │
              ▼
         Gateway (Fastify) ──▶ Guard Pipeline
              │
              ▼
         Agent Engine ──▶ LLM Provider
              │                │
              ├── Tool Router  ├── Ollama (local)
              ├── Memory       ├── Gemini (free tier)
              └── Sub-agents   └── Groq (free tier)
```

**Key decisions:**
- **Ollama over OpenAI** — Free, private, runs on my MacBook
- **SQLite over Postgres** — Zero ops, embedded, surprisingly powerful with FTS5 + sqlite-vec
- **TypeScript over Python** — My background, great for async I/O, pnpm workspaces

## The Agent Loop

The core pattern: **Think → Act → Observe → Repeat**

```typescript
while (iterations < maxIterations) {
  const response = await llm.chat(messages);
  
  if (response.toolCalls.length === 0) {
    return response.content; // Done!
  }
  
  for (const call of response.toolCalls) {
    const result = await tools.execute(call);
    messages.push({ role: 'tool', content: result });
  }
}
```

## Memory: The Secret Sauce

Most chatbots forget everything. Lunar uses hybrid search:
- **BM25** (SQLite FTS5) for keyword matching
- **Vector similarity** (sqlite-vec) for semantic matching
- **Reciprocal Rank Fusion** to combine both

This gives accurate recall even when users rephrase questions differently.

## Results

- 12+ tools running locally
- 4 channels connected
- Response time: <5s (local Ollama)
- Monthly cost: $0
- Memory accuracy: ~93% retrieval relevance

## What I'd Do Differently

1. Start with streaming earlier — perceived latency matters more than actual latency
2. Write eval tests from day 1 — catching regressions in AI is hard
3. Use simpler prompts — more instructions ≠ better outputs

**GitHub:** [github.com/yourusername/lunar](https://github.com/yourusername/lunar)

---

# Building Long-Term Memory for AI Agents with SQLite + Vector Search

> Most AI chatbots forget everything after each session. Here's how I built persistent memory that actually works.

## The Memory Problem

LLM context windows are limited. Even with 128K tokens, you can't fit months of conversations. You need an external memory system.

## Solution: Hybrid Search

### 1. BM25 (Keyword Search)
SQLite FTS5 provides fast full-text search with BM25 ranking:

```sql
CREATE VIRTUAL TABLE memory_fts USING fts5(content, tokenize='porter');
SELECT * FROM memory_fts WHERE memory_fts MATCH 'typescript preferences';
```

**Good at:** Exact terms, names, specific phrases
**Bad at:** Paraphrased queries, synonyms

### 2. Vector Similarity (Semantic Search)
sqlite-vec provides cosine similarity on embeddings:

```sql
SELECT * FROM memory_vec
WHERE vec_cosine_similarity(embedding, ?) > 0.7
ORDER BY vec_cosine_similarity(embedding, ?) DESC;
```

**Good at:** Meaning, synonyms, fuzzy matching
**Bad at:** Exact names, rare terms

### 3. Reciprocal Rank Fusion
Combine both rankings:

```typescript
score = 1/(k + rank_bm25) + 1/(k + rank_vector)
```

**Result:** Best of both worlds. 93% accuracy at <50ms latency.

## Key Insight

Memory isn't just storage — it's retrieval. The prompt engineering for injecting memories matters as much as the search quality.

**GitHub:** [github.com/yourusername/lunar](https://github.com/yourusername/lunar)
