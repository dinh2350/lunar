import type { VectorStore, SearchResult } from './store.js';
import { embed } from './embedder.js';

// ============================================
// Hybrid Search Configuration
// ============================================

export interface SearchOptions {
  vectorWeight: number;
  bm25Weight: number;
  limit: number;
  candidateMultiplier: number;
}

const DEFAULT_OPTIONS: SearchOptions = {
  vectorWeight: 0.7,
  bm25Weight: 0.3,
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
    return results.map(r => ({ ...r, score: 1 }));
  }

  return results.map(r => ({
    ...r,
    score: (r.score - min) / range,
  }));
}
