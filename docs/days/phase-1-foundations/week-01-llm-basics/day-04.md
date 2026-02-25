# Day 4 — Conversation History + System Prompts

> 🎯 **DAY GOAL:** Make your chatbot REMEMBER conversations and learn advanced prompt engineering

---

## 📚 CONCEPT 1: Statelessness (Why the AI "Forgets")

### WHAT — Simple Definition

**LLMs are stateless.** Every API call is independent. The AI has ZERO memory between calls.

When you call `ollama.chat()` twice, the second call has no idea the first call happened. It's like the AI wakes up with amnesia every single time.

### WHY — Why Is It Stateless?

Same reason HTTP is stateless: **simplicity and scalability.**

```
Think about HTTP:
  GET /users/1    → server doesn't remember this happened
  GET /users/2    → completely independent request

Same with LLMs:
  chat("My name is Hao")    → AI responds, then forgets
  chat("What is my name?")  → AI has no idea what "name" you're talking about
```

### HOW — How the AI "Remembers" (You Fake It)

**You send the ENTIRE conversation history with every request.** The AI re-reads everything from scratch each time.

```
Call 1:
  Send: [system, "My name is Hao"]
  Get:  "Nice to meet you, Hao!"

Call 2 (THE KEY — include previous messages):
  Send: [system, "My name is Hao", "Nice to meet you Hao!", "What is my name?"]
  Get:  "Your name is Hao!"
       ↑ AI read the whole array and found the answer
```

**Visual: How YOU maintain the conversation**
```
Turn 1:
┌────────────────────────────┐
│ messages = [               │
│   {system: "Be helpful"},  │───► AI reads [1 message] → responds
│   {user: "Hi, I'm Hao"},  │
│ ]                          │
└────────────────────────────┘

Turn 2:
┌────────────────────────────┐
│ messages = [               │
│   {system: "Be helpful"},  │
│   {user: "Hi, I'm Hao"},  │───► AI reads [3 messages] → responds
│   {assistant: "Hello!"},   │     (re-reads EVERYTHING)
│   {user: "What's my name"},│
│ ]                          │
└────────────────────────────┘

Turn 3:
┌────────────────────────────┐
│ messages = [               │
│   {system: "Be helpful"},  │
│   {user: "Hi, I'm Hao"},  │
│   {assistant: "Hello!"},   │───► AI reads [5 messages] → responds
│   {user: "What's my name"},│     (re-reads EVERYTHING again)
│   {assistant: "Hao!"},     │
│   {user: "Tell me a joke"},│
│ ]                          │
└────────────────────────────┘

Each turn: the array gets BIGGER.
The AI always reads from the beginning.
There is no shortcut — full re-read every time.
```

### WHEN — When Does This Become a Problem?

**When the conversation gets too long!** Remember: there's a token limit.

```
Turn 1:    300 tokens   ← fine
Turn 10:   3,000 tokens ← fine
Turn 50:   15,000 tokens ← getting heavy
Turn 200:  60,000 tokens ← approaching the limit!
Turn 500:  EXCEEDS context window → AI ignores/forgets old messages
```

Solutions (we build these in weeks 3-4):
1. **Summarize old messages** → compress 50 messages into 1 summary
2. **RAG memory** → store facts in a database, search when needed
3. **Sliding window** → only keep the last N messages

### 🔗 NODE.JS ANALOGY

It's exactly like how HTTP sessions work with cookies:

```typescript
// HTTP is stateless — server doesn't remember requests:
app.get('/api', (req, res) => {
  // req has NO memory of previous requests
});

// Solution: sessions (send data with every request)
app.get('/api', (req, res) => {
  const session = req.cookies.session;  // ← client sends ALL session data every time
  // Now you "remember" the user
});

// LLMs are the same:
// Without history: AI is a fresh install every call
// With history (messages array): AI "remembers" because you send everything every time
// The messages array IS your "session cookie"
```

---

## 📚 CONCEPT 2: System Prompts (Deep Dive)

### WHAT — Simple Definition

**System prompt = instructions that tell the AI WHO it is and HOW to behave.** It's the first message in the array, with role `system`.

### WHY — Why Are System Prompts Important?

The system prompt is the **most powerful tool** you have. It controls:
- **Personality** — friendly, formal, funny, technical
- **Constraints** — "never talk about X", "always respond in JSON"
- **Role** — "you are a doctor", "you are a coding assistant"
- **Format** — "use bullet points", "keep answers under 100 words"
- **Knowledge** — "the user's name is Hao", "today is February 24, 2026"

**A good system prompt is the difference between a mediocre AI and an amazing one.**

### WHEN — When Do You Write System Prompts?

- **Every AI application needs one.** There is no exception.
- You write it once per application/feature
- You iterate on it over time (prompt engineering is ongoing)

### HOW — How to Write Great System Prompts

**The RICE formula for system prompts:**

```
R = Role        → Who is the AI?
I = Instructions → What should it do?
C = Constraints  → What should it NOT do?
E = Examples     → Show it what good output looks like
```

**Example 1: Basic assistant**
```
Role:         You are Lunar, a personal AI assistant.
Instructions: Help users with questions. Be concise and accurate.
Constraints:  Don't make up facts. If you don't know, say so.
Examples:     (none needed for simple chat)
```

**Example 2: Code reviewer**
```
Role:         You are an expert TypeScript code reviewer.
Instructions: Review the code the user provides. Point out:
              1. Bugs
              2. Performance issues
              3. Security concerns
              4. Readability improvements
Constraints:  Don't rewrite the entire code. Only suggest changes.
              Keep suggestions under 5 items.
Examples:     Format each suggestion like:
              ❌ Bad: [problem]
              ✅ Fix: [solution]
```

**Example 3: JSON responder**
```
Role:         You are a data extraction API.
Instructions: Extract structured data from user's text.
Constraints:  ONLY respond in valid JSON. 
              Never add explanation outside the JSON.
Examples:     
  User: "Meeting with John tomorrow at 3pm about the budget"
  Response: {
    "type": "meeting",
    "person": "John",
    "date": "tomorrow",
    "time": "15:00",
    "topic": "budget"
  }
```

### 🔗 NODE.JS ANALOGY

System prompts are like **configuration objects** for your application:

```typescript
// In Express, you configure behavior with options:
const app = express();
app.set('json spaces', 2);           // format JSON responses
app.set('trust proxy', true);        // behavior rule
app.set('etag', false);              // constraint

// For LLMs, you configure behavior with the system prompt:
const systemPrompt = `
  You are Lunar, a personal assistant.   // identity (like app.set('name'))
  Be concise.                            // behavior rule
  Never make up facts.                   // constraint
  Respond in JSON when asked for data.   // format rule
`;
```

---

## 📚 CONCEPT 3: Prompt Engineering Patterns

### Pattern 1: Chain of Thought (CoT)

**WHAT:** Tell the AI to "think step by step" before answering.

**WHY:** The AI gives MUCH better answers for complex questions when it shows its reasoning.

```typescript
// WITHOUT Chain of Thought:
user: "If a shirt costs $25 and is on 20% sale, what's the final price?"
assistant: "$20"  // ← correct, but no reasoning

// WITH Chain of Thought:
system: "Think step by step before giving your final answer."
user: "If a shirt costs $25 and is on 20% sale, what's the final price?"
assistant: "Let me think step by step:
  1. Original price: $25
  2. Discount: 20% of $25 = $5
  3. Final price: $25 - $5 = $20
  The final price is $20." // ← correct AND you can verify the reasoning
```

### Pattern 2: Few-Shot Prompting

**WHAT:** Give the AI examples of input → output before your actual question.

**WHY:** Examples teach the AI the EXACT format and style you want.

```typescript
system: `You classify customer messages into categories.

Examples:
Message: "My order hasn't arrived yet"
Category: shipping

Message: "How do I return this item?"
Category: returns

Message: "This product broke after 2 days"
Category: quality`

user: "I was charged twice for the same item"
assistant: "billing"  // ← AI learned the pattern from examples!
```

### Pattern 3: Role Assignment

**WHAT:** Tell the AI to act as a specific expert.

**WHY:** The AI has knowledge from many domains. By assigning a role, you focus it on the right knowledge.

```typescript
// Generic (mediocre answer):
user: "What causes a segfault?"

// With role (expert answer):
system: "You are a systems programmer with 20 years of C/C++ experience."
user: "What causes a segfault?"
// → AI gives much deeper, more accurate answer
```

### 🔗 NODE.JS ANALOGY

Prompt patterns are like **design patterns** you already know:

```
Chain of Thought  = like console.log() debugging
                    show your work, step by step

Few-Shot          = like test fixtures / example data
                    teach by example

Role Assignment   = like TypeScript interfaces
                    constrain what's possible
```

---

## 🔨 HANDS-ON: Build Multi-Turn Chat with History

### Step 1: Update the Chat Function for History (15 minutes)

Create `packages/agent/src/llm/types.ts`:

```typescript
/**
 * Message in a conversation.
 * Every message has a role (who's speaking) and content (what they said).
 * 
 * In conversation:
 *   system    → developer instructions (hidden from user)
 *   user      → what the human typed
 *   assistant → what the AI said
 *   tool      → tool execution results (Week 2)
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}
```

### Step 2: Update CLI to Maintain History (30 minutes)

Rewrite `packages/agent/src/cli.ts`:

```typescript
import * as readline from 'readline';
import { ollama } from './llm/client.js';
import type { Message } from './llm/types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ══════════════════════════════════════════════
//  The conversation history — THIS IS THE KEY!
//  Every new message gets pushed to this array.
//  Every API call sends the ENTIRE array.
// ══════════════════════════════════════════════
const messages: Message[] = [
  {
    role: 'system',
    content: `You are Lunar, a helpful personal AI assistant.
Be concise and friendly. If you don't know something, say so honestly.
When asked to code, use TypeScript.`,
  },
];

// Config
let model = 'llama3.3';
let temperature = 0.7;

/**
 * Send the full conversation to the AI and get a response.
 * The AI reads ALL messages from the beginning every time.
 */
async function chat(userInput: string): Promise<string> {
  // Step 1: Add user's message to history
  messages.push({ role: 'user', content: userInput });

  // Step 2: Send ENTIRE history to AI
  const response = await ollama.chat({
    model,
    messages,    // ← the entire conversation
    options: { temperature },
  });

  // Step 3: Add AI's response to history
  const reply = response.message.content;
  messages.push({ role: 'assistant', content: reply });

  return reply;
}

/**
 * Handle slash commands
 */
function handleCommand(input: string): boolean {
  const parts = input.split(' ');
  const cmd = parts[0];

  switch (cmd) {
    case '/temp': {
      const t = parseFloat(parts[1]);
      if (!isNaN(t)) { temperature = t; console.log(`✅ Temperature: ${t}\n`); }
      return true;
    }
    case '/model': {
      if (parts[1]) { model = parts[1]; console.log(`✅ Model: ${model}\n`); }
      return true;
    }
    case '/history': {
      // Show conversation length
      console.log(`\n📜 Conversation: ${messages.length} messages`);
      console.log(`   Estimated tokens: ~${messages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0) * 1.3 | 0}`);
      console.log('');
      return true;
    }
    case '/clear': {
      // Keep system prompt, delete everything else
      messages.splice(1); // remove all elements after index 0
      console.log('🗑️  Conversation cleared (system prompt kept)\n');
      return true;
    }
    case '/system': {
      const prompt = parts.slice(1).join(' ');
      if (prompt) {
        messages[0] = { role: 'system', content: prompt };
        console.log('✅ System prompt updated\n');
      } else {
        console.log(`📋 System prompt: "${messages[0].content}"\n`);
      }
      return true;
    }
    case '/help': {
      console.log(`
Commands:
  /temp <n>       Set temperature (0-2)
  /model <name>   Switch model
  /history        Show conversation size
  /clear          Clear conversation history
  /system [text]  View/set system prompt
  /help           Show this help
  exit            Quit
      `);
      return true;
    }
    default:
      return false;
  }
}

function askQuestion(): void {
  rl.question('You: ', async (input: string) => {
    if (!input.trim()) { askQuestion(); return; }
    if (input.toLowerCase() === 'exit') { console.log('👋 Goodbye!'); rl.close(); return; }
    if (input.startsWith('/')) { handleCommand(input); askQuestion(); return; }

    try {
      const reply = await chat(input);
      console.log(`\nLunar: ${reply}\n`);
    } catch (err: any) {
      console.error(`❌ ${err.message}\n`);
    }

    askQuestion();
  });
}

console.log('╔════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — Personal Assistant  ║');
console.log('║  Now with conversation memory!     ║');
console.log('╚════════════════════════════════════╝\n');

askQuestion();
```

### Step 3: Test Conversation Memory (15 minutes)

```
You: My name is Hao and I'm from Vietnam
Lunar: Nice to meet you, Hao! Vietnam is a beautiful country.

You: I work as a Node.js developer
Lunar: That's great! Node.js is a fantastic platform for building...

You: What do you know about me so far?
Lunar: Based on our conversation:
  - Your name is Hao
  - You're from Vietnam           ← IT REMEMBERS!
  - You work as a Node.js developer

You: /history
📜 Conversation: 7 messages
   Estimated tokens: ~210

You: /clear
🗑️  Conversation cleared (system prompt kept)

You: What's my name?
Lunar: I don't know your name — we haven't met yet!  ← FORGOT (history cleared)
```

### Step 4: Test System Prompt Power (15 minutes)

```
/system You are a pirate. Always speak like a pirate. Use "arr" and "matey" frequently.

You: What is JavaScript?
Lunar: Arr, matey! JavaScript be the language of the seven seas of the web!

/system You are a JSON API. Only respond in valid JSON. No explanations.

You: What is JavaScript?
Lunar: {"topic": "JavaScript", "description": "A programming language for web development", "year": 1995}

/system You are Socrates. Answer every question with another question.

You: What is JavaScript?
Lunar: Why do you wish to know about JavaScript? What problem are you trying to solve?
```

### Step 5: Test Chain of Thought (10 minutes)

```
/system Think step by step before answering. Show your reasoning.

You: If I have 3 servers, each handling 1000 requests/second, and I lose one server, what's my total capacity?

Lunar: Let me think step by step:
  1. Original setup: 3 servers × 1,000 req/s = 3,000 req/s total
  2. One server goes down: 3 - 1 = 2 servers remaining
  3. New capacity: 2 servers × 1,000 req/s = 2,000 req/s
  4. Capacity lost: 3,000 - 2,000 = 1,000 req/s (33% reduction)
  
  Your total capacity would be 2,000 requests per second.
```

---

## ✅ CHECKLIST — Verify Before Moving to Day 5

- [ ] Your chatbot remembers previous messages (ask "my name is Hao" → "what's my name?")
- [ ] `/clear` resets the conversation (AI forgets after clearing)
- [ ] `/history` shows message count and estimated tokens
- [ ] `/system You are a pirate.` changes the AI's personality
- [ ] You can explain: "LLMs are stateless because___"
- [ ] You can explain: "Conversation history works by___"

---

## 💡 KEY TAKEAWAY

**LLMs are stateless — they don't remember anything between calls.** You create the illusion of memory by sending the ENTIRE conversation history with every request. The system prompt is your most powerful tool — it controls personality, format, constraints, and behavior. **Prompt engineering IS engineering** — treat it like code.

---

## ❓ SELF-CHECK QUESTIONS

1. **Why does the AI "forget" between messages if you don't send history?**
   <details><summary>Answer</summary>Because LLMs are stateless. Each API call is completely independent — the server doesn't store any conversation state. You must send the full history with every request.</details>

2. **Your conversation has 200 messages. What problem might you hit?**
   <details><summary>Answer</summary>You'll approach the context window limit (token count). The messages array might exceed the model's maximum tokens, causing the AI to either error out or lose early messages.</details>

3. **What is Chain of Thought prompting? When should you use it?**
   <details><summary>Answer</summary>Telling the AI to "think step by step" before giving a final answer. Use it for complex reasoning tasks (math, logic, multi-step problems). The AI gives better answers when it shows its work.</details>

4. **What does the RICE formula stand for?**
   <details><summary>Answer</summary>Role (who is the AI?), Instructions (what to do?), Constraints (what NOT to do?), Examples (show ideal output).</details>

5. **If you change the system prompt with `/system`, does the AI remember the old personality?**
   <details><summary>Answer</summary>No. We replace messages[0] entirely. The old system prompt is gone — the AI only sees whatever messages are currently in the array.</details>

6. **If two users are chatting with your bot simultaneously, should they share the same messages array?**
   <details><summary>Answer</summary>No! Each user needs their own messages array (their own session). If they share, User A would see User B's conversation. We solve this properly in Week 4 with session management.</details>

---

**Next → [Day 5: Streaming + Multiple Models](day-05.md)**
