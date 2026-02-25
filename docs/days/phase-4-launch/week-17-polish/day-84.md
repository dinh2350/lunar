# Day 84 — Accessibility + Help System

> 🎯 **DAY GOAL:** Build a help system, command reference, and make the web UI accessible

---

## 🔨 HANDS-ON

### 1. Built-in Help Command

```typescript
const HELP_TEXT = `🌙 **Lunar Help**

**Commands:**
/help — Show this message
/status — System health check
/memory — What I remember about you
/forget — Clear conversation history
/model — Current LLM model info
/tools — List available tools

**Tips:**
• Send images for vision analysis
• Send voice messages for transcription
• Ask me to remember things
• Use natural language — no special syntax needed

**Examples:**
"Summarize this article: [url]"
"Remember that my project uses React"
"What did we talk about yesterday?"
`;
```

### 2. Contextual Help

```typescript
function getContextualHelp(lastError?: string): string {
  if (lastError === 'tool_not_found') {
    return "I don't have that tool. Type /tools to see what's available.";
  }
  if (lastError === 'memory_empty') {
    return "I don't have memories yet. Tell me things to remember!";
  }
  if (lastError === 'rate_limited') {
    return "I'm being rate limited. Wait a moment and try again.";
  }
  return "Type /help for a list of commands.";
}
```

### 3. Web UI Accessibility (a11y)

```tsx
// Keyboard navigation
function ChatInput() {
  return (
    <div role="region" aria-label="Chat input">
      <textarea
        aria-label="Message to Lunar"
        placeholder="Type a message..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <button aria-label="Send message" type="submit">
        Send
      </button>
    </div>
  );
}

// Screen reader announcements
function MessageList({ messages }) {
  return (
    <div role="log" aria-live="polite" aria-label="Conversation">
      {messages.map((msg) => (
        <div key={msg.id} role="article" aria-label={`${msg.role} message`}>
          {msg.content}
        </div>
      ))}
    </div>
  );
}
```

### 4. Keyboard Shortcuts (Web UI)

```typescript
const SHORTCUTS = {
  'Ctrl+/':    'Toggle help panel',
  'Ctrl+K':    'Focus search / command palette',
  'Ctrl+N':    'New conversation',
  'Escape':    'Close panel / cancel',
  'Up Arrow':  'Edit last message (when input empty)',
};

useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      toggleHelp();
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  }
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, []);
```

---

## ✅ CHECKLIST

- [ ] `/help` command with full reference
- [ ] Contextual error help
- [ ] ARIA labels on all interactive elements
- [ ] `role="log"` + `aria-live` on chat area
- [ ] Keyboard shortcuts for web UI
- [ ] Focus management (auto-focus input)
- [ ] Color contrast meets WCAG AA

---

**Next → [Day 85: Week 17 Wrap](day-85.md)**
