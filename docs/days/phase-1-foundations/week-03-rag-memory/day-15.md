# Day 15 — Temporal Decay + MMR Re-ranking + Memory Write

> 🎯 **DAY GOAL:** Make search results favor recent content and remove duplicates, plus let the AI save new memories

---

## 📚 CONCEPT 1: Temporal Decay

### WHAT — Simple Definition

**Recent information ranks higher than old information.** A note you saved yesterday is more relevant than one from 6 months ago (probably). Temporal decay gradually reduces the score of older content.

### WHY — Why Decay Old Memories?

```
WITHOUT decay:
  Query: "What project am I working on?"
  Result 1: [saved 6 months ago] "Working on an e-commerce site"
  Result 2: [saved yesterday] "Working on Lunar AI assistant"
  → Both rank equally → AI might give stale answer! ❌

WITH decay (half-life: 30 days):
  Result 1: [6 months old] score × 0.06  → almost invisible
  Result 2: [1 day old]    score × 0.98  → nearly full score
  → Recent information wins ✅
```

### HOW — Exponential Decay Formula

```
decayed_score = original_score × 0.5^(age_in_days / half_life)

half_life = 30 days means:
  0 days old  → score × 1.00   (full score)
  7 days old  → score × 0.85   (still strong)
  30 days old → score × 0.50   (half score)
  60 days old → score × 0.25   (quarter score)
  90 days old → score × 0.125  (barely visible)

Visual:
  Score │
  1.0   │█████
  0.75  │     ██████
  0.50  │           ██████
  0.25  │                 ████████
  0.0   │                         ████████████
        └─────────────────────────────────────→ Age (days)
             0    15    30    45    60    90

KEY: information doesn't disappear — it just ranks lower over time.
```

### WHEN — Which Content Gets Decay?

```
✅ APPLY DECAY to:
  - Daily notes and conversations
  - Task updates and status
  - Current project context

❌ DON'T APPLY DECAY to:
  - Technical documentation (architecture.md — always relevant)
  - User facts (name, preferences — permanent)
  - Reference material (how-to guides)

In practice: decay personal/temporal content, not reference content.
You can control this with a flag on each chunk.
```

### 🔗 NODE.JS ANALOGY

```typescript
// Temporal decay = like Redis TTL, but gradual instead of sudden
//
// Redis TTL (sudden):
//   SET key value EX 3600  → exists for 1 hour, then GONE
//
// Temporal decay (gradual):
//   Item score fades over time — still findable, just ranked lower
//   Like a weighted cache where relevance decreases with age

// Also like npm package scoring:
//   Popularity score considers RECENT downloads more than old ones
```

---

## 📚 CONCEPT 2: MMR (Maximal Marginal Relevance)

### WHAT — Simple Definition

**A re-ranking algorithm that removes near-duplicate results.** If 3 of your top 5 results say almost the same thing, MMR replaces 2 of them with different (but still relevant) results.

### WHY — Why Remove Duplicates?

```
WITHOUT MMR (top 5 by score):
  1. [0.95] "The agent loop calls tools and waits for results."
  2. [0.93] "The AI agent loop iterates, calling tools, waiting for responses."
  3. [0.91] "In the agent loop, tools are called and results awaited."
  4. [0.88] "The agent uses a while loop to call tools repeatedly."
  5. [0.72] "Memory search uses hybrid BM25 + vector approach."

  Results 1-4 all say the SAME THING! → wasted context window

WITH MMR (diverse top 5):
  1. [0.95] "The agent loop calls tools and waits for results."
  2. [0.88] "The agent uses a while loop to call tools repeatedly."
  3. [0.72] "Memory search uses hybrid BM25 + vector approach."
  4. [0.68] "Tool execution includes approval checks."
  5. [0.65] "The agent handles errors with retry and fallback."

  Each result adds NEW information! → much better context for the AI
```

### HOW — MMR Algorithm

```
MMR score = λ × relevance - (1-λ) × max_similarity_to_already_selected

  λ (lambda) = balance between relevance and diversity
    λ = 1.0: pure relevance (no diversity, may have duplicates)
    λ = 0.5: balanced
    λ = 0.7: mostly relevance, some diversity (recommended)

Algorithm:
  1. Start with empty selected list
  2. Pick the highest-scored result → add to selected
  3. For each remaining result:
     - Calculate: how similar is this to what we already picked?
     - Score = relevance - similarity_to_selected
     - Pick the one with highest MMR score
  4. Repeat until we have N results

Visual:
  Without MMR: 🟢🟢🟢🟡🔵  (three green = same topic)
  With MMR:    🟢🟡🔵🟠🟣  (all different topics from the relevant set)
```

### 🔗 NODE.JS ANALOGY

```typescript
// MMR = like removing duplicate emails in a search result
//
// Gmail search for "meeting": 
//   Without dedup: 5 emails all from the same thread
//   With dedup: 1 from each thread + related topics
//
// Same concept: you want DIVERSE relevant results, not 5 copies
// of the same information
```

---

## 📚 CONCEPT 3: Memory Write (AI Can Save Things)

### WHAT — Simple Definition

**A tool that lets the AI save new information to the knowledge base.** When the user shares personal info, preferences, or important facts, the AI stores them for future retrieval.

### WHY — Why Let the AI Write to Memory?

```
WITHOUT memory_write:
  Day 1: "My cat's name is Luna"  → AI says "Nice!"
  Day 2: "What's my cat's name?"  → AI: "I don't know" 😔

WITH memory_write:
  Day 1: "My cat's name is Luna"
         → AI calls memory_write(key: "pet", content: "Cat named Luna")
         → AI says "I'll remember that! Luna is a lovely name."
  Day 2: "What's my cat's name?"
         → AI calls memory_search(query: "pet cat name")
         → AI: "Your cat's name is Luna!" ✅
```

---

## 🔨 HANDS-ON: Add Decay, MMR, and Memory Write

### Step 1: Add Temporal Decay (20 minutes)

Add to `packages/memory/src/search.ts`:

```typescript
/**
 * Apply temporal decay: reduce scores based on age.
 * 
 * Half-life of 30 days means:
 *   1 day old  → 98% of original score
 *   30 days old → 50% of original score
 *   90 days old → 12.5% of original score
 */
function applyTemporalDecay(
  results: HybridResult[],
  halfLifeDays = 30
): HybridResult[] {
  const now = Date.now();

  return results.map(r => {
    // Get creation timestamp (from the store metadata)
    const createdAt = r.createdAt || now; // default to now if missing
    const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);

    // Exponential decay: score × 0.5^(age/halfLife)
    const decayFactor = Math.pow(0.5, ageDays / halfLifeDays);

    return {
      ...r,
      combinedScore: r.combinedScore * decayFactor,
      decayFactor, // keep for debugging
    };
  }).sort((a, b) => b.combinedScore - a.combinedScore);
}
```

### Step 2: Add MMR Re-ranking (25 minutes)

Add to `packages/memory/src/search.ts`:

```typescript
import { cosineSimilarity } from './embedder.js';

/**
 * MMR (Maximal Marginal Relevance) re-ranking.
 * Removes near-duplicate results to ensure diversity.
 *
 * @param lambda - 0.7 = mostly relevance, some diversity
 */
function mmrRerank(
  results: HybridResult[],
  embeddings: Map<string, number[]>,
  lambda = 0.7,
  limit = 5
): HybridResult[] {
  if (results.length <= 1) return results;

  const selected: HybridResult[] = [];
  const remaining = [...results];

  // Always pick the top result first
  selected.push(remaining.shift()!);

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].combinedScore;

      // How similar is this to what we already selected?
      let maxSimToSelected = 0;
      const candidateEmbed = embeddings.get(remaining[i].id);

      if (candidateEmbed) {
        for (const sel of selected) {
          const selEmbed = embeddings.get(sel.id);
          if (selEmbed) {
            const sim = cosineSimilarity(candidateEmbed, selEmbed);
            maxSimToSelected = Math.max(maxSimToSelected, sim);
          }
        }
      }

      // MMR = relevance - penalty for being similar to already selected
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}
```

### Step 3: Update Search Pipeline (15 minutes)

Update `hybridSearch` to include the full pipeline:

```typescript
export async function hybridSearch(
  query: string,
  store: VectorStore,
  options: Partial<SearchOptions> = {}
): Promise<HybridResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Step 1: Retrieve candidates (BM25 + Vector)
  const queryEmbedding = await embed(query);
  const [vectorResults, bm25Results] = await Promise.all([
    Promise.resolve(store.searchVector(queryEmbedding, opts.limit * 3)),
    Promise.resolve(store.searchBM25(query, opts.limit * 3)),
  ]);

  // Step 2: Normalize + Merge (same as before)
  const merged = mergeResults(vectorResults, bm25Results, opts);

  // Step 3: Temporal decay (recent > old)
  const decayed = applyTemporalDecay(merged);

  // Step 4: MMR re-ranking (diverse results)
  const embeddings = new Map<string, number[]>();
  // ... load embeddings for MMR comparison
  const diverse = mmrRerank(decayed, embeddings, 0.7, opts.limit);

  return diverse;
}

// COMPLETE PIPELINE:
// query → [BM25 search] + [vector search]
//       → normalize → merge → temporal decay → MMR → top 5
```

### Step 4: Build memory_write Tool (20 minutes)

Create `packages/tools/src/memory-write.ts`:

```typescript
import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from '@lunar/shared';
import { chunkMarkdown } from '../../memory/src/chunker.js';
import { embedBatch } from '../../memory/src/embedder.js';
import type { VectorStore } from '../../memory/src/store.js';

export const memoryWriteTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_write',
    description: 'Save important information to memory for future retrieval. Use this when the user shares personal info, preferences, or facts they want remembered.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'A short label for what is being saved (e.g., "favorite restaurant", "pet name")',
        },
        content: {
          type: 'string',
          description: 'The information to save',
        },
        permanent: {
          type: 'string',
          enum: ['true', 'false'],
          description: '"true" for permanent facts (name, preferences), "false" for temporary/daily info',
        },
      },
      required: ['key', 'content'],
    },
  },
};

export function createMemoryWriteExecutor(store: VectorStore, basePath: string) {
  return async function executeMemoryWrite(
    args: { key: string; content: string; permanent?: string }
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const isPermanent = args.permanent === 'true';

    try {
      // Choose file: permanent facts go to MEMORY.md, daily to dated file
      const filePath = isPermanent
        ? path.join(basePath, 'MEMORY.md')
        : path.join(basePath, 'memory', `${new Date().toISOString().split('T')[0]}.md`);

      // Ensure directory exists
      await mkdir(path.dirname(filePath), { recursive: true });

      // Append to the file
      const entry = `\n## ${args.key}\n${args.content}\n_Saved: ${new Date().toISOString()}_\n`;
      await appendFile(filePath, entry);

      // Index for search (so it's immediately searchable)
      const chunks = chunkMarkdown(entry, path.relative(basePath, filePath));
      if (chunks.length > 0) {
        const embeddings = await embedBatch(chunks.map(c => c.content));
        store.insertChunks(chunks, embeddings);
      }

      return {
        name: 'memory_write',
        result: `Saved "${args.key}" to ${isPermanent ? 'permanent memory' : 'daily notes'}.`,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        name: 'memory_write',
        result: `Failed to save: ${error.message}`,
        success: false,
        durationMs: Date.now() - startTime,
      };
    }
  };
}
```

### Step 5: Test the Complete Memory System (20 minutes)

```
TEST 1 — WRITE + READ:
  You: Remember that my favorite restaurant is Pho 99
  🔧 memory_write({"key":"favorite restaurant","content":"Pho 99","permanent":"true"})
  ✅ Saved "favorite restaurant" to permanent memory.
  Lunar: Got it! I'll remember Pho 99 is your favorite restaurant.

  You: What's my favorite restaurant?
  🔧 memory_search({"query":"favorite restaurant"})
  Lunar: Your favorite restaurant is Pho 99!

TEST 2 — DIVERSITY (MMR):
  Index 10 paragraphs, 5 of which say similar things about "agent loop"
  Search "agent loop" → should get diverse results (not 5 near-duplicates)

TEST 3 — TEMPORAL DECAY:
  Write something today → search it → high score
  (Compare mentally: if this was saved 90 days ago, score would be ~12.5%)
```

---

## ✅ CHECKLIST

- [ ] Temporal decay reduces scores of old content (exponential, half-life 30 days)
- [ ] MMR re-ranking removes near-duplicate results
- [ ] Full pipeline: BM25 + Vector → merge → decay → MMR → top 5
- [ ] memory_write tool saves to MEMORY.md (permanent) or daily files (temporary)
- [ ] Written content is immediately indexed and searchable
- [ ] Agent can write AND read memories in conversation

---

## 💡 KEY TAKEAWAY

**Your memory pipeline is now production-quality: hybrid search (BM25 + vector) → temporal decay (recent > old) → MMR (diverse results). Plus the AI can save new memories. Most tutorials stop at basic vector search — you're already ahead of 90% of RAG implementations.**

---

## ❓ SELF-CHECK QUESTIONS

1. **Why is temporal decay exponential instead of linear?**
   <details><summary>Answer</summary>Exponential decay drops quickly at first (a 1-week-old note loses little, but a 1-month-old note loses 50%), mirroring how human memory works — recent events are vivid, old ones fade gradually. Linear decay would penalize all ages equally, which doesn't match real-world relevance patterns.</details>

2. **What does λ (lambda) control in MMR?**
   <details><summary>Answer</summary>λ balances relevance vs diversity. λ=1.0 = pure relevance (may have duplicates). λ=0.0 = maximum diversity (may include weakly relevant results). λ=0.7 = mostly relevance with some diversity enforcement. This is the recommended default.</details>

3. **Why index written content immediately instead of on a schedule?**
   <details><summary>Answer</summary>If the user says "Remember X" and then immediately asks "What is X?", the memory_search should find it. If we wait for a scheduled re-index, the search would return nothing, making the AI seem forgetful. Immediate indexing gives instant recall.</details>

4. **Why separate MEMORY.md (permanent) from daily files (temporal)?**
   <details><summary>Answer</summary>Permanent facts ("user's name is Hao") should never decay — they're always relevant. Daily notes ("meeting at 2pm") are temporal and should decay. Separating them lets us apply different decay policies: no decay on MEMORY.md content, full decay on daily notes.</details>

---

### 🎉 WEEK 3 COMPLETE!

```
What you built this week:
├── ✅ Text chunker (word-based + markdown-aware)
├── ✅ Embedding generation (Ollama nomic-embed-text)
├── ✅ SQLite vector store (sqlite-vec + FTS5)
├── ✅ BM25 keyword search
├── ✅ Hybrid search (BM25 + Vector, weighted merge)
├── ✅ Temporal decay (recent > old, exponential)
├── ✅ MMR re-ranking (diverse results)
├── ✅ memory_search tool (agent searches knowledge base)
├── ✅ memory_write tool (agent saves new memories)
├── ✅ Full RAG pipeline: question → search → accurate answer
└── ✅ Grounding: AI answers from evidence, not hallucination

This is the #1 most important skill for AI Engineers.
RAG is in 90% of job postings. You just built it from scratch.

Next week: channels! Talk to your AI on Telegram.
```

**Next → [Week 4, Day 16: Session Management](../week-04-channels/day-16.md)**
