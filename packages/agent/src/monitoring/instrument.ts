import { metrics } from './metrics.js';

/**
 * Wrap an LLM call function with metrics instrumentation
 */
export function instrumentLLM<T extends (...args: any[]) => Promise<any>>(
  llmCall: T,
  model = 'default',
): T {
  return (async (...args: any[]) => {
    const start = Date.now();
    metrics.increment('llm_calls_total', { model });

    try {
      const result = await llmCall(...args);
      const duration = Date.now() - start;
      metrics.observe('llm_latency_ms', duration);
      if (result?.tokensUsed) {
        metrics.increment('llm_tokens_total', {}, result.tokensUsed);
      }
      return result;
    } catch (error: any) {
      metrics.increment('llm_errors_total', { type: error.constructor.name });
      throw error;
    }
  }) as unknown as T;
}

/**
 * Wrap a tool execution function with metrics instrumentation
 */
export function instrumentTool(
  name: string,
  toolFn: (args: any) => Promise<any>,
): (args: any) => Promise<any> {
  return async (args: any) => {
    const start = Date.now();
    metrics.increment('tool_calls_total', { tool: name });

    try {
      const result = await toolFn(args);
      metrics.observe('tool_latency_ms', Date.now() - start);
      return result;
    } catch (error: any) {
      metrics.increment('tool_errors_total', { tool: name });
      throw error;
    }
  };
}

/**
 * Instrument guard pipeline checks
 */
export function instrumentGuard(
  checkFn: (input: string) => { blocked: boolean; reason: string },
): (input: string) => { blocked: boolean; reason: string } {
  return (input: string) => {
    const start = Date.now();
    const result = checkFn(input);
    metrics.observe('guard_latency_ms', Date.now() - start);
    if (result.blocked) {
      metrics.increment('guard_blocks_total', { reason: result.reason });
    }
    return result;
  };
}

/**
 * Build Fastify routes for metrics and health endpoints
 */
export function metricsRoutes(app: any): void {
  app.get('/api/metrics', async () => {
    return metrics.getSummary();
  });

  app.get('/api/metrics/health', async () => {
    return metrics.getHealth();
  });
}
