# Day 13 — Hybrid Search (BM25 + Vector + Merge)

> 🎯 **DAY GOAL:** Combine keyword search and vector search into one powerful hybrid search that's better than either alone

---

## 📚 CONCEPT 1: Hybrid Search

### WHAT — Simple Definition

**Running TWO searches (BM25 keyword + vector semantic) on the same query, then combining the results into one ranked list.** This catches both exact keywords AND similar meanings.

### WHY — Why Hybrid Beats Single Search?

```
QUERY: "ENOENT error in the agent loop"

BM25 RESULTS (keyword):
  1. ✅ "ENOENT: file not found error handling" ← has exact keyword "ENOENT"
  2. ✅ "The agent loop error recovery uses..."  ← has "agent loop" + "error"
  3. ❌ (misses results about "error handling" without exact words)

VECTOR RESULTS (meaning):
  1. ✅ "Error recovery patterns for AI agents"  ← semantically similar
  2. ✅ "How the tool executor handles failures"  ← related concept
  3. ❌ (misses the ENOENT-specific result — "ENOENT" is a code, not a concept)

HYBRID RESULTS (best of both):
  1. ✅ "ENOENT: file not found error handling"  ← from BM25
  2. ✅ "The agent loop error recovery uses..."   ← from both!
  3. ✅ "Error recovery patterns for AI agents"   ← from vector
  4. ✅ "How the tool executor handles failures"  ← from vector
  → Gets EVERYTHING relevant!
```

### WHEN — Always Use Hybrid Search?

```
✅ USE HYBRID when:
  - General knowledge search (user questions)
  - Memory retrieval (find relevant past conversations)
  - Document search (find relevant sections)

🟡 USE VECTOR ONLY when:
  - Purely conceptual queries ("what is consciousness?")
  - Similarity/recommendation ("find similar documents")

🟡 USE BM25 ONLY when:
  - Exact term search (error codes, function names, IDs)
  - The user types a specific term they know exists
```

### HOW — The Hybrid Search Pipeline

```
User query: "How does the agent handle tool errors?"
     │
     ├──→ [BM25 Search] → top 10 by keyword relevance
     │      Results: [{id:"a", score:8.5}, {id:"b", score:6.2}, ...]
     │
     └──→ [Vector Search] → top 10 by meaning similarity
            Results: [{id:"c", score:0.92}, {id:"a", score:0.87}, ...]
     │
     ↓
  [Normalize Scores]
     Both BM25 and vector scores become 0-1 range
     │
     ↓
  [Weighted Merge]
     combined = vector_score × 0.7 + bm25_score × 0.3
     Why 70/30? Vector catches meaning (more important),
     BM25 catches keywords (supporting role)
     │
     ↓
  [Sort by Combined Score]
     │
     ↓
  Top 5 results
```

### 🔗 NODE.JS ANALOGY

```typescript
// Hybrid search = like Promise.all() with two data sources, then merge:

const [apiResults, cacheResults] = await Promise.all([
  searchAPI(query),      // ← like vector search (smart but slow)
  searchCache(query),    // ← like BM25 (fast exact match)
]);

// Merge results, keeping the best from both:
const merged = mergeAndRank([...apiResults, ...cacheResults]);
return merged.slice(0, 5);
```

---

## 📚 CONCEPT 2: Score Normalization

### WHAT — Simple Definition

**Converting different score scales to the same 0-1 range so they can be fairly compared.**

### WHY — Why Normalize?

```
RAW SCORES:
  BM25 scores: 0.5 to 15.0 (higher = better keyword match)
  Vector scores: 0.0 to 1.0 (higher = more similar meaning)

Problem: BM25 score of 8.5 vs vector score of 0.92
  Which is better? Can't compare — different scales!

AFTER NORMALIZATION (min-max):
  BM25: 8.5 → 0.73 (on 0-1 scale)
  Vector: 0.92 → 0.92 (already on 0-1 scale)
  Now we can compare and combine them!
```

### HOW — Min-Max Normalization

```
normalized = (score - min) / (max - min)

Example:
  BM25 scores: [2.1, 5.3, 8.5, 6.2]
  min = 2.1, max = 8.5

  2.1 → (2.1 - 2.1) / (8.5 - 2.1) = 0.00
  5.3 → (5.3 - 2.1) / (8.5 - 2.1) = 0.50
  8.5 → (8.5 - 2.1) / (8.5 - 2.1) = 1.00
  6.2 → (6.2 - 2.1) / (8.5 - 2.1) = 0.64
```

---

## 🔨 HANDS-ON: Build Hybrid Search

### Step 1: Create the Search Module (40 minutes)

Create `packages/memory/src/search.ts`:

```typescript
import type { VectorStore, SearchResult } from './store.js';
import { embed } from './embedder.js';

// ============================================
// Hybrid Search Configuration
// ============================================

export interface SearchOptions {
  vectorWeight: number;    // 0.0-1.0: how much vector matters (default: 0.7)
  bm25Weight: number;      // 0.0-1.0: how much BM25 matters (default: 0.3)
  limit: number;           // how many results to return (default: 5)
  candidateMultiplier: number; // fetch N × limit candidates (default: 3)
}

const DEFAULT_OPTIONS: SearchOptions = {
  vectorWeight: 0.7,    // vector (meaning) is the primary signal
  bm25Weight: 0.3,      // BM25 (keywords) supports and catches exact terms
  limit: 5,
  candidateMultiplier: 3,
};

export interface HybridResult {
  id: string;
  content: string;
  filePath: string;
  combinedScore: number;
  vectorScore: number;
  bm25Score: number;
}

// ============================================
// Hybrid Search Function
// ============================================

export async function hybridSearch(
  query: string,
  store: VectorStore,
  options: Partial<SearchOptions> = {}
): Promise<HybridResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const candidates = opts.limit * opts.candidateMultiplier;

  // Step 1: Run BOTH searches in parallel
  const queryEmbedding = await embed(query);
  const [vectorResults, bm25Results] = await Promise.all([
    Promise.resolve(store.searchVector(queryEmbedding, candidates)),
    Promise.resolve(store.searchBM25(query, candidates)),
  ]);

  // Step 2: Normalize scores to 0-1 range
  const normalizedVector = normalizeScores(vectorResults);
  const normalizedBM25 = normalizeScores(bm25Results);

  // Step 3: Merge into combined scores
  const scoreMap = new Map<string, {
    vectorScore: number;
    bm25Score: number;
    content: string;
    filePath: string;
  }>();

  // Add vector results
  for (const r of normalizedVector) {
    scoreMap.set(r.id, {
      vectorScore: r.score,
      bm25Score: 0,
      content: r.content,
      filePath: r.filePath,
    });
  }

  // Merge BM25 results
  for (const r of normalizedBM25) {
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.bm25Score = r.score;  // appeared in BOTH searches!
    } else {
      scoreMap.set(r.id, {
        vectorScore: 0,
        bm25Score: r.score,
        content: r.content,
        filePath: r.filePath,
      });
    }
  }

  // Step 4: Calculate combined score and sort
  const results: HybridResult[] = [];
  for (const [id, data] of scoreMap) {
    results.push({
      id,
      content: data.content,
      filePath: data.filePath,
      vectorScore: data.vectorScore,
      bm25Score: data.bm25Score,
      combinedScore: data.vectorScore * opts.vectorWeight + data.bm25Score * opts.bm25Weight,
    });
  }

  return results
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, opts.limit);
}

// ============================================
// Score Normalization (min-max)
// ============================================

function normalizeScores(results: SearchResult[]): SearchResult[] {
  if (results.length === 0) return [];
  if (results.length === 1) return [{ ...results[0], score: 1 }];

  const scores = results.map(r => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;

  if (range === 0) {
    // All scores the same — normalize to 1
    return results.map(r => ({ ...r, score: 1 }));
  }

  return results.map(r => ({
    ...r,
    score: (r.score - min) / range,
  }));
}
```

### Step 2: Test Hybrid Search (20 minutes)

Create `packages/memory/src/test-search.ts`:

```typescript
import { VectorStore } from './store.js';
import { hybridSearch } from './search.js';

async function main() {
  const store = new VectorStore('./test-memory.sqlite');

  // Test queries
  const queries = [
    'How does the agent process messages?',   // conceptual → vector should help
    'InboundEnvelope interface',               // specific term → BM25 should help
    'ENOENT error handling in tools',          // mixed: code term + concept
    'memory search pipeline',                  // both should find relevant results
  ];

  for (const query of queries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Query: "${query}"`);
    console.log('='.repeat(60));

    const results = await hybridSearch(query, store, { limit: 3 });

    for (const r of results) {
      const v = r.vectorScore.toFixed(2);
      const b = r.bm25Score.toFixed(2);
      const c = r.combinedScore.toFixed(2);
      console.log(`\n  [combined: ${c}] (vec: ${v}, bm25: ${b})`);
      console.log(`  ${r.content.slice(0, 120)}...`);
    }
  }

  store.close();
}

main();
```

Run: `npx tsx packages/memory/src/test-search.ts`

**Look at the results:**
- "InboundEnvelope interface" → BM25 should have a high score (exact keyword)
- "How does the agent process messages?" → Vector should have a high score (semantic)
- Results that appear in BOTH searches get boosted (highest combined score)

### Step 3: Compare Hybrid vs Single (15 minutes)

Add a comparison function to the test:

```typescript
// Compare: vector only vs BM25 only vs hybrid
const query = 'How does error handling work in the agent?';

console.log('\n--- VECTOR ONLY ---');
const vecResults = store.searchVector(await embed(query), 3);
for (const r of vecResults) console.log(`  [${r.score.toFixed(3)}] ${r.content.slice(0, 80)}...`);

console.log('\n--- BM25 ONLY ---');
const bm25Results = store.searchBM25('error handling agent', 3);
for (const r of bm25Results) console.log(`  [${r.score.toFixed(3)}] ${r.content.slice(0, 80)}...`);

console.log('\n--- HYBRID ---');
const hybridResults = await hybridSearch(query, store, { limit: 3 });
for (const r of hybridResults) console.log(`  [${r.combinedScore.toFixed(3)}] ${r.content.slice(0, 80)}...`);
```

**You should see: hybrid returns the best results from both!**

---

## ✅ CHECKLIST

- [ ] Hybrid search runs BM25 + vector in parallel
- [ ] Scores normalized to 0-1 range (min-max normalization)
- [ ] Results merged with weighted scoring (70% vector, 30% BM25)
- [ ] Compared hybrid vs single search — hybrid is better
- [ ] Tested with conceptual queries (vector helps)
- [ ] Tested with exact-term queries (BM25 helps)
- [ ] Tested with mixed queries (hybrid wins)

---

## 💡 KEY TAKEAWAY

**Hybrid search = vector (finds meaning) + BM25 (finds keywords). Neither alone is good enough. Together they catch everything: "ENOENT" AND "error handling patterns." The 70/30 weight means meaning matters more, but keywords still help.**

---

## ❓ SELF-CHECK QUESTIONS

1. **Why weight vector at 0.7 and BM25 at 0.3? Why not 50/50?**
   <details><summary>Answer</summary>User questions are usually about CONCEPTS ("how does X work?"), not exact terms. Vector search understands concepts better. BM25 is great for catching specific terms (error codes, function names) that vectors might miss, but these are the minority of queries. 70/30 reflects this — vector is primary, BM25 is supporting.</details>

2. **What happens if a result appears in BOTH BM25 and vector results?**
   <details><summary>Answer</summary>It gets BOTH scores added together! `combined = vectorScore × 0.7 + bm25Score × 0.3`. This means results that are both semantically similar AND contain the exact keywords rank highest. This is the power of hybrid — double evidence = double confidence.</details>

3. **Why normalize scores before merging?**
   <details><summary>Answer</summary>BM25 returns scores like 0.5-15.0, while vector returns 0.0-1.0. Without normalization, BM25 scores would dominate just because they're larger numbers, even if vector results are better. Normalization puts both on the same 0-1 scale so the weights (0.7/0.3) work correctly.</details>

4. **When would you change the 70/30 weights?**
   <details><summary>Answer</summary>If your users search with lots of specific terms (code, error codes, IDs), increase BM25 weight to maybe 50/50. If your users ask natural language questions, keep 70/30 or even increase vector to 80/20. You can tune this based on eval results (Week 10).</details>

---

**Next → [Day 14: Connect RAG to the Agent](day-14.md)**
