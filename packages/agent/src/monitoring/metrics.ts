interface MetricPoint {
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export class MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();
  private timeseries = new Map<string, MetricPoint[]>();

  // ─── Counters (increment only) ───

  increment(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + amount);

    const series = this.timeseries.get(name) || [];
    series.push({ value: amount, timestamp: Date.now(), labels });
    this.timeseries.set(name, series);
  }

  // ─── Histograms (distribution of values) ───

  observe(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    if (values.length > 1000) values.shift();
    this.histograms.set(name, values);
  }

  // ─── Gauges (current value) ───

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  // ─── Queries ───

  getCounter(name: string): number {
    let total = 0;
    for (const [key, val] of this.counters) {
      if (key.startsWith(name)) total += val;
    }
    return total;
  }

  getPercentiles(name: string): { p50: number; p95: number; p99: number; avg: number } {
    const values = [...(this.histograms.get(name) || [])].sort((a, b) => a - b);
    if (values.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0 };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      avg: Math.round(avg),
    };
  }

  // ─── Dashboard summary ───

  getSummary(): Record<string, any> {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        [...this.histograms.entries()].map(([k, v]) => [
          k,
          { count: v.length, ...this.getPercentiles(k) },
        ]),
      ),
    };
  }

  // ─── Health check ───

  getHealth(): {
    status: string;
    latency: { p50: number; p95: number; p99: number; avg: number };
    errorRate: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
  } {
    const latency = this.getPercentiles('llm_latency_ms');
    const totalCalls = Math.max(this.getCounter('llm_calls_total'), 1);
    const totalErrors = this.getCounter('llm_errors_total');
    const errorRate = totalErrors / totalCalls;

    return {
      status: errorRate < 0.05 ? 'healthy' : 'degraded',
      latency,
      errorRate: `${(errorRate * 100).toFixed(1)}%`,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  private key(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

// Singleton
export const metrics = new MetricsCollector();
