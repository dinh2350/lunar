# Day 87 — Beta Monitoring + Triage

> 🎯 **DAY GOAL:** Monitor your beta in real-time — dashboards, alerts, and bug triage workflow

---

## 🔨 HANDS-ON

### 1. Simple Analytics Dashboard

```typescript
// GET /api/analytics/dashboard
async function getDashboard() {
  const [dau, messages, errors, avgResponse] = await Promise.all([
    db.get(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics WHERE action = 'message'
      AND created_at > datetime('now', '-1 day')
    `),
    db.get(`
      SELECT COUNT(*) as count FROM analytics
      WHERE action = 'message'
      AND created_at > datetime('now', '-1 day')
    `),
    db.get(`
      SELECT COUNT(*) as count FROM analytics
      WHERE action = 'error'
      AND created_at > datetime('now', '-1 day')
    `),
    db.get(`
      SELECT AVG(json_extract(metadata, '$.duration_ms')) as avg_ms
      FROM analytics WHERE action = 'message'
      AND created_at > datetime('now', '-1 day')
    `),
  ]);

  return {
    dailyActiveUsers: dau.count,
    totalMessages: messages.count,
    errorCount: errors.count,
    errorRate: errors.count / Math.max(messages.count, 1),
    avgResponseMs: Math.round(avgResponse.avg_ms || 0),
  };
}
```

### 2. Alert System

```typescript
// Check metrics every 5 minutes
setInterval(async () => {
  const stats = await getDashboard();
  
  // Error rate too high
  if (stats.errorRate > 0.1) {
    await sendAlert(`⚠️ Error rate: ${(stats.errorRate * 100).toFixed(1)}%`);
  }
  
  // Response time too slow
  if (stats.avgResponseMs > 15_000) {
    await sendAlert(`🐌 Avg response: ${stats.avgResponseMs}ms`);
  }
}, 5 * 60_000);

async function sendAlert(message: string) {
  // Send to your own Telegram
  await bot.api.sendMessage(ADMIN_CHAT_ID, message);
}
```

### 3. Bug Triage Workflow

```
Bug Priority Matrix:
┌──────────────┬────────────────┬─────────────┐
│              │ Few Users      │ Many Users  │
├──────────────┼────────────────┼─────────────┤
│ Blocks Usage │ P1 — Fix NOW  │ P0 — DROP   │
│              │                │ EVERYTHING  │
├──────────────┼────────────────┼─────────────┤
│ Annoying     │ P3 — Backlog  │ P2 — Fix    │
│              │                │ this week   │
└──────────────┴────────────────┴─────────────┘
```

### 4. Error Log Analysis

```typescript
// Group errors by type for triage
async function getErrorSummary() {
  return db.all(`
    SELECT 
      json_extract(metadata, '$.error_type') as type,
      COUNT(*) as count,
      MIN(created_at) as first_seen,
      MAX(created_at) as last_seen
    FROM analytics
    WHERE action = 'error'
    AND created_at > datetime('now', '-7 days')
    GROUP BY type
    ORDER BY count DESC
  `);
}
```

---

## ✅ CHECKLIST

- [ ] Analytics dashboard endpoint
- [ ] Alert system for high error rate / slow responses
- [ ] Bug triage priority matrix defined
- [ ] Error log grouping + analysis
- [ ] Daily check routine established
- [ ] Feedback reviewed and categorized

---

**Next → [Day 88: Iteration + Fixes](day-88.md)**
