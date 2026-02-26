# Lunar UX Audit Checklist

## Conversation Flow
- [ ] Typing indicators work on all channels
- [ ] Follow-up suggestions appear after responses
- [ ] Long responses are chunked appropriately (< 4000 chars per chunk)
- [ ] Error messages are friendly, not technical

## Personality
- [ ] System prompt produces consistent tone
- [ ] Welcome messages feel natural (first-time vs returning)
- [ ] Bot responds appropriately to greetings/thanks/goodbye
- [ ] "I don't know" handled gracefully

## Edge Cases
- [ ] Empty messages → helpful prompt
- [ ] Huge messages → truncated with notice
- [ ] Rapid fire → flood control active (20/min)
- [ ] Timeout → graceful fallback message
- [ ] Concurrent requests → queued per user
- [ ] Invalid UTF-8 / special chars → sanitized

## Accessibility
- [ ] /help command works on all channels
- [ ] /status, /memory, /forget, /model, /tools all functional
- [ ] Web UI keyboard navigable
- [ ] Screen reader compatible (ARIA labels)
- [ ] Sufficient color contrast

## Manual Test Script

```bash
# Run through each channel:
# 1. Send empty message → expect helpful response
# 2. Send very long message (5000+ words) → expect truncation
# 3. Send 20+ messages fast → expect rate limit
# 4. /help → expect help text
# 5. Start new conversation → expect welcome message
# 6. Wait 30s on slow query → expect timeout message
```

## Week 17 Summary

| Day | Topic | Key Deliverable |
|-----|-------|----------------|
| 81 | Conversation UX | Typing indicators, formatting, follow-ups |
| 82 | Personality | System prompt, branding, welcome messages |
| 83 | Edge Cases | Input validation, flood control, timeouts |
| 84 | Accessibility | Help system, keyboard shortcuts |
| 85 | Week Wrap | UX audit, final polish pass |
