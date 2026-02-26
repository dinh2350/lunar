import { createHash } from 'crypto';

interface CacheEntry {
  response: string;
  timestamp: number;
  hits: number;
}

export class LLMCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(options: { maxSize?: number; ttlMs?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes
  }

  private hash(messages: any[], options: any): string {
    const key = JSON.stringify({ messages, options });
    return createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  get(messages: any[], options: any): string | null {
    const key = this.hash(messages, options);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.response;
  }

  set(messages: any[], options: any, response: string): void {
    if (this.cache.size >= this.maxSize) {
      const oldest = [...this.cache.entries()].sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      )[0];
      if (oldest) this.cache.delete(oldest[0]);
    }

    this.cache.set(this.hash(messages, options), {
      response,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  stats(): { size: number; hitRate: string } {
    const entries = [...this.cache.values()];
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    return {
      size: this.cache.size,
      hitRate: entries.length
        ? `${((totalHits / (totalHits + entries.length)) * 100).toFixed(1)}%`
        : '0%',
    };
  }

  clear(): void {
    this.cache.clear();
  }
}
