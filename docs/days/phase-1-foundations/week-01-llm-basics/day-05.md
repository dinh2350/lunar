# Day 5 — Streaming + Multiple Models

> 🎯 **DAY GOAL:** Make AI responses appear word-by-word (streaming) and learn to switch between models

---

## 📚 CONCEPT 1: Streaming Responses

### WHAT — Simple Definition

**Streaming = getting the AI's response word-by-word as it's generated**, instead of waiting for the entire response to finish.

```
WITHOUT streaming (bad UX):
  User types question → waits 5 seconds seeing nothing → entire answer appears at once
  [__________________...waiting...__________________] [FULL ANSWER APPEARS]

WITH streaming (good UX):
  User types question → words appear immediately, one by one
  [The] [capital] [of] [Vietnam] [is] [Hanoi] [.]
  ↑ first word appears in <0.5 seconds!
```

### WHY — Why Does Streaming Matter?

**Perceived speed.** The AI doesn't actually respond faster — streaming just shows you the output AS it's being generated.

```
Without streaming:
  Time-to-first-word: 5 seconds (user stares at blank screen)
  Total time: 5 seconds
  User thinks: "this is slow"

With streaming:
  Time-to-first-word: 0.3 seconds (user sees first word immediately)
  Total time: 5 seconds (same!)
  User thinks: "this is fast!"
```

**The same response takes the same total time. But streaming FEELS 10x faster.**

Every production AI app uses streaming: ChatGPT, Claude, Gemini — they all stream.

### WHEN — When to Use Streaming?

- ✅ **Chat interfaces** — always stream (UX is dramatically better)
- ✅ **CLI tools** — stream for better experience
- ✅ **Any response > 1 second** — stream it
- ❌ **Backend API calls where you need the full text** (e.g., evaluating a response) — use non-streaming (simpler code)

### HOW — How Does Streaming Work?

```
WITHOUT streaming:
┌──────────┐         ┌──────────┐
│ Your Code│  ──────►│ Ollama   │  (AI generates all tokens internally)
│          │  ◄──────│          │  Returns: "The capital of Vietnam is Hanoi."
└──────────┘  1 big  └──────────┘
              response

WITH streaming:
┌──────────┐         ┌──────────┐
│ Your Code│  ──────►│ Ollama   │
│          │  ◄──────│          │  Chunk 1: "The"
│          │  ◄──────│          │  Chunk 2: " capital"
│          │  ◄──────│          │  Chunk 3: " of"
│          │  ◄──────│          │  Chunk 4: " Vietnam"
│          │  ◄──────│          │  Chunk 5: " is"
│          │  ◄──────│          │  Chunk 6: " Hanoi"
│          │  ◄──────│          │  Chunk 7: "."
│          │  ◄──────│          │  [DONE]
└──────────┘  many   └──────────┘
              small chunks
```

**Under the hood:** Streaming uses **Server-Sent Events (SSE)** or **chunked HTTP responses** — the server keeps the connection open and sends data as it's produced.

### 🔗 NODE.JS ANALOGY

Streaming is like the difference between `readFile` and `createReadStream`:

```typescript
// NON-STREAMING: Wait for entire file to load into memory
const data = await fs.readFile('big-file.txt', 'utf8');
console.log(data);
// ↑ waits until ENTIRE file is read, then prints all at once

// STREAMING: Process file chunk by chunk
const stream = fs.createReadStream('big-file.txt', 'utf8');
stream.on('data', (chunk) => {
  process.stdout.write(chunk);  // prints as each chunk arrives
});
// ↑ prints immediately as data arrives — same total time, better UX

// LLM streaming is the EXACT same pattern:
const stream = await ollama.chat({ model: 'llama3.3', messages, stream: true });
for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);  // prints each token
}
```

You already know `ReadableStream`, `EventEmitter`, `for await`. LLM streaming uses the same concepts!

---

## 📚 CONCEPT 2: Multiple Models (Choosing the Right Brain)

### WHAT — Simple Definition

**Different AI models have different strengths**, just like different databases are good at different things.

```
Models are like databases:
  PostgreSQL = reliable, good at everything → llama3.3
  Redis = super fast, limited features     → qwen2.5:3b
  MongoDB = flexible, good for documents   → gemma2:27b
```

### WHY — Why Use Multiple Models?

| Situation | Best Choice | Why |
|---|---|---|
| General conversation | llama3.3 (8B) | Best balance of quality and speed |
| Fast simple answers | qwen2.5:3b | Small, fast, good enough for simple tasks |
| Need highest quality | llama3.3 (70B) or cloud API | Best reasoning, but slow/expensive |
| Embeddings (search) | nomic-embed-text | Designed specifically for embeddings |
| Code generation | codestral or deepseek-coder | Trained specifically on code |

### WHEN — When to Switch Models?

**Lunar's fallback strategy** (from the architecture doc):

```
Request comes in
    │
    ▼
┌─────────────────┐
│ Try Ollama (local) │ ← Free, private, no internet needed
│ llama3.3        │
└────────┬────────┘
         │ If fails (too slow, error, model not loaded)
         ▼
┌─────────────────┐
│ Try Groq (cloud) │ ← Free tier, VERY fast (300 tokens/sec)
│ llama3.3-70b    │
└────────┬────────┘
         │ If fails (rate limit, network error)
         ▼
┌─────────────────┐
│ Try Gemini (cloud)│ ← Free tier, good quality
│ gemini-1.5-flash │
└────────┬────────┘
         │ If all fail
         ▼
┌─────────────────┐
│ Return error     │
│ "AI unavailable" │
└─────────────────┘
```

### HOW — How Model Sizes Work

Model names often include a size: `llama3.3:8b`, `qwen2.5:7b`, `llama3.3:70b`

```
"b" = billions of parameters (the "brain cells" of the model)

1b-3b   = Small   → fast, basic tasks, fits in 2GB RAM
7b-8b   = Medium  → good balance, fits in 4-6GB RAM ← SWEET SPOT for local
13b     = Large   → better quality, needs 8GB+ RAM
30b-70b = XL      → near-GPT-4 quality, needs 40GB+ RAM or cloud
```

**Rule of thumb for your Mac:**
```
8GB RAM Mac  → use 3b-8b models
16GB RAM Mac → use 8b-13b models
32GB+ RAM    → use up to 30b models
```

### 🔗 NODE.JS ANALOGY

Multiple models = choosing the right npm package for the job:

```typescript
// Like choosing between lightweight vs full-featured:
// express (small, fast)      ↔ qwen2.5:3b (small, fast)
// fastify (balanced)         ↔ llama3.3:8b (balanced)
// nest.js (feature-rich)     ↔ llama3.3:70b (high quality)

// And using fallbacks:
// Like trying Redis cache first, then PostgreSQL:
try {
  return await redis.get(key);      // fast, might miss
} catch {
  return await postgres.query(sql); // slower, always works
}

// Same pattern for LLMs:
try {
  return await ollama.chat(...);     // local, free, might be slow
} catch {
  return await groq.chat(...);       // cloud, free tier, always fast
}
```

---

## 📚 CONCEPT 3: The LLM Provider Interface (Clean Architecture)

### WHAT — Simple Definition

**An interface that makes all LLM providers look the same to your code.** Whether you use Ollama, Groq, or Gemini, the calling code is identical.

### WHY — Why Use an Interface?

Without an interface, switching models means changing code everywhere:

```typescript
// BAD: tightly coupled to Ollama
if (provider === 'ollama') {
  response = await ollamaClient.chat({ model: 'llama3.3', messages });
} else if (provider === 'groq') {
  response = await groqClient.createChatCompletion({ model: 'llama3', messages });
} else if (provider === 'gemini') {
  response = await geminiClient.generateContent(messages.map(...));
}
// Nightmare when adding a new provider!
```

With an interface:

```typescript
// GOOD: all providers implement the same interface
const response = await provider.chat(messages);
// Don't care if it's Ollama, Groq, or Gemini — same code!
```

### 🔗 NODE.JS ANALOGY

Like how Mongoose and Prisma both give you `.find()` even though MongoDB and PostgreSQL are completely different:

```typescript
// Mongoose:
await User.find({ name: 'Hao' });

// Prisma:
await prisma.user.findMany({ where: { name: 'Hao' } });

// Different backends, similar interface → easy to switch
```

---

## 🔨 HANDS-ON: Add Streaming + Provider Interface

### Step 1: Create the LLM Provider Interface (15 minutes)

Update `packages/agent/src/llm/types.ts`:

```typescript
/**
 * A single message in the conversation.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * LLM Provider Interface — the contract every LLM provider must follow.
 * 
 * WHY: So we can swap Ollama ↔ Groq ↔ Gemini without changing any calling code.
 * 
 * Think of it like a database driver interface:
 *   interface DB { query(sql: string): Promise<Row[]> }
 *   class PostgresDB implements DB { ... }
 *   class MySQLDB implements DB { ... }
 */
export interface LLMProvider {
  /** Provider name (for logging) */
  readonly name: string;

  /** Send messages, get full response */
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;

  /** Send messages, get response token by token */
  chatStream(
    messages: Message[],
    onToken: (token: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;        // the full response text
  model: string;          // which model was actually used
  tokensUsed?: number;    // how many tokens (if available)
}
```

### Step 2: Implement the Ollama Provider (20 minutes)

Update `packages/agent/src/llm/client.ts`:

```typescript
import { Ollama } from 'ollama';
import type { LLMProvider, Message, ChatOptions, ChatResponse } from './types.js';

/**
 * Ollama LLM Provider — runs AI locally on your Mac.
 * 
 * WHAT: Wraps the Ollama API into a clean provider interface
 * WHY:  So we can swap to Groq/Gemini later without changing other code
 * WHEN: Default provider for development (free, private, offline)
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private client: Ollama;
  private defaultModel: string;

  constructor(host = 'http://localhost:11434', defaultModel = 'llama3.3') {
    this.client = new Ollama({ host });
    this.defaultModel = defaultModel;
  }

  /**
   * Non-streaming chat — waits for full response.
   * Use when: you need the complete text before proceeding
   * (e.g., evaluating the response, parsing JSON from it)
   */
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel;

    const response = await this.client.chat({
      model,
      messages,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2048,
      },
    });

    return {
      content: response.message.content,
      model,
      tokensUsed: response.eval_count,
    };
  }

  /**
   * Streaming chat — calls onToken for each word as it's generated.
   * Use when: displaying to user (CLI, chat UI, Telegram)
   * 
   * How it works:
   *   1. Ollama starts generating tokens
   *   2. Each token is sent to onToken() immediately
   *   3. Meanwhile, we build the full string
   *   4. When done, return the complete response
   */
  async chatStream(
    messages: Message[],
    onToken: (token: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel;

    const stream = await this.client.chat({
      model,
      messages,
      stream: true,   // ← THE KEY: enables streaming
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2048,
      },
    });

    // Collect the full response while streaming each token
    let fullContent = '';

    // "for await" is the JS way to read async streams — you already know this!
    // Just like: for await (const chunk of readStream) { ... }
    for await (const chunk of stream) {
      const token = chunk.message.content;
      fullContent += token;
      onToken(token);  // ← print/display immediately
    }

    return {
      content: fullContent,
      model,
    };
  }
}

// Default provider instance
export const defaultProvider = new OllamaProvider();
```

### Step 3: Update CLI to Use Streaming (20 minutes)

Update `packages/agent/src/cli.ts`:

```typescript
import * as readline from 'readline';
import { OllamaProvider } from './llm/client.js';
import type { Message } from './llm/types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// The AI provider
const provider = new OllamaProvider();

// Conversation history
const messages: Message[] = [
  {
    role: 'system',
    content: 'You are Lunar, a helpful personal assistant. Be concise and friendly.',
  },
];

// Config
let temperature = 0.7;
let model = 'llama3.3';
let useStreaming = true;

/**
 * Chat with streaming — tokens appear word by word
 */
async function chatWithStreaming(userInput: string): Promise<string> {
  messages.push({ role: 'user', content: userInput });

  process.stdout.write('\nLunar: ');  // print prefix without newline

  const response = await provider.chatStream(
    messages,
    (token) => {
      process.stdout.write(token);  // ← each word appears immediately!
    },
    { model, temperature },
  );

  process.stdout.write('\n\n');  // add newline after response

  messages.push({ role: 'assistant', content: response.content });
  return response.content;
}

/**
 * Chat without streaming — full response at once
 */
async function chatWithoutStreaming(userInput: string): Promise<string> {
  messages.push({ role: 'user', content: userInput });

  console.log('Lunar is thinking...');
  const response = await provider.chat(messages, { model, temperature });

  console.log(`\nLunar: ${response.content}\n`);
  messages.push({ role: 'assistant', content: response.content });
  return response.content;
}

/**
 * Handle slash commands
 */
function handleCommand(input: string): boolean {
  const [cmd, ...args] = input.split(' ');

  switch (cmd) {
    case '/stream': {
      useStreaming = !useStreaming;
      console.log(`✅ Streaming: ${useStreaming ? 'ON' : 'OFF'}\n`);
      return true;
    }
    case '/temp': {
      const t = parseFloat(args[0]);
      if (!isNaN(t)) { temperature = t; console.log(`✅ Temperature: ${t}\n`); }
      return true;
    }
    case '/model': {
      if (args[0]) { model = args[0]; console.log(`✅ Model: ${model}\n`); }
      else console.log(`Current model: ${model}\n`);
      return true;
    }
    case '/models': {
      console.log(`
Available models (run "ollama pull <name>" to download):
  llama3.3        — 8B general purpose (recommended)
  qwen2.5:7b      — 7B fast and capable
  qwen2.5:3b      — 3B very fast, basic tasks
  codestral       — specialized for code
  nomic-embed-text — embeddings (not for chat)
      `);
      return true;
    }
    case '/history': {
      const turns = messages.filter(m => m.role !== 'system').length;
      const tokens = messages.reduce((s, m) => s + Math.ceil(m.content.split(/\s+/).length * 1.3), 0);
      console.log(`📜 ${turns} messages, ~${tokens} tokens\n`);
      return true;
    }
    case '/clear': {
      messages.splice(1);
      console.log('🗑️  History cleared\n');
      return true;
    }
    case '/help': {
      console.log(`
Commands:
  /stream           Toggle streaming on/off
  /temp <0-2>       Set temperature
  /model <name>     Switch model
  /models           List available models
  /history          Show conversation size
  /clear            Clear history
  /help             Show this
  exit              Quit
      `);
      return true;
    }
    default: return false;
  }
}

function ask(): void {
  rl.question('You: ', async (input) => {
    if (!input.trim()) { ask(); return; }
    if (input.toLowerCase() === 'exit') { console.log('👋'); rl.close(); return; }
    if (input.startsWith('/')) { handleCommand(input); ask(); return; }

    try {
      if (useStreaming) {
        await chatWithStreaming(input);
      } else {
        await chatWithoutStreaming(input);
      }
    } catch (err: any) {
      console.error(`\n❌ ${err.message}\n`);
    }
    ask();
  });
}

console.log('╔═══════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — v0.1 (streaming mode)  ║');
console.log('║  Type /help for commands              ║');
console.log('╚═══════════════════════════════════════╝\n');

ask();
```

### Step 4: Test Streaming vs Non-Streaming (10 minutes)

```
You: Write a short paragraph about TypeScript
Lunar: TypeScript is a... (words appear one by one, like ChatGPT!)

/stream
✅ Streaming: OFF

You: Write a short paragraph about TypeScript
Lunar is thinking...
Lunar: TypeScript is a typed superset of... (entire response appears at once)

/stream
✅ Streaming: ON  ← back to streaming, much better UX!
```

### Step 5: Test Model Switching (10 minutes)

```bash
# First, pull a second model (in a separate terminal):
ollama pull qwen2.5:3b
```

```
/model llama3.3
You: Explain closures in JavaScript
Lunar: [detailed, high-quality explanation — takes ~5 seconds]

/model qwen2.5:3b
You: Explain closures in JavaScript
Lunar: [shorter, simpler explanation — takes ~1 second]
```

**Notice:** The smaller model (3b) is MUCH faster but gives less detailed answers. This is the speed vs quality trade-off in AI.

---

## ✅ CHECKLIST — Verify Before Moving to Week 2

- [ ] Streaming works: words appear one by one in the terminal
- [ ] `/stream` toggles between streaming ON/OFF
- [ ] You can switch models with `/model qwen2.5:3b`
- [ ] LLMProvider interface defined cleanly in types.ts
- [ ] OllamaProvider implements both `chat()` and `chatStream()`
- [ ] You can explain: "Streaming is ___ and matters because ___"

---

## 💡 KEY TAKEAWAY

**Streaming doesn't make AI faster — it makes AI FEEL faster.** Always stream responses when displaying to users. Use a provider interface so you can swap between models/providers without rewriting code. Small models (3b) are fast but basic; large models (8b+) are slower but smarter — pick based on the task.

---

## ❓ SELF-CHECK QUESTIONS

1. **What JavaScript syntax do you use to read a stream? (hint: you use it for Node.js readable streams too)**
   <details><summary>Answer</summary>`for await (const chunk of stream) { ... }` — the async iterator pattern. Same as reading a Node.js ReadableStream.</details>

2. **Should a backend API endpoint that generates a report use streaming? Why or why not?**
   <details><summary>Answer</summary>Usually no. If the backend needs the COMPLETE text before proceeding (to save to database, evaluate, etc.), non-streaming is simpler. Streaming is best when displaying to users in real-time.</details>

3. **What is the benefit of using an LLMProvider interface instead of calling Ollama directly?**
   <details><summary>Answer</summary>You can add new providers (Groq, Gemini, OpenAI) by implementing the same interface, without changing any code that calls `provider.chat()`. It also makes testing easier — you can create a mock provider for unit tests.</details>

4. **If llama3.3 (8b) takes 5 seconds and qwen2.5 (3b) takes 1 second for the same question, which should you use?**
   <details><summary>Answer</summary>Depends on the task. For simple Q&A or quick tasks → qwen2.5:3b (faster). For complex reasoning, code, or when quality matters → llama3.3:8b. You might even use both: fast model for simple queries, big model for complex ones.</details>

5. **What does `process.stdout.write()` do differently from `console.log()`?**
   <details><summary>Answer</summary>`process.stdout.write()` prints text WITHOUT adding a newline at the end. `console.log()` always adds a newline. For streaming, we need `write()` so tokens appear on the same line.</details>

---

## 🏆 WEEK 1 COMPLETE!

```
You now have:
├── ✅ Ollama installed with 2+ models
├── ✅ CLI chatbot with streaming
├── ✅ Multi-turn conversation memory
├── ✅ Configurable temperature and model switching
├── ✅ Clean LLMProvider interface
├── ✅ You understand: tokens, temperature, system prompts, context windows, streaming
│
│  Your project structure:
│  packages/
│  ├── agent/src/
│  │   ├── llm/
│  │   │   ├── client.ts    ← OllamaProvider (streaming + non-streaming)
│  │   │   └── types.ts     ← Message, LLMProvider, ChatOptions
│  │   └── cli.ts           ← Interactive REPL with slash commands
│  └── shared/src/
│      └── index.ts          ← Version info
│
└── 🎉 You built your first AI application!
```

**Take the weekend. Rest. You earned it.**

**Next → [Week 2, Day 6: Understanding Tool Calling](../week-02-agent-loop/day-06.md)**
