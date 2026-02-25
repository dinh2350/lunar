import type { Guard, GuardResult, GuardContext } from '../index.js';

export class LengthGuard implements Guard {
  name = 'length';

  constructor(
    private maxLength: number = 10000,
    private maxTokenEstimate: number = 4000,
  ) {}

  async check(input: string): Promise<GuardResult> {
    if (input.length > this.maxLength) {
      return {
        passed: false,
        reason: `Input too long: ${input.length} chars (max: ${this.maxLength})`,
        severity: 'block',
        guardName: this.name,
        metadata: { length: input.length, maxLength: this.maxLength },
      };
    }

    const estimatedTokens = Math.ceil(input.length / 4);
    if (estimatedTokens > this.maxTokenEstimate) {
      return {
        passed: true,
        reason: `Large input: ~${estimatedTokens} tokens`,
        severity: 'warn',
        guardName: this.name,
      };
    }

    return { passed: true, severity: 'info', guardName: this.name };
  }
}

export class RateLimitGuard implements Guard {
  name = 'rate-limit';
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number = 20,
    private windowMs: number = 60_000,
  ) {}

  async check(input: string, context?: GuardContext): Promise<GuardResult> {
    const userId = context?.userId || 'anonymous';
    const now = Date.now();
    
    const timestamps = this.requests.get(userId) || [];
    const recent = timestamps.filter(t => now - t < this.windowMs);
    
    if (recent.length >= this.maxRequests) {
      return {
        passed: false,
        reason: `Rate limit exceeded: ${recent.length}/${this.maxRequests} per minute`,
        severity: 'block',
        guardName: this.name,
        metadata: { count: recent.length, limit: this.maxRequests },
      };
    }

    recent.push(now);
    this.requests.set(userId, recent);

    return { passed: true, severity: 'info', guardName: this.name };
  }
}
