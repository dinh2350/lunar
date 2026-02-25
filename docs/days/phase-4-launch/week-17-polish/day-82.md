# Day 82 — Personality + Branding

> 🎯 **DAY GOAL:** Give Lunar a consistent personality — system prompt design, tone of voice, and branding across channels

---

## 🔨 HANDS-ON: Agent Personality

### 1. System Prompt Template

```typescript
const LUNAR_SYSTEM_PROMPT = `You are Lunar, a helpful AI assistant.

## Personality
- Friendly but professional — like a knowledgeable colleague
- Concise — get to the point, expand only when asked
- Honest — say "I don't know" when uncertain
- Proactive — suggest next steps when appropriate

## Formatting Rules
- Use markdown for structured answers
- Use code blocks with language tags
- Keep paragraphs short (2-3 sentences max)
- Use bullet points for lists of 3+ items

## Memory Awareness
- Reference past conversations naturally: "As we discussed..."
- Don't repeat info the user already knows
- Track user preferences and adapt

## Boundaries
- Never pretend to have capabilities you don't have
- Redirect politely for out-of-scope requests
- Always prioritize accuracy over speed
`;
```

### 2. Dynamic System Context

```typescript
function buildSystemPrompt(userId: string, context: ConversationContext): string {
  const userPrefs = await memory.getUserPreferences(userId);
  const timezone = userPrefs?.timezone || 'UTC';
  const hour = new Date().toLocaleString('en', { timeZone: timezone, hour: 'numeric' });
  
  const timeGreeting = +hour < 12 ? 'morning' : +hour < 18 ? 'afternoon' : 'evening';
  
  return `${LUNAR_SYSTEM_PROMPT}

## Current Context
- Time: ${new Date().toISOString()} (user's ${timeGreeting})
- Channel: ${context.channel}
- Conversation length: ${context.messageCount} messages
- User preferences: ${JSON.stringify(userPrefs || {})}
`;
}
```

### 3. Welcome Messages

```typescript
const WELCOME_MESSAGES = {
  firstTime: [
    "Hey! I'm Lunar 🌙 — your AI assistant.",
    "I can help with code, answer questions, remember things for you, and more.",
    "What can I help you with today?"
  ].join('\n'),
  
  returning: (name: string) =>
    `Welcome back, ${name}! What are we working on today?`,
  
  newDay: (name: string) =>
    `Good to see you again, ${name}. Ready for a new day?`,
};
```

### 4. Branding Assets

```
ASCII Logo:
  ╦  ╦ ╦╔╗╔╔═╗╦═╗
  ║  ║ ║║║║╠═╣╠╦╝
  ╩═╝╚═╝╝╚╝╩ ╩╩╚═

Color Palette (for web UI):
  Primary:   #6366f1 (Indigo)
  Secondary: #8b5cf6 (Violet)
  Accent:    #f59e0b (Amber)
  
Bot Avatar: 🌙 (Moon emoji as placeholder)
```

---

## ✅ CHECKLIST

- [ ] System prompt polished with personality
- [ ] Dynamic context injection (time, channel, prefs)
- [ ] Welcome messages for first-time / returning users
- [ ] Consistent tone across all channels
- [ ] ASCII logo + color palette defined
- [ ] Bot avatar set on Telegram + Discord

---

**Next → [Day 83: Edge Cases + Resilience](day-83.md)**
