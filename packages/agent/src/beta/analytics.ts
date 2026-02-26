/**
 * Beta feedback collection + usage analytics
 */

export interface FeedbackEntry {
  id: string;
  userId: string;
  channel: string;
  text: string;
  category?: 'bug' | 'feature' | 'ux' | 'performance' | 'praise';
  createdAt: string;
}

export interface UsageEvent {
  userId: string;
  action: 'message' | 'tool_use' | 'error' | 'feedback' | 'command';
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * In-memory analytics store (replace with SQLite in production)
 */
export class AnalyticsTracker {
  private events: UsageEvent[] = [];
  private feedback: FeedbackEntry[] = [];

  trackEvent(event: UsageEvent): void {
    this.events.push(event);
    // Keep last 10000 events in memory
    if (this.events.length > 10_000) {
      this.events = this.events.slice(-10_000);
    }
  }

  addFeedback(entry: FeedbackEntry): void {
    this.feedback.push(entry);
  }

  // ── Queries ──

  getDailyActiveUsers(): number {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const users = new Set(
      this.events
        .filter((e) => e.timestamp.getTime() > oneDayAgo && e.action === 'message')
        .map((e) => e.userId),
    );
    return users.size;
  }

  getDailyMessages(): number {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.events.filter(
      (e) => e.timestamp.getTime() > oneDayAgo && e.action === 'message',
    ).length;
  }

  getDailyErrors(): number {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.events.filter(
      (e) => e.timestamp.getTime() > oneDayAgo && e.action === 'error',
    ).length;
  }

  getErrorRate(): number {
    const messages = this.getDailyMessages();
    const errors = this.getDailyErrors();
    return messages > 0 ? errors / messages : 0;
  }

  getFeedback(): FeedbackEntry[] {
    return [...this.feedback];
  }

  getRecentFeedback(limit = 20): FeedbackEntry[] {
    return this.feedback.slice(-limit);
  }
}

// ── Beta Success Metrics ──

export const BETA_TARGETS = {
  dailyActiveUsers: 5,
  messagesPerUserPerDay: 3,
  errorRate: 0.05, // < 5%
  responseTimeP95: 10_000, // < 10s
  userRetention7Day: 0.5, // > 50%
  feedbackSubmissions: 10,
};

export function checkBetaHealth(tracker: AnalyticsTracker): Record<string, { value: number; target: number; pass: boolean }> {
  const dau = tracker.getDailyActiveUsers();
  const messages = tracker.getDailyMessages();
  const errorRate = tracker.getErrorRate();

  return {
    dailyActiveUsers: { value: dau, target: BETA_TARGETS.dailyActiveUsers, pass: dau >= BETA_TARGETS.dailyActiveUsers },
    messagesPerDay: { value: messages, target: BETA_TARGETS.dailyActiveUsers * BETA_TARGETS.messagesPerUserPerDay, pass: messages >= BETA_TARGETS.dailyActiveUsers * BETA_TARGETS.messagesPerUserPerDay },
    errorRate: { value: errorRate, target: BETA_TARGETS.errorRate, pass: errorRate <= BETA_TARGETS.errorRate },
  };
}

// Singleton
export const analytics = new AnalyticsTracker();
