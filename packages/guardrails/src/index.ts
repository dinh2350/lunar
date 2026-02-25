export interface GuardResult {
  passed: boolean;
  reason?: string;
  severity: 'block' | 'warn' | 'info';
  guardName: string;
  metadata?: Record<string, unknown>;
}

export interface Guard {
  name: string;
  check(input: string, context?: GuardContext): Promise<GuardResult>;
}

export interface GuardContext {
  userId?: string;
  channel?: string;
  sessionId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export class GuardPipeline {
  private guards: Guard[] = [];

  add(guard: Guard): this {
    this.guards.push(guard);
    return this;
  }

  async check(input: string, context?: GuardContext): Promise<{
    allowed: boolean;
    results: GuardResult[];
    blockReason?: string;
  }> {
    const results: GuardResult[] = [];

    for (const guard of this.guards) {
      try {
        const result = await guard.check(input, context);
        results.push(result);

        if (!result.passed && result.severity === 'block') {
          return {
            allowed: false,
            results,
            blockReason: result.reason,
          };
        }
      } catch (error) {
        console.error(`Guard ${guard.name} error:`, error);
        results.push({
          passed: true,
          guardName: guard.name,
          severity: 'info',
          reason: `Guard error: ${(error as Error).message}`,
        });
      }
    }

    return { allowed: true, results };
  }
}
