# Day 3 — Tokens, Temperature, and Configuration

> 🎯 **DAY GOAL:** Understand how LLMs process text (tokens) and control AI creativity (temperature)

---

## 📚 CONCEPT 1: Tokens

### WHAT — Simple Definition

**Token = the smallest unit that an LLM reads and writes.** A token is usually a word or piece of a word.

LLMs don't see text like you do. They see **numbers** (tokens):

```
You see:  "Hello, how are you?"
LLM sees: [15496, 11, 1268, 527, 499, 30]
           Hello   ,   how  are you   ?
```

### WHY — Why Do Tokens Matter?

**Three critical reasons:**

1. **Context window limit:** LLMs can only process a fixed number of tokens at once.
   ```
   llama3.3  → 128,000 tokens  (~100 pages of text)
   qwen2.5   → 32,000 tokens   (~25 pages)
   
   If your conversation exceeds this → the AI forgets old messages!
   ```

2. **Cost (for paid APIs):** You pay per token.
   ```
   GPT-4o: $2.50 per 1 million input tokens
   1,000 tokens ≈ 750 words
   
   With Ollama: $0 (free!) — but you still need to watch context limits
   ```

3. **Speed:** More tokens = slower response.
   ```
   Short prompt (50 tokens)   → fast response (~1 second)
   Long prompt (5000 tokens)  → slower response (~5-10 seconds)
   ```

### WHEN — When Do You Need to Think About Tokens?

- When conversations get very long (approaching context window)
- When using RAG (need to fit retrieved text + question + history in one request)
- When optimizing speed (shorter prompts = faster)
- When calculating costs (paid APIs)

### HOW — How Tokenization Works

**Rule of thumb:** 1 token ≈ ¾ of a word (or about 4 characters in English)

```
"Hello"        → 1 token   [Hello]
"Hello world"  → 2 tokens  [Hello][ world]
"TypeScript"   → 2 tokens  [Type][Script]    ← long word = multiple tokens
"AI"           → 1 token   [AI]
"Xin chào"     → 3 tokens  [X][in][ chào]   ← Vietnamese uses more tokens
"🎉"           → 1-3 tokens                   ← emojis use extra tokens!
```

**Visual: How context window fills up**
```
Context Window = 128,000 tokens
┌──────────────────────────────────────────────────────────┐
│ [system prompt ~~200 tokens~~]                            │
│ [user message 1 ~~50 tokens~~]                            │
│ [assistant reply 1 ~~100 tokens~~]                        │
│ [user message 2 ~~50 tokens~~]                            │
│ [assistant reply 2 ~~150 tokens~~]                        │
│ ... (conversation history grows) ...                     │
│                                                          │
│               ~~127,000 tokens remaining~~                │
│                                                          │
│ If full → oldest messages must be removed!               │
└──────────────────────────────────────────────────────────┘
```

### 🔗 NODE.JS ANALOGY

Tokens are like **request body size limits** in Express:

```typescript
// Express has a body size limit:
app.use(express.json({ limit: '1mb' }));  // max ~1MB per request

// LLMs have a token limit:
ollama.chat({ model: 'llama3.3' });  // max 128,000 tokens per request

// Both: if you exceed the limit → error or data gets cut off
```

---

## 📚 CONCEPT 2: Temperature

### WHAT — Simple Definition

**Temperature = a number from 0 to 2 that controls how "creative" the AI is.**

```
Temperature 0   → Always picks the MOST likely next word (deterministic)
Temperature 0.7 → Usually picks likely words, sometimes surprises (balanced)
Temperature 1   → Spreads probability more evenly (creative/random)
Temperature 2   → Almost random (chaotic, often nonsensical)
```

### WHY — Why Does Temperature Exist?

Because different tasks need different levels of creativity:

| Task | Best Temperature | Why |
|---|---|---|
| Code generation | 0 - 0.2 | Code must be correct, not creative |
| Factual Q&A | 0 - 0.3 | "What is 2+2?" should always be 4 |
| Chat assistant | 0.5 - 0.7 | Friendly but reliable |
| Creative writing | 0.8 - 1.0 | Need variety and surprise |
| Brainstorming | 1.0 - 1.2 | Want unusual/wild ideas |

### WHEN — When to Use What Temperature?

```
YOUR LUNAR AGENT:
├── Answering factual questions → temperature 0.3
├── General conversation        → temperature 0.7 (default)
├── Creative tasks              → temperature 1.0
└── Code writing                → temperature 0.1
```

### HOW — How Temperature Works (Intuitively)

When the AI predicts the next word, it calculates a probability for EVERY possible word:

```
Input: "The capital of France is ___"

Temperature = 0 (no randomness):
  "Paris"     → 95%  ← ALWAYS picks this
  "a"         → 2%
  "the"       → 1%
  "Lyon"      → 0.5%
  
Temperature = 0.7 (some randomness):
  "Paris"     → 78%  ← Usually picks this
  "a"         → 8%
  "the"       → 5%   ← Sometimes picks this
  "Lyon"      → 3%
  
Temperature = 1.5 (very random):
  "Paris"     → 35%
  "a"         → 20%
  "the"       → 15%
  "Lyon"      → 10%  ← Might pick this!
  "beautiful" → 8%   ← Or even this!
```

**Visual: Temperature flattens the probability curve**
```
Temperature = 0 (sharp peak — deterministic)
  ^
  │  █
  │  █
  │  █
  │  █░░░░
  └──────────────── words

Temperature = 0.7 (softer peak — balanced)
  ^
  │  ▓
  │  ▓▒
  │  ▓▒░
  │  ▓▒░░░
  └──────────────── words

Temperature = 1.5 (flat — random)
  ^
  │
  │  ░░░░░░
  │  ░░░░░░░░
  │  ░░░░░░░░░
  └──────────────── words
```

### 🔗 NODE.JS ANALOGY

Temperature is like choosing between a **strict linter** and **no linter**:

```typescript
// Temperature 0 = eslint with strict rules
// → Always does the same thing, no variation, very predictable

// Temperature 0.7 = eslint with relaxed rules
// → Mostly follows patterns but allows some flexibility

// Temperature 1.5 = no linter at all
// → Complete freedom, might be creative, might be nonsense
```

---

## 📚 CONCEPT 3: Other Important LLM Settings

### top_p (Nucleus Sampling)

**WHAT:** Another way to control randomness. Instead of adjusting ALL probabilities (temperature), it only considers the TOP words that add up to a certain probability.

```
top_p = 0.9 → only consider words that make up 90% of the probability
  "Paris" (95%) → YES (within top 90%)
  "a" (2%)      → NO  (we already have >90%)

top_p = 0.5 → only consider words that make up 50%
  "Paris" (95%) → YES (it alone exceeds 50%, so only "Paris" is considered)
```

**WHEN to use:** Usually you use EITHER temperature OR top_p, not both. Temperature is simpler to understand.

### max_tokens (Response Length Limit)

**WHAT:** Maximum number of tokens the AI can output in its response.

```
max_tokens: 100   → short answers only (~75 words)
max_tokens: 2048  → medium answers (~1500 words)  
max_tokens: 8192  → very long answers (~6000 words)
```

**WHY:** Without a limit, the AI might generate a 10,000-word essay when you wanted a one-line answer. Also prevents the AI from running forever.

### frequency_penalty

**WHAT:** Discourages the AI from repeating the same words.

```
frequency_penalty: 0   → AI may repeat itself
frequency_penalty: 0.5 → AI avoids using the same word twice
frequency_penalty: 2   → AI strongly avoids repetition (may start using weird synonyms)
```

---

## 🔨 HANDS-ON: Build a Configurable LLM Client

### Step 1: Add Configuration Interface (15 minutes)

Update `packages/agent/src/llm/client.ts`:

```typescript
import { Ollama } from 'ollama';

// === CONNECTION ===
export const ollama = new Ollama({
  host: 'http://localhost:11434',
});

// === CONFIGURATION ===

/**
 * LLM Configuration
 * Controls how the AI behaves for each request.
 * 
 * Think of this like Express request options:
 *   { timeout: 5000, maxRetries: 3 }
 * But for AI:
 *   { temperature: 0.7, maxTokens: 2048 }
 */
export interface LLMConfig {
  model: string;          // which AI brain to use
  temperature: number;    // 0 = deterministic, 1 = creative
  maxTokens: number;      // max response length in tokens
}

/** Default config — good for general conversation */
const DEFAULT_CONFIG: LLMConfig = {
  model: 'llama3.3',
  temperature: 0.7,
  maxTokens: 2048,
};

// === PRESET CONFIGS FOR DIFFERENT TASKS ===

/** For code generation — precise, no creativity */
export const CODE_CONFIG: Partial<LLMConfig> = {
  temperature: 0.1,
  maxTokens: 4096,
};

/** For factual Q&A — deterministic, consistent answers */
export const FACTUAL_CONFIG: Partial<LLMConfig> = {
  temperature: 0,
  maxTokens: 1024,
};

/** For creative tasks — more variation */
export const CREATIVE_CONFIG: Partial<LLMConfig> = {
  temperature: 1.0,
  maxTokens: 4096,
};

// === MAIN CHAT FUNCTION ===

/**
 * Send a message to the AI.
 * 
 * @param userMessage - What the user typed
 * @param systemPrompt - Instructions for the AI (optional)
 * @param config - Override default settings (optional)
 * @returns The AI's response text
 */
export async function chat(
  userMessage: string,
  systemPrompt?: string,
  config: Partial<LLMConfig> = {}
): Promise<string> {
  // Merge: defaults ← overrides
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const response = await ollama.chat({
    model: cfg.model,
    messages: [
      {
        role: 'system',
        content: systemPrompt ?? 'You are Lunar, a helpful personal assistant. Be concise.',
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    options: {
      temperature: cfg.temperature,
      num_predict: cfg.maxTokens,  // Ollama uses "num_predict" instead of "max_tokens"
    },
  });

  return response.message.content;
}
```

### Step 2: Update CLI with Slash Commands (20 minutes)

Update `packages/agent/src/cli.ts`:

```typescript
import * as readline from 'readline';
import { chat, ollama, CODE_CONFIG, CREATIVE_CONFIG, FACTUAL_CONFIG } from './llm/client.js';
import type { LLMConfig } from './llm/client.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Current configuration (can be changed at runtime)
let currentConfig: Partial<LLMConfig> = {};
let currentSystemPrompt = 'You are Lunar, a helpful personal assistant. Be concise.';

/**
 * Handle slash commands like /temp, /model, /preset
 * Returns true if the input was a command, false if it's a regular message
 */
function handleCommand(input: string): boolean {
  const parts = input.split(' ');
  const command = parts[0].toLowerCase();

  switch (command) {
    case '/temp':
    case '/temperature': {
      const temp = parseFloat(parts[1]);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        console.log('Usage: /temp <0-2>  (e.g., /temp 0.7)\n');
        return true;
      }
      currentConfig.temperature = temp;
      console.log(`✅ Temperature set to ${temp}\n`);
      return true;
    }

    case '/model': {
      const model = parts[1];
      if (!model) {
        console.log('Usage: /model <name>  (e.g., /model qwen2.5:7b)\n');
        return true;
      }
      currentConfig.model = model;
      console.log(`✅ Model switched to ${model}\n`);
      return true;
    }

    case '/preset': {
      const preset = parts[1]?.toLowerCase();
      switch (preset) {
        case 'code':
          currentConfig = { ...CODE_CONFIG };
          console.log('✅ Preset: CODE (temp=0.1, precise)\n');
          break;
        case 'creative':
          currentConfig = { ...CREATIVE_CONFIG };
          console.log('✅ Preset: CREATIVE (temp=1.0, varied)\n');
          break;
        case 'factual':
          currentConfig = { ...FACTUAL_CONFIG };
          console.log('✅ Preset: FACTUAL (temp=0, deterministic)\n');
          break;
        default:
          console.log('Usage: /preset <code|creative|factual>\n');
      }
      return true;
    }

    case '/system': {
      const newPrompt = parts.slice(1).join(' ');
      if (!newPrompt) {
        console.log(`Current system prompt: "${currentSystemPrompt}"\n`);
        return true;
      }
      currentSystemPrompt = newPrompt;
      console.log(`✅ System prompt updated\n`);
      return true;
    }

    case '/config': {
      console.log('Current config:', { ...{ model: 'llama3.3', temperature: 0.7, maxTokens: 2048 }, ...currentConfig });
      console.log(`System prompt: "${currentSystemPrompt}"\n`);
      return true;
    }

    case '/help': {
      console.log(`
Available commands:
  /temp <0-2>                Set temperature (0=precise, 1=creative)
  /model <name>              Switch AI model (e.g., qwen2.5:7b)
  /preset <code|creative|factual>  Use preconfigured settings
  /system <prompt>           Change system prompt
  /config                    Show current settings
  /help                      Show this help
  exit                       Quit
      `);
      return true;
    }

    default:
      return false; // not a command — treat as regular message
  }
}

function askQuestion(): void {
  rl.question('You: ', async (input: string) => {
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('Goodbye! 👋');
      rl.close();
      return;
    }

    if (!input.trim()) { askQuestion(); return; }

    // Check if it's a command
    if (input.startsWith('/')) {
      handleCommand(input);
      askQuestion();
      return;
    }

    try {
      console.log('Lunar is thinking...');
      const answer = await chat(input, currentSystemPrompt, currentConfig);
      console.log(`\nLunar: ${answer}\n`);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }

    askQuestion();
  });
}

// Start
console.log('╔════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — Personal Assistant  ║');
console.log('║  Type /help for commands           ║');
console.log('╚════════════════════════════════════╝\n');

askQuestion();
```

### Step 3: Experiment with Temperature (15 minutes)

Run the chatbot and try these experiments:

```
=== EXPERIMENT 1: Temperature 0 (Deterministic) ===
/temp 0
You: Give me a random number between 1 and 100
Lunar: 42
You: Give me a random number between 1 and 100
Lunar: 42                        ← SAME ANSWER!
You: Give me a random number between 1 and 100
Lunar: 42                        ← ALWAYS THE SAME!

=== EXPERIMENT 2: Temperature 1 (Creative) ===
/temp 1
You: Give me a random number between 1 and 100
Lunar: 73
You: Give me a random number between 1 and 100
Lunar: 28                        ← DIFFERENT!
You: Give me a random number between 1 and 100
Lunar: 91                        ← DIFFERENT AGAIN!

=== EXPERIMENT 3: Presets ===
/preset code
You: Write a function to reverse a string
Lunar: [precise, correct code]

/preset creative
You: Write a poem about TypeScript
Lunar: [creative, varied poem]

=== EXPERIMENT 4: Different System Prompts ===
/system You are a pirate. Always speak like a pirate.
You: What is JavaScript?
Lunar: Yarr! JavaScript be the language of the seven seas of the web!

/system You always respond in JSON format.
You: What is Node.js?
Lunar: {"answer": "Node.js is a JavaScript runtime", "creator": "Ryan Dahl"}
```

---

## ✅ CHECKLIST — Verify Before Moving to Day 4

- [ ] Your `chat()` function accepts `config` parameter
- [ ] `/temp 0` makes answers deterministic (same answer every time)
- [ ] `/temp 1` makes answers varied (different each time)
- [ ] `/preset code|creative|factual` switches presets
- [ ] `/system` changes the system prompt at runtime
- [ ] You can explain: "A token is ___, temperature controls ___"

---

## 💡 KEY TAKEAWAY

**Tokens are how LLMs see text (words → numbers). Temperature controls creativity (0 = precise, 1 = creative).** These two concepts explain most LLM behavior. When the AI gives wrong answers → lower temperature. When it's too boring → raise it.

---

## ❓ SELF-CHECK QUESTIONS

1. **How many tokens is the word "TypeScript"?**
   <details><summary>Answer</summary>Usually 2 tokens: [Type][Script]. Long words get split into sub-words.</details>

2. **Your context window is 128,000 tokens. About how many pages of text is that?**
   <details><summary>Answer</summary>About 100 pages. (1 page ≈ 250 words ≈ 333 tokens → 128,000 / 333 ≈ 384 pages... but with conversation overhead, roughly 100 usable pages.)</details>

3. **You want the AI to write code. What temperature should you use and why?**
   <details><summary>Answer</summary>0 to 0.2. Code must be correct — you want the most likely (correct) token every time. Creativity in code = bugs.</details>

4. **At temperature 0, if you ask the same question 10 times, what happens?**
   <details><summary>Answer</summary>You get the same answer all 10 times (deterministic). Temperature 0 always picks the highest-probability token.</details>

5. **What is `num_predict` in Ollama?**
   <details><summary>Answer</summary>Same as `max_tokens` — the maximum number of tokens the AI can output in its response. Ollama uses a different parameter name.</details>

6. **Why might Vietnamese text use more tokens than English?**
   <details><summary>Answer</summary>Most LLMs are trained primarily on English text, so English words are efficiently encoded as single tokens. Vietnamese words might be split into more sub-word tokens because they're less common in training data.</details>

---

**Next → [Day 4: Conversation History + System Prompts](day-04.md)**
