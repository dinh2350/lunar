import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

/**
 * Generate an embedding vector for a piece of text.
 * Uses nomic-embed-text model → 768 dimensions.
 */
export async function embed(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: 'nomic-embed-text',
    input: text,
  });
  return response.embeddings[0];
}

/**
 * Generate embeddings for multiple texts at once (batched).
 * More efficient than calling embed() one by one.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await ollama.embed({
    model: 'nomic-embed-text',
    input: texts,
  });
  return response.embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors.
 * Returns: 0.0 (completely different) to 1.0 (identical meaning)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
