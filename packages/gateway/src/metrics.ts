/**
 * Simple metrics collector — no external dependencies.
 * Exposes /api/metrics in Prometheus format.
 */

interface MetricData {
  requests: number;
  errors: number;
  totalLatencyMs: number;
  toolCalls: Record<string, number>;
  tokenCount: number;
  startTime: number;
}

const metrics: MetricData = {
  requests: 0,
  errors: 0,
  totalLatencyMs: 0,
  toolCalls: {},
  tokenCount: 0,
  startTime: Date.now(),
};

export function recordRequest(durationMs: number, error: boolean = false) {
  metrics.requests++;
  metrics.totalLatencyMs += durationMs;
  if (error) metrics.errors++;
}

export function recordToolCall(toolName: string) {
  metrics.toolCalls[toolName] = (metrics.toolCalls[toolName] || 0) + 1;
}

export function recordTokens(count: number) {
  metrics.tokenCount += count;
}

export function getMetrics(): string {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  const avgLatency = metrics.requests > 0
    ? metrics.totalLatencyMs / metrics.requests
    : 0;

  // Prometheus text format
  return [
    `# HELP lunar_requests_total Total chat requests`,
    `# TYPE lunar_requests_total counter`,
    `lunar_requests_total ${metrics.requests}`,
    ``,
    `# HELP lunar_errors_total Total errors`,
    `# TYPE lunar_errors_total counter`,
    `lunar_errors_total ${metrics.errors}`,
    ``,
    `# HELP lunar_avg_latency_ms Average response latency`,
    `# TYPE lunar_avg_latency_ms gauge`,
    `lunar_avg_latency_ms ${avgLatency.toFixed(2)}`,
    ``,
    `# HELP lunar_tokens_total Total tokens processed`,
    `# TYPE lunar_tokens_total counter`,
    `lunar_tokens_total ${metrics.tokenCount}`,
    ``,
    `# HELP lunar_uptime_seconds Server uptime`,
    `# TYPE lunar_uptime_seconds gauge`,
    `lunar_uptime_seconds ${uptime.toFixed(0)}`,
    ``,
    ...Object.entries(metrics.toolCalls).map(([tool, count]) =>
      `lunar_tool_calls{tool="${tool}"} ${count}`
    ),
  ].join('\n');
}
