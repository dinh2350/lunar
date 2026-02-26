/**
 * Edge case handling — input validation, flood control, request queue, timeouts
 */

// ── Input Validation ──

export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
}

export function validateInput(message: string): ValidationResult {
  // Empty / whitespace only
  if (!message?.trim()) {
    return { valid: false, error: 'empty' };
  }

  // Too long (>10K chars)
  if (message.length > 10_000) {
    return {
      valid: true,
      sanitized: message.slice(0, 10_000) + '\n\n[Message truncated — too long]',
    };
  }

  // Too many lines (>500)
  const lines = message.split('\n');
  if (lines.length > 500) {
    return {
      valid: true,
      sanitized: lines.slice(0, 500).join('\n') + '\n\n[Truncated at 500 lines]',
    };
  }

  return { valid: true, sanitized: message.trim() };
}

// ── Flood Control (anti-spam) ──

export class FloodGuard {
  private timestamps = new Map<string, number[]>();
  private windowMs: number;
  private maxMessages: number;

  constructor(opts: { windowMs?: number; maxMessages?: number } = {}) {
    this.windowMs = opts.windowMs || 60_000;
    this.maxMessages = opts.maxMessages || 20;
  }

  check(userId: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const times = (this.timestamps.get(userId) || []).filter(
      (t) => now - t < this.windowMs,
    );

    if (times.length >= this.maxMessages) {
      const oldest = times[0];
      return {
        allowed: false,
        retryAfter: Math.ceil((oldest + this.windowMs - now) / 1000),
      };
    }

    times.push(now);
    this.timestamps.set(userId, times);
    return { allowed: true };
  }

  reset(userId: string): void {
    this.timestamps.delete(userId);
  }
}

// ── Request Queue (serialize per user) ──

export class RequestQueue {
  private active = new Map<string, Promise<void>>();

  async enqueue(userId: string, handler: () => Promise<void>): Promise<void> {
    const existing = this.active.get(userId);
    if (existing) {
      await existing;
    }

    const promise = handler().finally(() => {
      if (this.active.get(userId) === promise) {
        this.active.delete(userId);
      }
    });

    this.active.set(userId, promise);
    return promise;
  }

  get activeCount(): number {
    return this.active.size;
  }
}

// ── Timeout with Fallback ──

export async function handleWithTimeout(
  handler: () => Promise<string>,
  timeoutMs = 30_000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      handler(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new DOMException('Timeout', 'AbortError')), timeoutMs),
      ),
    ]);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return "I'm taking too long on this. Let me try a simpler answer...";
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Dynamic Timeout based on complexity ──

const DYNAMIC_TIMEOUT: Record<string, number> = {
  simple: 10_000,
  normal: 30_000,
  complex: 60_000,
  tool: 45_000,
};

export function estimateComplexity(message: string): string {
  if (message.length < 20) return 'simple';
  if (message.includes('code') || message.includes('write') || message.includes('generate'))
    return 'complex';
  return 'normal';
}

export function getTimeout(message: string): number {
  const complexity = estimateComplexity(message);
  return DYNAMIC_TIMEOUT[complexity] || DYNAMIC_TIMEOUT.normal;
}
