# Day 81 — Conversation UX Patterns

> 🎯 **DAY GOAL:** Make Lunar feel natural — typing indicators, error messages, follow-up suggestions, and conversation flow

---

## 🔨 HANDS-ON: UX Improvements

### 1. Typing Indicator

```typescript
// Show "Lunar is typing..." while processing
async function handleMessage(ctx: ChannelContext, message: string) {
  // Start typing indicator
  const stopTyping = ctx.startTyping(); // Channel-specific
  
  try {
    const response = await agent.handle(message);
    stopTyping();
    await ctx.reply(response);
  } catch {
    stopTyping();
    await ctx.reply("I had trouble with that. Could you rephrase?");
  }
}

// Telegram typing
bot.api.sendChatAction(chatId, 'typing');

// Discord typing
channel.sendTyping();
```

### 2. Smart Follow-up Suggestions

```typescript
function generateFollowUps(response: string, context: string): string[] {
  const suggestions: string[] = [];
  
  if (response.includes('saved') || response.includes('remember')) {
    suggestions.push('What do you remember about me?');
  }
  if (response.includes('code') || response.includes('function')) {
    suggestions.push('Can you explain this code?', 'Can you add tests?');
  }
  if (response.includes('error') || response.includes('bug')) {
    suggestions.push('How do I fix this?', 'Show me an example');
  }
  
  return suggestions.slice(0, 3);
}
```

### 3. Graceful Error Messages

```typescript
const ERROR_MESSAGES = {
  timeout: "I'm taking longer than expected. Let me try a simpler approach...",
  rateLimit: "I need a moment to catch my breath. Try again in a few seconds.",
  toolError: "I tried to look that up but ran into an issue. Let me try differently.",
  llmError: "I'm having trouble thinking right now. Please try again shortly.",
  default: "Something went wrong on my end. Could you try rephrasing your question?",
};
```

### 4. Message Formatting

```typescript
// Format long responses for readability
function formatResponse(text: string, channel: string): string {
  // Telegram supports Markdown
  if (channel === 'telegram') {
    return text; // Already Markdown
  }
  
  // Discord supports limited Markdown
  if (channel === 'discord') {
    return text.replace(/#{4,}/g, '###'); // Max h3
  }
  
  // WebChat — full HTML support
  if (channel === 'web') {
    return markdownToHtml(text);
  }
  
  return text;
}
```

---

## ✅ CHECKLIST

- [ ] Typing indicators on all channels
- [ ] Smart follow-up suggestions
- [ ] Graceful, user-friendly error messages
- [ ] Channel-specific formatting
- [ ] Long responses split into readable chunks
- [ ] Progress updates for slow operations

---

**Next → [Day 82: Personality + Branding](day-82.md)**
