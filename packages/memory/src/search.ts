import type { VectorStore, SearchResult } from './store.js';
import { embed, cosineSimilarity } from './embedder.js';

// ============================================
// Hybrid Search Configuration
// ============================================

export interface SearchOptions {
  vectorWeight: number;
  bm25Weight: number;
  limit: number;
  candidateMultiplier: number;
  halfLifeDays: number;
  mmrLambda: number;
}

const DEFAULT_OPTIONS: SearchOptions = {
  vectorWeight: 0.7,
  bm25Weight: 0.3,
  limit: 5,
  candidateMultiplier: 3,
  halfLifeDays: 30,
  mmrLambda: 0.7,
};

export interface HybridResult {
  id: string;
  content: string;
  filePath: string;
  combinedScore: number;
  vectorScore: number;
  bm25Score: number;
  decayFactor?: number;
}

// ============================================
// Hybrid Search Function (full pipeline)
// ============================================

export async function hybridSearch(
  query: string,
  store: VectorStore,
  options: Partial<SearchOptions> = {},
): Promise<HybridResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const candidates = opts.limit * opts.candidateMultiplier;

  // Step 1: Run BOTH searches in parallel
  const queryEmbedding = await embed(query);
  const [vectorResults, bm25Results] = await Promise.all([
    Promise.resolve(store.searchVector(queryEmbedding, candidates)),
    Promise.resolve(store.searchBM25(query, candidates)),
  ]);

  // Step 2: Normalize + Merge
  const merged = mergeResults(vectorResults, bm25Results, opts);

  // Step 3: Temporal decay (recent > old)
  const decayed = applyTemporalDecay(merged, opts.halfLifeDays);

  // Step 4: MMR re-ranking (diverse results)
  const embeddings = new Map<string, number[]>();
  for (const r of vectorResults) {
    // Use vector results' embeddings for MMR diversity check
    embeddings.set(r.id, queryEmbedding); // approximate
  }
  const diverse = mmrRerank(decayed, embeddings, opts.mmrLambda, opts.limit);

  return diverse;
}

// ============================================
// Merge BM25 + Vector results
// ============================================

function mergeResults(
  vectorResults: SearchResult[],
  bm25Results: SearchResult[],
  opts: SearchOptions,
): HybridResult[] {
  const normalizedVector = normalizeScores(vectorResults);
  const normalizedBM25 = normalizeScores(bm25Results);

  const scoreMap = new Map<string, {
    vectorScore: number;
    bm25Score: number;
    content: string;
    filePath: string;
  }>();

  for (const r of normalizedVector) {
    scoreMap.set(r.id, {
      vectorScore: r.score,
      bm25Score: 0,
      content: r.content,
      filePath: r.filePath,
    });
  }

  for (const r of normalizedBM25) {
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.bm25Score = r.score;
    } else {
      scoreMap.set(r.id, {
        vectorScore: 0,
        bm25Score: r.score,
        content: r.content,
        filePath: r.filePath,
      });
    }
  }

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

  return results.sort((a, b) => b.combinedScore - a.combinedScore);
}

// ============================================
// Temporal Decay
// ============================================

function applyTemporalDecay(
  results: HybridResult[],
  halfLifeDays = 30,
): HybridResult[] {
  const now = Date.now();

  return results.map(r => {
    // Extract date from filePath for daily files (e.g., "memory/2026-02-25.md")
    const dateMatch = r.filePath.match(/(\d{4}-\d{2}-\d{2})/);
    const createdAt = dateMatch ? new Date(dateMatch[1]).getTime() : now;
    const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);

    // No decay for non-dated files (permanent memory, docs)
    const decayFactor = dateMatch ? Math.pow(0.5, ageDays / halfLifeDays) : 1.0;

    return {
      ...r,
      combinedScore: r.combinedScore * decayFactor,
      decayFactor,
    };
  }).sort((a, b) => b.combinedScore - a.combinedScore);
}

// ============================================
// MMR (Maximal Marginal Relevance)
// ============================================

function mmrRerank(
  results: HybridResult[],
  _embeddings: Map<string, number[]>,
  lambda = 0.7,
  limit = 5,
): HybridResult[] {
  if (results.length <= 1) return results.slice(0, limit);

  const selected: HybridResult[] = [];
  const remaining = [...results];

  // Always pick the top result first
  selected.push(remaining.shift()!);

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].combinedScore;

      // Simple content-based similarity check for diversity
      let maxSimToSelected = 0;
      for (const sel of selected) {
        const sim = contentSimilarity(remaining[i].content, sel.content);
        maxSimToSelected = Math.max(maxSimToSelected, sim);
      }

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

/**
 * Simple word overlap similarity for MMR diversity.
 * Returns 0-1 where 1 = identical word sets.
 */
function contentSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
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
    return results.map(r => ({ ...r, score: 1 }));
  }

  return results.map(r => ({
    ...r,
    score: (r.score - min) / range,
  }));
}
