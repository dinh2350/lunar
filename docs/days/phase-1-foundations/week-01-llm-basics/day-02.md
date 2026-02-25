# Day 2 — First LLM Call from TypeScript

> 🎯 **DAY GOAL:** Call an LLM from your own TypeScript code and build a simple chatbot

---

## 📚 CONCEPT 1: The Chat API (Messages Format)

### WHAT — Simple Definition

**The Chat API** is how you talk to an LLM from code. You send an array of **messages** and get back one **response message**.

```typescript
// You send this:
messages: [
  { role: 'system',    content: 'You are a helpful assistant.' },
  { role: 'user',      content: 'What is Node.js?' },
]

// You get back:
{ role: 'assistant', content: 'Node.js is a JavaScript runtime built on Chrome V8...' }
```

### WHY — Why an Array of Messages?

**Because conversations have context.** If you send one message at a time, the AI forgets everything. By sending the entire conversation as an array, the AI "remembers" what was said before.

```
WITHOUT history (single message):
  User: "My name is Hao"     → AI: "Nice to meet you, Hao!"
  User: "What is my name?"   → AI: "I don't know your name." ← FORGOT!

WITH history (message array):
  messages: [
    { role: "user", content: "My name is Hao" },
    { role: "assistant", content: "Nice to meet you, Hao!" },
    { role: "user", content: "What is my name?" }
  ]
  → AI: "Your name is Hao!" ← REMEMBERS!
```

**⚠️ Important:** The AI does NOT actually remember. It reads the ENTIRE array every single time. It's like re-reading the whole conversation from scratch every message. (We'll improve this later with real memory in Week 3.)

### WHEN — When Do You Use the Chat API?

- Every time your app needs an AI response
- Every chatbot, assistant, agent
- Every LLM provider uses this same format (OpenAI, Anthropic, Ollama, Gemini)

### HOW — How Does It Work?

```
┌─────────────────────── YOUR CODE ───────────────────────┐
│                                                          │
│  const messages = [                                      │
│    { role: 'system', content: 'You are helpful.' },      │
│    { role: 'user',   content: 'What is Node.js?' },      │
│  ];                                                      │
│                                                          │
│  ollama.chat({ model: 'llama3.3', messages })            │
│         │                                                │
└─────────┼────────────────────────────────────────────────┘
          │
          ▼  HTTP POST to localhost:11434/api/chat
┌─────────────────────── OLLAMA SERVER ───────────────────┐
│                                                          │
│  1. Receive messages array                               │
│  2. Convert text → tokens (numbers)                      │
│  3. Feed through llama3.3 neural network                 │
│  4. Generate response token by token                     │
│  5. Convert tokens → text                                │
│  6. Return: { role: 'assistant', content: '...' }        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 🔗 NODE.JS ANALOGY

The Chat API is like calling any HTTP API with `fetch`:

```typescript
// Calling a weather API (you know this):
const weather = await fetch('https://api.weather.com/current?city=Hanoi');
const data = await weather.json();
// → { temperature: 28, condition: 'sunny' }

// Calling an LLM API (exactly the same pattern):
const ai = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    model: 'llama3.3',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
const data = await ai.json();
// → { message: { role: 'assistant', content: 'Hello! How can I help?' } }
```

Same pattern: HTTP request → JSON response. The AI is just another API.

---

## 📚 CONCEPT 2: The Three Message Roles

### WHAT — Simple Definition

Every message has a **role** that tells the AI who is speaking:

| Role | Who Is Speaking | Purpose |
|---|---|---|
| `system` | **You (the developer)** | Hidden instructions that shape AI behavior. User never sees this. |
| `user` | **The human** | What the person typed |
| `assistant` | **The AI** | What the AI responded |
| `tool` | **Your code** | Results from tool execution (Week 2) |

### WHY — Why Do We Need Roles?

The AI needs to know **who said what** to respond correctly:

```typescript
// Without roles — AI is confused:
"You are helpful. What is Node.js? Node.js is a runtime. Tell me more."
// ↑ Who said each part? AI can't tell.

// With roles — AI understands:
[
  { role: 'system',    content: 'You are helpful.' },        // ← developer's instructions
  { role: 'user',      content: 'What is Node.js?' },        // ← user's question
  { role: 'assistant', content: 'Node.js is a runtime.' },   // ← AI's previous answer
  { role: 'user',      content: 'Tell me more.' },           // ← user's follow-up
]
```

### HOW — How the `system` Role Works

The `system` message is your **secret control panel**. It changes **how** the AI behaves:

```typescript
// System: Be a pirate
system: "You are a pirate. Always speak like a pirate."
user: "What is JavaScript?"
assistant: "Arr! JavaScript be the language of the seven seas of the web, matey!"

// System: Be technical
system: "You are a senior software engineer. Be precise and technical."
user: "What is JavaScript?"
assistant: "JavaScript is a high-level, interpreted programming language that conforms to the ECMAScript specification..."

// System: Respond in JSON
system: "Always respond in valid JSON format."
user: "What is JavaScript?"
assistant: '{"answer": "JavaScript is a programming language", "category": "technology"}'
```

**Same question, completely different answers — all controlled by the system prompt.**

### 🔗 NODE.JS ANALOGY

Think of it like Express middleware layers:

```typescript
// System prompt = global middleware (affects ALL requests)
app.use((req, res, next) => {
  res.locals.personality = 'helpful and concise';
  next();
});

// User message = incoming request
app.post('/chat', (req, res) => {
  const userMessage = req.body.message;
  // ...
});

// Assistant response = outgoing response
app.post('/chat', (req, res) => {
  res.json({ reply: 'Here is my answer...' });
});
```

---

## 📚 CONCEPT 3: What is the Ollama npm Package?

### WHAT — Simple Definition

The `ollama` npm package is a **TypeScript/JavaScript client** that wraps the Ollama HTTP API so you don't have to use `fetch` manually.

```typescript
// WITHOUT the npm package (manual fetch):
const res = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({ model: 'llama3.3', messages: [...] })
});

// WITH the npm package (clean and typed):
import { Ollama } from 'ollama';
const ollama = new Ollama({ host: 'http://localhost:11434' });
const res = await ollama.chat({ model: 'llama3.3', messages: [...] });
```

### WHY — Why Use the npm Package?

- TypeScript types (autocomplete in VS Code!)
- Handles streaming (we'll use this on Day 5)
- Handles errors properly
- Cleaner code

---

## 🔨 HANDS-ON: Build Your First Chatbot

### Step 1: Set Up the Agent Package (5 minutes)

```bash
cd packages/agent
pnpm init
# Edit package.json — set name to "@lunar/agent", type to "module"
```

Edit `packages/agent/package.json`:
```json
{
  "name": "@lunar/agent",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts"
}
```

Install the Ollama client:
```bash
pnpm add ollama
```

### Step 2: Create the LLM Client (15 minutes)

Create `packages/agent/src/llm/client.ts`:

```typescript
/**
 * LLM Client — talks to Ollama
 * 
 * This is the lowest-level AI code in Lunar.
 * Everything else builds on top of this.
 */
import { Ollama } from 'ollama';

// Connect to Ollama running on your Mac
export const ollama = new Ollama({
  host: 'http://localhost:11434',  // default Ollama port
});

/**
 * Send a message to the AI and get a response.
 * 
 * @param userMessage - What the user typed
 * @returns The AI's response text
 * 
 * Think of this like: fetch(apiUrl).then(r => r.json())
 * But instead of a REST API, you're calling an AI.
 */
export async function chat(userMessage: string): Promise<string> {
  const response = await ollama.chat({
    model: 'llama3.3',        // which AI model to use
    messages: [
      {
        role: 'system',       // developer instructions (hidden from user)
        content: 'You are Lunar, a helpful personal assistant. Be concise and friendly.',
      },
      {
        role: 'user',         // what the human said
        content: userMessage,
      },
    ],
  });

  // response.message.content is the AI's text response
  return response.message.content;
}
```

**What each part does:**
```
new Ollama({ host: '...' })     → connect to Ollama (like mongoose.connect())
ollama.chat({ model, messages }) → send messages, get response (like db.find())
model: 'llama3.3'               → which AI brain to use (like choosing a database)
messages: [...]                  → the conversation so far
response.message.content         → the AI's text reply
```

### Step 3: Create the CLI Chat Interface (20 minutes)

Create `packages/agent/src/cli.ts`:

```typescript
/**
 * CLI Chat — talk to Lunar in your terminal
 * 
 * This is a simple REPL (Read-Eval-Print Loop).
 * You (probably) built a Node.js REPL before — same thing!
 * 
 * How it works:
 *   1. Show prompt "You: "
 *   2. Wait for user to type something
 *   3. Send to AI
 *   4. Print AI's response
 *   5. Go back to step 1
 */
import * as readline from 'readline';
import { chat } from './llm/client.js';

// readline = Node.js built-in for reading terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Ask one question, print the answer, repeat.
 */
function askQuestion(): void {
  rl.question('You: ', async (input: string) => {
    // Let user exit gracefully
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('Goodbye! 👋');
      rl.close();
      return;
    }

    // Skip empty input
    if (!input.trim()) {
      askQuestion();
      return;
    }

    try {
      // Call the AI — this is where the magic happens
      console.log('Lunar is thinking...');
      const answer = await chat(input);
      console.log(`\nLunar: ${answer}\n`);
    } catch (error) {
      // If Ollama is not running, show a helpful error
      console.error('\n❌ Error: Could not reach Ollama.');
      console.error('   Make sure Ollama is running: ollama serve\n');
    }

    // Ask the next question (the REPL loop)
    askQuestion();
  });
}

// Start the REPL
console.log('╔════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — Personal Assistant  ║');
console.log('║  Type "exit" to quit               ║');
console.log('╚════════════════════════════════════╝');
console.log('');

askQuestion();
```

### Step 4: Run Your Chatbot! (10 minutes)

```bash
# Make sure Ollama is running (open a separate terminal if needed):
ollama serve

# Run your chatbot:
npx tsx packages/agent/src/cli.ts
```

Try these conversations:
```
You: Hello!
Lunar: Hello! How can I help you today?

You: What is TypeScript?
Lunar: TypeScript is a typed superset of JavaScript that compiles to plain JavaScript...

You: Write a function that adds two numbers
Lunar: Here's a simple function:
       function add(a: number, b: number): number {
         return a + b;
       }

You: exit
Goodbye! 👋
```

### Step 5: Understand What Just Happened (5 minutes)

```
What happened when you typed "Hello!":

1. readline captured your text: "Hello!"
2. chat("Hello!") was called
3. Inside chat():
   - Created messages array: [system prompt, your message]
   - Called ollama.chat() — HTTP POST to localhost:11434
4. Ollama server:
   - Loaded llama3.3 model into RAM
   - Converted "Hello!" to tokens
   - Ran tokens through the neural network
   - Generated response tokens one by one
   - Converted back to text
5. Response returned: "Hello! How can I help you today?"
6. console.log() printed it
7. askQuestion() called again — back to waiting for input

Total time: 1-5 seconds (depends on your Mac's speed)
Total cost: $0
```

---

## ✅ CHECKLIST — Verify Before Moving to Day 3

- [ ] `packages/agent/package.json` exists with `"type": "module"`
- [ ] `packages/agent/src/llm/client.ts` exports a `chat()` function
- [ ] `packages/agent/src/cli.ts` runs a REPL loop
- [ ] `npx tsx packages/agent/src/cli.ts` starts the chatbot
- [ ] The chatbot responds to your questions
- [ ] You can explain what `role: 'system'` does

---

## 💡 KEY TAKEAWAY

**Calling an LLM from TypeScript is just like calling any REST API.** You send a request (messages array), you get a response (text). The `ollama` npm package wraps the HTTP calls so your code stays clean. You now have a working chatbot in ~30 lines of TypeScript.

---

## ❓ SELF-CHECK QUESTIONS

1. **What are the 3 main message roles? What does each one do?**
   <details><summary>Answer</summary>
   - `system`: Hidden developer instructions that shape AI behavior
   - `user`: What the human typed
   - `assistant`: What the AI responded
   </details>

2. **If you call `chat("Hi")` twice, will the AI remember the first call?**
   <details><summary>Answer</summary>No. Each call creates a fresh messages array with only the system prompt + the new message. The AI has no memory between calls (yet — we fix this on Day 4).</details>

3. **What happens if Ollama is not running when you call `ollama.chat()`?**
   <details><summary>Answer</summary>You get a connection error (ECONNREFUSED). The code catches it and shows: "Make sure Ollama is running: ollama serve".</details>

4. **Why do we use `'type': 'module'` in package.json?**
   <details><summary>Answer</summary>To use ES module `import/export` syntax instead of CommonJS `require()`. Modern Node.js + TypeScript works best with ES modules.</details>

5. **Is the system prompt visible to the user?**
   <details><summary>Answer</summary>No. The system prompt is only in your code — the user never sees it. But it controls how the AI behaves. Think of it as "backstage instructions" for the AI.</details>

---

**Next → [Day 3: Tokens, Temperature, and Configuration](day-03.md)**
