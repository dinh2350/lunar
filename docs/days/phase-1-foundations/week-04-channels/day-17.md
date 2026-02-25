# Day 17 — Telegram Bot

> 🎯 **DAY GOAL:** Chat with your AI on Telegram — from your phone, anywhere in the world

---

## 📚 CONCEPT 1: Telegram Bot API

### WHAT — Simple Definition

**Telegram lets you create "bot" accounts that are controlled by YOUR code.** When someone sends a message to your bot, Telegram forwards it to your server. Your code processes it, and sends a reply back through the API.

### WHY — Why Telegram First?

```
Telegram vs other platforms:
  ✅ Telegram: Free forever, no approval process, great API, works globally
  ❌ WhatsApp: Requires business verification, API costs money
  ❌ Discord: Great but gaming-focused community
  ❌ Slack: Requires workspace, enterprise-focused
  ❌ iMessage: No official bot API

For Lunar: Telegram is the best first channel because:
  1. Free bot creation (instant, no approval)
  2. Works on phone + desktop
  3. Rich features: text, images, buttons, voice
  4. grammY library makes development easy
```

### HOW — Message Flow

```
1. You create a bot via @BotFather on Telegram
2. BotFather gives you a token (API key)
3. Your code connects to Telegram's servers

Two connection modes:
  POLLING (simple, good for development):
    Your server → "Any new messages?" → Telegram
    Your server → "Any new messages?" → Telegram
    Your server → "Any new messages?" → Telegram
    Telegram → "Yes! User said 'Hello'" → Your server
    → Your server asks repeatedly (like refreshing a webpage)

  WEBHOOK (efficient, good for production):
    Telegram → POST /webhook → Your server
    → Telegram pushes messages to you (like a notification)
    → Requires your server to be publicly accessible (URL)

We'll use POLLING for now (simpler, works locally).
```

### 🔗 NODE.JS ANALOGY

```typescript
// Telegram polling = like WebSocket with long-polling fallback
// Telegram webhook = like a standard Express.js POST endpoint

// grammY is to Telegram what Express is to HTTP:
// It handles the protocol, you handle the logic.

// Express:
app.post('/api/message', (req, res) => {
  const userMessage = req.body.text;
  const reply = processMessage(userMessage);
  res.json({ reply });
});

// grammY:
bot.on('message:text', async (ctx) => {
  const userMessage = ctx.message.text;
  const reply = await processMessage(userMessage);
  await ctx.reply(reply);
});
```

---

## 📚 CONCEPT 2: Channel Connector Pattern

### WHAT — Simple Definition

**A channel connector normalizes messages from a specific platform into a standard format (InboundEnvelope), and sends replies back.** The agent engine doesn't need to know about Telegram, Discord, etc. — it just processes envelopes.

### WHY — Why Normalize?

```
WITHOUT normalization:
  The agent engine needs to handle:
  - Telegram: ctx.message.text, ctx.from.id, ctx.chat.type
  - Discord: message.content, message.author.id, message.channel.type
  - WebChat: ws.data.text, ws.data.userId
  → Agent code is full of if/else for each platform 😰

WITH normalization (InboundEnvelope):
  Every platform converts to:
  {
    provider: 'telegram',
    peerId: 'user:123456',
    text: 'Hello',
    chatType: 'direct',
    ts: '2026-02-25T10:00:00Z'
  }
  → Agent engine handles ONE format → clean code ✅
```

### HOW — Connector Architecture

```
  Telegram ─→ TelegramConnector ─→ InboundEnvelope ─→ Agent Engine
  Discord  ─→ DiscordConnector  ─→ InboundEnvelope ─→ Agent Engine
  WebChat  ─→ WebChatConnector  ─→ InboundEnvelope ─→ Agent Engine
                                                         │
  Telegram ←─ TelegramConnector ←─── reply string ←─────┘
```

---

## 🔨 HANDS-ON: Build the Telegram Connector

### Step 1: Create Your Bot (10 minutes)

1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Name: `Lunar AI` (or whatever you like)
4. Username: `your_lunar_bot` (must end in `bot`, must be unique)
5. Copy the **token** BotFather gives you (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
6. Create `.env` in your project root:
   ```
   TELEGRAM_BOT_TOKEN=your-token-here
   ```

### Step 2: Install grammY (5 minutes)

```bash
mkdir -p packages/connectors/src/telegram
cd packages/connectors
pnpm init
pnpm add grammy dotenv
```

### Step 3: Build the Connector (30 minutes)

Create `packages/connectors/src/telegram/connector.ts`:

```typescript
import { Bot, Context } from 'grammy';
import type { InboundEnvelope } from '@lunar/shared';

export interface ConnectorCallbacks {
  onMessage: (envelope: InboundEnvelope) => Promise<string>;
}

export function createTelegramBot(token: string, callbacks: ConnectorCallbacks) {
  const bot = new Bot(token);

  // Handle text messages
  bot.on('message:text', async (ctx: Context) => {
    const from = ctx.from!;
    const chat = ctx.chat!;
    const text = ctx.message!.text!;

    // Normalize to InboundEnvelope
    const envelope: InboundEnvelope = {
      provider: 'telegram',
      peerId: `user:${from.id}`,
      text: text,
      chatType: chat.type === 'private' ? 'direct' : 'group',
      ts: new Date().toISOString(),
    };

    console.log(`📨 [Telegram] ${from.first_name}: ${text}`);

    try {
      // Send "typing..." indicator
      await ctx.replyWithChatAction('typing');

      // Process through agent
      const reply = await callbacks.onMessage(envelope);

      // Send reply (split if too long for Telegram's 4096 char limit)
      if (reply.length <= 4096) {
        await ctx.reply(reply);
      } else {
        // Split into chunks
        for (let i = 0; i < reply.length; i += 4096) {
          await ctx.reply(reply.slice(i, i + 4096));
        }
      }

      console.log(`📤 [Telegram] Lunar: ${reply.slice(0, 100)}...`);
    } catch (error: any) {
      console.error(`❌ [Telegram] Error: ${error.message}`);
      await ctx.reply('Sorry, I encountered an error. Please try again.');
    }
  });

  // Handle /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '🌙 Hello! I\'m Lunar, your AI assistant.\n\n' +
      'Just send me a message and I\'ll do my best to help!\n\n' +
      'I can:\n' +
      '• Answer questions from my knowledge base\n' +
      '• Execute commands\n' +
      '• Remember things you tell me'
    );
  });

  return {
    start: () => {
      bot.start();
      console.log('🤖 Telegram bot started (polling mode)');
    },
    stop: () => bot.stop(),
  };
}
```

### Step 4: Wire to Agent Engine (20 minutes)

Create `packages/connectors/src/telegram/start.ts`:

```typescript
import 'dotenv/config';
import { createTelegramBot } from './connector.js';
import { SessionManager } from '../../../session/src/manager.js';
import { VectorStore } from '../../../memory/src/store.js';
import { runAgent } from '../../../agent/src/runner.js';
// ... import other dependencies

const SYSTEM_PROMPT = `You are Lunar, a helpful AI assistant on Telegram.
Be concise — Telegram messages should be short and readable.
Use memory_search for knowledge questions. Use memory_write for saving info.`;

// Initialize components
const sessionManager = new SessionManager('./data/sessions');
const store = new VectorStore('./data/lunar-memory.sqlite');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set in .env');

const bot = createTelegramBot(token, {
  onMessage: async (envelope) => {
    // 1. Resolve session
    const sessionId = sessionManager.resolveSessionId(
      envelope.provider,
      envelope.peerId
    );

    // 2. Load conversation history
    const history = await sessionManager.loadRecentHistory(sessionId, 20);
    const messages = sessionManager.toMessages(history);

    // 3. Run agent
    const result = await runAgent(llm, envelope.text, SYSTEM_PROMPT, messages);

    // 4. Save turns
    await sessionManager.appendTurn(sessionId, {
      role: 'user',
      content: envelope.text,
    });
    await sessionManager.appendTurn(sessionId, {
      role: 'assistant',
      content: result.reply,
    });

    return result.reply;
  },
});

bot.start();
```

### Step 5: Test Your Bot! (15 minutes)

```bash
npx tsx packages/connectors/src/telegram/start.ts
# 🤖 Telegram bot started (polling mode)
```

Open Telegram on your phone → find your bot → send a message!

```
You: /start
Bot: 🌙 Hello! I'm Lunar, your AI assistant...

You: What time is it?
Bot: 🔧 (calls get_current_datetime)
Bot: It's 3:45 PM on February 25, 2026.

You: Remember my birthday is March 15
Bot: 🔧 (calls memory_write)
Bot: Got it! I'll remember your birthday is March 15.

You: When is my birthday?
Bot: 🔧 (calls memory_search)
Bot: Your birthday is March 15!
```

**🎉 You're chatting with YOUR AI on YOUR phone!**

---

## ✅ CHECKLIST

- [ ] Bot created via @BotFather, token saved in .env
- [ ] grammY connector normalizes messages to InboundEnvelope
- [ ] Agent processes messages and returns replies
- [ ] Sessions persist across messages (Telegram peerId-based)
- [ ] /start command shows welcome message
- [ ] Long messages split at Telegram's 4096 char limit
- [ ] "typing..." indicator shows while AI thinks

---

## 💡 KEY TAKEAWAY

**Your AI is now accessible from anywhere via Telegram. The connector pattern (normalize → process → respond) means adding new channels is just writing a new connector — the agent engine stays the same.**

---

## ❓ SELF-CHECK QUESTIONS

1. **Why polling instead of webhooks for development?**
   <details><summary>Answer</summary>Polling works from localhost — no public URL needed. Webhooks require Telegram to reach your server (public URL), which needs a tunnel or cloud deployment. For development, polling is simpler. Switch to webhooks for production (Week 7).</details>

2. **Why is the InboundEnvelope important?**
   <details><summary>Answer</summary>It decouples the agent from the channel. The agent processes `{provider, peerId, text, chatType}` — it doesn't know or care about Telegram-specific APIs. When you add Discord, you write a new connector that produces the same envelope format, and the agent works without changes.</details>

---

**Next → [Day 18: WebChat Connector (WebSocket)](day-18.md)**
