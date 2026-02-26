/**
 * Beta monitoring — dashboard, alerts, error triage
 */

import { analytics } from './analytics.js';
import { metrics } from '../monitoring/metrics.js';

// ── Dashboard API ──

export interface DashboardData {
  dailyActiveUsers: number;
  totalMessages: number;
  errorCount: number;
  errorRate: string;
  avgResponseMs: number;
  topErrors: Array<{ type: string; count: number }>;
}

export function getDashboard(): DashboardData {
  const dau = analytics.getDailyActiveUsers();
  const messages = analytics.getDailyMessages();
  const errors = analytics.getDailyErrors();
  const latency = metrics.getPercentiles('llm_latency_ms');

  return {
    dailyActiveUsers: dau,
    totalMessages: messages,
    errorCount: errors,
    errorRate: `${(analytics.getErrorRate() * 100).toFixed(1)}%`,
    avgResponseMs: latency.avg,
    topErrors: [], // Would aggregate from events in real impl
  };
}

// ── Alert System ──

export interface AlertConfig {
  maxErrorRate: number;
  maxResponseMs: number;
  checkIntervalMs: number;
  onAlert: (message: string) => Promise<void>;
}

export class AlertMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(private config: AlertConfig) {}

  start(): void {
    this.timer = setInterval(async () => {
      await this.check();
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async check(): Promise<void> {
    const errorRate = analytics.getErrorRate();
    if (errorRate > this.config.maxErrorRate) {
      await this.config.onAlert(
        `⚠️ Error rate: ${(errorRate * 100).toFixed(1)}% (threshold: ${this.config.maxErrorRate * 100}%)`,
      );
    }

    const latency = metrics.getPercentiles('llm_latency_ms');
    if (latency.avg > this.config.maxResponseMs) {
      await this.config.onAlert(
        `🐌 Avg response: ${latency.avg}ms (threshold: ${this.config.maxResponseMs}ms)`,
      );
    }
  }
}

// ── Bug Triage Priority ──

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export function triagePriority(
  blocksUsage: boolean,
  affectedUsers: 'few' | 'many',
): Priority {
  if (blocksUsage && affectedUsers === 'many') return 'P0';
  if (blocksUsage && affectedUsers === 'few') return 'P1';
  if (!blocksUsage && affectedUsers === 'many') return 'P2';
  return 'P3';
}

export const PRIORITY_ACTIONS: Record<Priority, string> = {
  P0: 'DROP EVERYTHING — fix immediately',
  P1: 'Fix NOW — within hours',
  P2: 'Fix this week',
  P3: 'Add to backlog',
};
