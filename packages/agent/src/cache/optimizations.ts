/**
 * Execute multiple independent tool calls in parallel with timeout
 */
export async function executeToolsParallel(
  toolCalls: Array<{ name: string; args: any }>,
  tools: Record<string, (args: any) => Promise<any>>,
  options: { timeout?: number } = {},
): Promise<Array<{ name: string; result: string; error?: string; durationMs: number }>> {
  const timeout = options.timeout || 10_000;

  const promises = toolCalls.map(async (call) => {
    const start = Date.now();
    try {
      const result = await Promise.race([
        tools[call.name](call.args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tool timeout')), timeout),
        ),
      ]);
      return {
        name: call.name,
        result: String(result),
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        name: call.name,
        result: '',
        error: error.message,
        durationMs: Date.now() - start,
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Cache frequent memory searches (same query within TTL)
 */
export class MemorySearchCache {
  private cache = new Map<string, { results: any[]; timestamp: number }>();
  private ttlMs = 30_000; // 30 seconds

  async search(
    query: string,
    searchFn: (q: string) => Promise<any[]>,
  ): Promise<any[]> {
    const key = query.toLowerCase().trim();
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached.results;
    }

    const results = await searchFn(query);
    this.cache.set(key, { results, timestamp: Date.now() });
    return results;
  }

  invalidate(): void {
    this.cache.clear();
  }
}

/**
 * Stream response tokens as they arrive from Ollama
 */
export async function* streamResponse(
  prompt: string,
  model: string,
  baseUrl = 'http://localhost:11434',
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: true }),
  });

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n').filter(Boolean)) {
      try {
        const data = JSON.parse(line);
        if (data.response) {
          yield data.response;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}
