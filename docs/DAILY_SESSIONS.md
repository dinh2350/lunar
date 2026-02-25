# Lunar Daily Learning Sessions — 100-Day Plan

> **Format:** Each day = ~3-4 hours of focused work (adjust based on your schedule)
> **Schedule:** 5 days/week × 20 weeks = 100 working days
> **Weekend:** Rest, review, catch up on anything you didn't finish
> **Rule:** If a day feels too heavy, split it across 2 days — no rushing
> **Companion docs:** [LEARNING_GUIDE.md](LEARNING_GUIDE.md) · [AI_ENGINEER_ROADMAP.md](AI_ENGINEER_ROADMAP.md) · [architecture.md](architechture/architecture.md)

---

## How to Use This Document

Each day has 4 sections:

```
📖 LEARN   → What to study (videos, articles, docs)
🔨 BUILD   → What to code (specific files and features)
✅ ACHIEVE  → What you should have working by end of day
💡 KEY IDEA → The one concept to remember from today
```

**Track your progress:** Put an `[x]` next to each day as you complete it.

---

## PHASE 1: AI Foundations (Weeks 1-4)

---

### WEEK 1: LLM Basics + First AI Call

> **Week Goal:** Understand how LLMs work and call one from Node.js

---

#### [ ] Day 1 — Environment Setup + What is an LLM?

📖 **LEARN (1.5 hours)**
- Read LEARNING_GUIDE.md Part 1: "What Even Is an AI Engineer?" (15 min)
- Read LEARNING_GUIDE.md Part 2.1: "LLMs = Super Smart Text APIs" (15 min)
- Watch: [Karpathy "Let's build GPT" — FIRST HALF](https://www.youtube.com/watch?v=kCc8FmEb1nY) (60 min)
  - Stop at the "self-attention" section (~1 hour mark)
  - Don't worry about understanding every math detail
  - Focus on: what are tokens? how does the model predict the next word?

🔨 **BUILD (1.5 hours)**
- Install Ollama: download from [ollama.com](https://ollama.com)
- Pull your first models:
  ```bash
  ollama pull llama3.3          # main chat model (~4GB)
  ollama pull nomic-embed-text  # embedding model (~270MB)
  ```
- Test Ollama works:
  ```bash
  ollama run llama3.3 "What is the capital of Vietnam?"
  # Should respond: "The capital of Vietnam is Hanoi."
  ```
- Set up the Lunar monorepo:
  ```bash
  cd ~/Documents/project/lunar
  pnpm init
  # Create pnpm-workspace.yaml:
  echo 'packages:\n  - "packages/*"' > pnpm-workspace.yaml
  mkdir -p packages/shared/src
  mkdir -p packages/agent/src/llm
  ```
- Initialize TypeScript:
  ```bash
  pnpm add -D typescript tsx @types/node -w
  npx tsc --init  # creates tsconfig.json
  ```

✅ **ACHIEVE**
- Ollama installed and running
- `ollama run llama3.3` gives intelligent responses
- Lunar monorepo folder structure created
- TypeScript configured

💡 **KEY IDEA:** An LLM is just a text-prediction API. You send text in → you get text out. That's it at its core.

---

#### [ ] Day 2 — First LLM Call from TypeScript

📖 **LEARN (1 hour)**
- Finish: [Karpathy "Let's build GPT" — SECOND HALF](https://www.youtube.com/watch?v=kCc8FmEb1nY) (60 min)
  - Focus on: how attention works (intuitively), how training works
  - Key takeaway: the model learns patterns from text, then generates similar patterns

🔨 **BUILD (2.5 hours)**
- Install the Ollama JS client:
  ```bash
  cd packages/agent
  pnpm init
  pnpm add ollama
  ```
- Create `packages/agent/src/llm/client.ts`:
  ```typescript
  import { Ollama } from 'ollama';
  
  export const ollama = new Ollama({ host: 'http://localhost:11434' });
  
  export async function chat(userMessage: string): Promise<string> {
    const response = await ollama.chat({
      model: 'llama3.3',
      messages: [
        { role: 'system', content: 'You are Lunar, a helpful personal assistant.' },
        { role: 'user', content: userMessage }
      ]
    });
    return response.message.content;
  }
  ```
- Create `packages/agent/src/cli.ts` (a simple REPL):
  ```typescript
  import * as readline from 'readline';
  import { chat } from './llm/client.js';
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  function ask() {
    rl.question('You: ', async (input) => {
      if (input === 'exit') { rl.close(); return; }
      const answer = await chat(input);
      console.log(`Lunar: ${answer}\n`);
      ask();
    });
  }
  
  console.log('Lunar CLI — type "exit" to quit\n');
  ask();
  ```
- Run it: `npx tsx packages/agent/src/cli.ts`
- Have a 5-minute conversation with your AI — ask it anything

✅ **ACHIEVE**
- A working CLI chatbot: you type → AI responds
- You understand: model, system prompt, user message, assistant response

💡 **KEY IDEA:** Calling an LLM from code is just like calling any REST API. `messages` array = conversation history.

---

#### [ ] Day 3 — Tokens, Temperature, and Configuration

📖 **LEARN (1 hour)**
- Read: [Prompt Engineering Guide — Introduction](https://www.promptingguide.ai/introduction) (20 min)
- Read: [Prompt Engineering Guide — LLM Settings](https://www.promptingguide.ai/introduction/settings) (20 min)
  - Understand: temperature, top-p, max_tokens, frequency_penalty
- Experiment in terminal:
  ```bash
  # Temperature 0 (deterministic — same answer every time):
  ollama run llama3.3 "Give me a random number" --temperature 0
  ollama run llama3.3 "Give me a random number" --temperature 0
  # → Same answer both times!
  
  # Temperature 1 (creative — different each time):
  ollama run llama3.3 "Give me a random number" --temperature 1
  ollama run llama3.3 "Give me a random number" --temperature 1
  # → Different answers!
  ```

🔨 **BUILD (2 hours)**
- Add configuration to your LLM client:
  ```typescript
  // packages/agent/src/llm/client.ts — add LLMConfig
  export interface LLMConfig {
    model: string;
    temperature: number;   // 0 = deterministic, 1 = creative
    maxTokens: number;     // max response length
  }
  
  const DEFAULT_CONFIG: LLMConfig = {
    model: 'llama3.3',
    temperature: 0.7,
    maxTokens: 2048,
  };
  
  export async function chat(
    userMessage: string,
    systemPrompt?: string,
    config: Partial<LLMConfig> = {}
  ): Promise<string> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const response = await ollama.chat({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt ?? 'You are Lunar, a helpful assistant.' },
        { role: 'user', content: userMessage }
      ],
      options: {
        temperature: cfg.temperature,
        num_predict: cfg.maxTokens,
      }
    });
    return response.message.content;
  }
  ```
- Update CLI to support `/temp` and `/model` commands:
  - `/temp 0` — set temperature to 0
  - `/temp 1` — set temperature to 1
  - `/model qwen2.5:7b` — switch model
- Test: Ask the same question at temperature 0 vs 1 — observe the difference

✅ **ACHIEVE**
- CLI chatbot with configurable temperature and model
- You can explain what temperature, tokens, and context windows are

💡 **KEY IDEA:** Temperature controls creativity. Low = consistent/factual. High = varied/creative. Most AI apps use 0-0.7.

---

#### [ ] Day 4 — Conversation History + System Prompts

📖 **LEARN (1 hour)**
- Complete: [DeepLearning.ai "ChatGPT Prompt Engineering for Developers"](https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/) (1 hour, free)
  - Key sections: role prompting, output formatting, chain-of-thought

🔨 **BUILD (2.5 hours)**
- The problem: your chatbot forgets everything after each message!
- Fix: maintain a `messages[]` array across the conversation:
  ```typescript
  // packages/agent/src/cli.ts — update to keep conversation history
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: 'You are Lunar, a helpful personal assistant. Be concise.' }
  ];
  
  async function chat(userInput: string): Promise<string> {
    messages.push({ role: 'user', content: userInput });
    
    const response = await ollama.chat({
      model: 'llama3.3',
      messages: messages,  // ← entire history goes to the AI every time
    });
    
    const reply = response.message.content;
    messages.push({ role: 'assistant', content: reply });
    return reply;
  }
  ```
- Test multi-turn conversation:
  ```
  You: My name is Hao
  Lunar: Nice to meet you, Hao!
  You: What is my name?
  Lunar: Your name is Hao.     ← IT REMEMBERS NOW!
  ```
- Experiment with different system prompts:
  - `"You are a pirate. Speak like a pirate at all times."`
  - `"You are a senior software engineer. Be technical and precise."`
  - `"You always respond in JSON format."`
- Observe how the system prompt changes behavior

✅ **ACHIEVE**
- Chatbot remembers conversation context (multi-turn)
- You understand how message history works (entire array sent each time)
- You've experimented with 3+ different system prompts

💡 **KEY IDEA:** LLMs are STATELESS. They don't "remember" — you send the ENTIRE conversation every time. The messages array IS the memory.

---

#### [ ] Day 5 — Streaming + Multiple Models

📖 **LEARN (45 min)**
- Read: [Ollama API docs — streaming](https://github.com/ollama/ollama/blob/main/docs/api.md) (15 min)
- Read: [Ollama model library](https://ollama.com/library) — browse available models (15 min)
- Pull a second model: `ollama pull qwen2.5:7b` (smaller, faster)

🔨 **BUILD (2.5 hours)**
- Add streaming to your CLI:
  ```typescript
  // packages/agent/src/llm/client.ts — add streaming function
  export async function chatStream(
    messages: Message[],
    onToken: (token: string) => void
  ): Promise<string> {
    const stream = await ollama.chat({
      model: 'llama3.3',
      messages,
      stream: true,  // ← enables streaming
    });
    
    let fullResponse = '';
    for await (const chunk of stream) {
      const token = chunk.message.content;
      fullResponse += token;
      onToken(token);  // print each token as it arrives
    }
    return fullResponse;
  }
  ```
- Update CLI to use streaming (words appear one by one — much better UX!)
- Add model switching — try asking the same question to different models:
  - `llama3.3` — general purpose, high quality
  - `qwen2.5:7b` — faster, lighter
  - Notice speed vs quality trade-off
- Create `packages/agent/src/llm/types.ts` with shared types:
  ```typescript
  export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
  }
  
  export interface LLMProvider {
    chat(messages: Message[]): Promise<string>;
    chatStream(messages: Message[], onToken: (t: string) => void): Promise<string>;
  }
  ```

✅ **ACHIEVE**
- Streaming responses in CLI (words appear one by one)
- You can switch between different models
- Clean types for messages and LLM providers

💡 **KEY IDEA:** Streaming makes AI feel fast. Without it, users wait 5-10 seconds seeing nothing. With it, words appear instantly. Always stream in production.

---

### WEEK 1 CHECKPOINT ✅

```
What you should have:
├── ✅ Ollama installed with 2+ models
├── ✅ Working CLI chatbot (type question → get answer)
├── ✅ Multi-turn conversation (AI remembers context)
├── ✅ Streaming responses (word by word)
├── ✅ Configurable temperature and model
├── ✅ Clean TypeScript types (Message, LLMConfig, LLMProvider)
└── ✅ You can explain: tokens, temperature, system prompts, context windows

If something isn't working → use the weekend to catch up.
If everything works → celebrate! You just built your first AI app. 🎉
```

---

### WEEK 2: Tool Calling + Agent Loop

> **Week Goal:** Make the AI DO things — not just talk

---

#### [ ] Day 6 — Understanding Tool Calling

📖 **LEARN (1.5 hours)**
- Read: [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) (30 min)
  - Key concept: the AI doesn't call functions directly — it outputs structured JSON saying "I want to call function X with params Y", and YOUR code executes it
- Read: [Anthropic Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) (30 min)
  - Same concept, different provider — notice the pattern is universal
- Read LEARNING_GUIDE.md Part 2.4: "Agents = AI That Can Take Actions" (15 min)

🔨 **BUILD (2 hours)**
- Create `packages/agent/src/tools/types.ts`:
  ```typescript
  export interface ToolDefinition {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, {
          type: string;
          description: string;
        }>;
        required: string[];
      };
    };
  }
  
  export interface ToolResult {
    name: string;
    result: string;
    success: boolean;
  }
  ```
- Create your first tool — `packages/agent/src/tools/datetime.ts`:
  ```typescript
  export const datetimeTool: ToolDefinition = {
    type: 'function',
    function: {
      name: 'get_current_datetime',
      description: 'Get the current date and time',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  };
  
  export function execute(): string {
    return new Date().toLocaleString();
  }
  ```
- Test: Tell the AI you have a `get_current_datetime` tool and see if it tries to use it

✅ **ACHIEVE**
- You understand the tool-calling pattern (AI says what to call → you execute → you feed back result)
- First tool defined with JSON Schema
- You can explain the difference between a chatbot and an agent

💡 **KEY IDEA:** Tool calling is just structured output. The AI returns JSON like `{name: "get_weather", args: {city: "Hanoi"}}` and your code runs the actual function.

---

#### [ ] Day 7 — The Agent Loop (THE Most Important Pattern)

📖 **LEARN (45 min)**
- Read: [Anthropic "Building Effective Agents"](https://www.anthropic.com/research/building-effective-agents) (30 min) — MUST READ
  - Focus on: "augmented LLM" and "agent loop" concepts
- Read: [Chip Huyen "Agents"](https://huyenchip.com/2025/01/07/agents.html) — section on "Tool Use" (15 min)

🔨 **BUILD (3 hours)**
- This is THE core pattern. Build `packages/agent/src/runner.ts`:
  ```typescript
  import { ollama } from './llm/client.js';
  import type { Message } from './llm/types.js';
  import type { ToolDefinition } from './tools/types.js';
  
  export async function runAgent(
    userMessage: string,
    systemPrompt: string,
    tools: ToolDefinition[],
    executeTool: (name: string, args: any) => Promise<string>
  ): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
  
    // THE AGENT LOOP — keep going until AI gives a text response
    while (true) {
      const response = await ollama.chat({
        model: 'llama3.3',
        messages,
        tools,
      });
  
      // If no tool calls → AI is done, return the text
      if (!response.message.tool_calls?.length) {
        return response.message.content;
      }
  
      // AI wants to use tools → execute them
      messages.push(response.message);  // save AI's decision
  
      for (const call of response.message.tool_calls) {
        console.log(`🔧 Calling tool: ${call.function.name}`);
        const result = await executeTool(
          call.function.name,
          JSON.parse(call.function.arguments)
        );
        console.log(`📎 Result: ${result.slice(0, 100)}...`);
        messages.push({ role: 'tool', content: result });
      }
      // Loop back → AI sees results → might call more tools or respond
    }
  }
  ```
- Test with your datetime tool:
  ```
  You: What time is it right now?
  🔧 Calling tool: get_current_datetime
  📎 Result: 2/24/2026, 3:45:00 PM
  Lunar: It's currently 3:45 PM on February 24, 2026.
  ```

✅ **ACHIEVE**
- Working agent loop (AI → tool → AI → tool → ... → answer)
- AI correctly decides WHEN to use tools vs just answering directly
- You see the loop in action (tool calls logged in console)

💡 **KEY IDEA:** The agent loop is just a `while(true)` — AI talks, if it wants a tool → execute → feed result back → repeat. This 20-line loop is the core of AI engineering.

---

#### [ ] Day 8 — Building Real Tools (Bash + File System)

📖 **LEARN (30 min)**
- Read Lunar architecture.md section 3.5 (Tool Executor) — understand the tool structure
- Read: how `child_process.exec` works in Node.js (you probably know this already)

🔨 **BUILD (3 hours)**
- Create `packages/tools/` package with real tools:
- **Bash tool** — `packages/tools/src/bash.ts`:
  ```typescript
  import { exec } from 'child_process';
  import { promisify } from 'util';
  const execAsync = promisify(exec);
  
  export const bashTool = {
    type: 'function' as const,
    function: {
      name: 'bash',
      description: 'Execute a shell command and return the output',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' }
        },
        required: ['command'],
      },
    },
  };
  
  export async function executeBash(args: { command: string }): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(args.command, { timeout: 10000 });
      return stdout || stderr || '(no output)';
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }
  ```
- **File read tool** — `packages/tools/src/filesystem.ts`:
  ```typescript
  import { readFile, readdir } from 'fs/promises';
  
  export const readFileTool = { /* ... define JSON schema ... */ };
  export const listDirTool = { /* ... define JSON schema ... */ };
  
  export async function executeReadFile(args: { path: string }): Promise<string> {
    return await readFile(args.path, 'utf8');
  }
  
  export async function executeListDir(args: { path: string }): Promise<string> {
    const files = await readdir(args.path);
    return files.join('\n');
  }
  ```
- Create `packages/tools/src/executor.ts` — central tool dispatcher:
  ```typescript
  export async function executeTool(name: string, args: any): Promise<string> {
    switch (name) {
      case 'bash': return executeBash(args);
      case 'read_file': return executeReadFile(args);
      case 'list_dir': return executeListDir(args);
      case 'get_current_datetime': return new Date().toLocaleString();
      default: return `Unknown tool: ${name}`;
    }
  }
  ```
- Test the agent with real tasks:
  ```
  You: How many files are in my current directory?
  🔧 Calling tool: bash { command: "ls | wc -l" }
  Lunar: There are 12 files in your current directory.
  
  You: What does my package.json say?
  🔧 Calling tool: read_file { path: "package.json" }
  Lunar: Your package.json defines a project called "lunar"...
  ```

✅ **ACHIEVE**
- 3+ working tools (bash, file read, list directory, datetime)
- Agent uses the RIGHT tool for each question
- Tool executor dispatches to correct implementation

💡 **KEY IDEA:** Tools are just regular functions. The AI decides which one to call based on the `description` you provide. Good descriptions = AI picks the right tool.

---

#### [ ] Day 9 — Tool Approval + Error Handling

📖 **LEARN (30 min)**
- Read Lunar architecture.md section on Tool Approval (`approval.ts` — allow/ask/deny)
- Think about: what if the AI wants to run `rm -rf /`? We need safety!

🔨 **BUILD (3 hours)**
- Add approval system to the tool executor:
  ```typescript
  type ApprovalPolicy = 'allow' | 'ask' | 'deny';
  
  const TOOL_POLICIES: Record<string, ApprovalPolicy> = {
    'get_current_datetime': 'allow',  // safe, always allow
    'read_file': 'allow',             // safe, read-only
    'list_dir': 'allow',              // safe, read-only
    'bash': 'ask',                    // dangerous! ask user first
  };
  ```
- When policy = `'ask'`, prompt user in CLI:
  ```
  You: Delete all temp files
  🔧 Agent wants to run: bash("rm -rf /tmp/lunar-*")
  ⚠️  Allow this? [y/n]: y
  ✅ Executed.
  ```
- Add error handling to the agent loop:
  - What if a tool throws? → catch, return error message to AI, let it try again
  - What if AI loops forever? → add max iterations (e.g., 10 tool calls max)
  - What if Ollama is down? → try/catch with clear error message
- Add a `file_write` tool (with `'ask'` approval policy)
- Test error cases:
  - Ask AI to read a file that doesn't exist → does it handle gracefully?
  - Ask AI to do something impossible → does it give up correctly?

✅ **ACHIEVE**
- Tool approval system (allow/ask/deny)
- Error handling in agent loop (max iterations, tool errors)
- 4+ tools with appropriate safety policies
- Agent handles errors gracefully (reports to user, doesn't crash)

💡 **KEY IDEA:** AI + shell access = powerful but dangerous. Always have approval gates for destructive actions. "ask" mode is your safety net.

---

#### [ ] Day 10 — Polish + Architecture Alignment

📖 **LEARN (1 hour)**
- Complete: [DeepLearning.ai "Functions, Tools and Agents with LangChain"](https://www.deeplearning.ai/short-courses/) (1 hour, free)
  - Don't use LangChain — just understand the PATTERNS they teach
  - Focus on: how tools are defined, how the agent selects tools

🔨 **BUILD (2.5 hours)**
- Refactor your code to match Lunar's architecture:
  ```
  packages/
  ├── agent/src/
  │   ├── llm/
  │   │   ├── client.ts       ← Ollama client (done)
  │   │   └── types.ts        ← Message, LLMConfig types (done)
  │   ├── runner.ts           ← agent loop (done)
  │   └── cli.ts              ← REPL interface (done)
  ├── tools/src/
  │   ├── executor.ts         ← tool dispatcher (done)
  │   ├── bash.ts             ← shell tool (done)
  │   ├── filesystem.ts       ← file tools (done)
  │   └── datetime.ts         ← datetime tool (done)
  └── shared/src/
      └── types.ts            ← shared interfaces
  ```
- Add a `help` command to CLI that lists available tools
- Add logging: save each conversation to a `.jsonl` file (this becomes Lunar's session transcript later):
  ```typescript
  // Append each turn to a file
  import { appendFile } from 'fs/promises';
  
  async function logTurn(role: string, content: string) {
    const line = JSON.stringify({ type: role, content, ts: new Date().toISOString() });
    await appendFile('session.jsonl', line + '\n');
  }
  ```
- Test the full flow end-to-end: multi-turn conversation with tool calls and logging

✅ **ACHIEVE**
- Clean project structure matching Lunar's architecture
- Conversation logging to JSONL
- This is a REAL agent — it thinks, uses tools, remembers context, and handles errors

💡 **KEY IDEA:** You just built the core of what AI Engineers build at companies. The architecture scales — add more tools, better prompts, more models. The loop stays the same.

---

### WEEK 2 CHECKPOINT ✅

```
What you should have:
├── ✅ Agent loop (while loop: AI → tool → AI → response)
├── ✅ 4+ tools (bash, file read, file write, list dir, datetime)
├── ✅ Tool approval system (allow/ask/deny)
├── ✅ Error handling (max iterations, tool errors, graceful failures)
├── ✅ Conversation logging to JSONL
├── ✅ Clean project structure
└── ✅ You can explain: agent loop, tool calling, function calling, JSON schema
```

---

### WEEK 3: RAG Pipeline + Memory

> **Week Goal:** Give the AI memory — it can search and answer from YOUR documents

---

#### [ ] Day 11 — Text Chunking + Understanding Embeddings

📖 **LEARN (1.5 hours)**
- Read LEARNING_GUIDE.md Part 2.2: "Embeddings = Turning Text Into Searchable Numbers" (10 min)
- Read LEARNING_GUIDE.md Part 2.3: "RAG = Look Up Info Before Answering" (10 min)
- Watch: [DeepLearning.ai "Building and Evaluating Advanced RAG"](https://www.deeplearning.ai/short-courses/) — first 3 lessons (60 min)
  - Focus on: what is chunking? why do we need it? what size chunks?

🔨 **BUILD (2 hours)**
- Create `packages/memory/` package
- Build the chunker — `packages/memory/src/chunker.ts`:
  ```typescript
  export interface Chunk {
    id: string;
    content: string;
    filePath: string;
    chunkIndex: number;
    tokenCount: number;
  }
  
  export function chunkText(
    text: string,
    filePath: string,
    chunkSize = 400,    // tokens per chunk
    overlap = 80         // overlap between chunks
  ): Chunk[] {
    const words = text.split(/\s+/);
    const chunks: Chunk[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const content = words.slice(i, i + chunkSize).join(' ');
      chunks.push({
        id: `${filePath}:${chunks.length}`,
        content,
        filePath,
        chunkIndex: chunks.length,
        tokenCount: content.split(/\s+/).length,
      });
    }
    return chunks;
  }
  ```
- Test with a real file:
  ```typescript
  const text = fs.readFileSync('docs/architechture/architecture.md', 'utf8');
  const chunks = chunkText(text, 'architecture.md');
  console.log(`Created ${chunks.length} chunks`);
  console.log(`First chunk (${chunks[0].tokenCount} tokens):`, chunks[0].content.slice(0, 200));
  ```
- Generate embeddings for one chunk:
  ```typescript
  import { ollama } from '../agent/src/llm/client.js';
  
  const response = await ollama.embed({
    model: 'nomic-embed-text',
    input: chunks[0].content,
  });
  console.log(`Embedding dimensions: ${response.embeddings[0].length}`);  // 768
  console.log(`First 5 values:`, response.embeddings[0].slice(0, 5));
  ```

✅ **ACHIEVE**
- Working text chunker (splits any file into 400-token chunks with 80-token overlap)
- You can generate embeddings from text
- You understand: chunks, embeddings, vectors, dimensions (768)

💡 **KEY IDEA:** We chunk because AI has limited context. Instead of sending a whole book, we find the 5 most relevant chunks and send only those. Embeddings let us find those chunks by meaning.

---

#### [ ] Day 12 — SQLite Vector Store

📖 **LEARN (30 min)**
- Read: [sqlite-vec documentation](https://github.com/asg017/sqlite-vec) (20 min)
- Read: Lunar architecture.md section 4.4 (SQLite Schema) — this is what you're building

🔨 **BUILD (3 hours)**
- Install dependencies:
  ```bash
  cd packages/memory
  pnpm add better-sqlite3 sqlite-vec
  pnpm add -D @types/better-sqlite3
  ```
- Create `packages/memory/src/store.ts`:
  ```typescript
  import Database from 'better-sqlite3';
  import * as sqliteVec from 'sqlite-vec';
  
  export function createStore(dbPath: string) {
    const db = new Database(dbPath);
    sqliteVec.load(db);  // enable vector search
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
        USING fts5(content, content=chunks, content_rowid=rowid);
      
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec
        USING vec0(chunk_id TEXT, embedding FLOAT[768]);
    `);
    
    return {
      insertChunk(chunk: Chunk, embedding: number[]) { /* ... */ },
      searchVector(queryEmbedding: number[], limit: number) { /* ... */ },
      searchBM25(query: string, limit: number) { /* ... */ },
    };
  }
  ```
- Implement `insertChunk` — stores text + vector
- Implement `searchVector` — finds similar chunks by embedding
- Implement `searchBM25` — finds chunks by keyword matching
- Index a test file and search it:
  ```typescript
  const store = createStore('./test-memory.sqlite');
  // Index all chunks from architecture.md
  for (const chunk of chunks) {
    const embedding = await embed(chunk.content);
    store.insertChunk(chunk, embedding);
  }
  // Search!
  const results = store.searchVector(await embed("How does the agent loop work?"), 5);
  console.log(results);
  ```

✅ **ACHIEVE**
- SQLite database with vector search (sqlite-vec) working
- Can insert chunks + embeddings
- Can search by vector similarity AND by keywords (BM25)
- Indexed a real document and retrieved relevant chunks

💡 **KEY IDEA:** Vector databases are just "find me the rows with the most similar number arrays." SQLite + sqlite-vec does this locally — no cloud needed.

---

#### [ ] Day 13 — Hybrid Search (BM25 + Vector)

📖 **LEARN (30 min)**
- Read LEARNING_GUIDE.md section 3.6: "The Memory Search Pipeline" (10 min)
- Read: [Why hybrid search beats pure vector search](https://www.pinecone.io/learn/hybrid-search-intro/) (20 min)

🔨 **BUILD (3 hours)**
- Create `packages/memory/src/search.ts` — the hybrid search engine:
  ```typescript
  export async function hybridSearch(
    query: string,
    store: Store,
    options = { vectorWeight: 0.7, bm25Weight: 0.3, limit: 5 }
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await embed(query);
    
    // Run BOTH searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      store.searchVector(queryEmbedding, options.limit * 2),
      store.searchBM25(query, options.limit * 2),
    ]);
    
    // Merge results with weighted scoring
    const merged = mergeResults(vectorResults, bm25Results, options);
    
    return merged.slice(0, options.limit);
  }
  
  function mergeResults(vectorRes, bm25Res, options): SearchResult[] {
    const scores = new Map<string, number>();
    
    // Normalize and weight vector scores
    const maxVec = Math.max(...vectorRes.map(r => r.score));
    for (const r of vectorRes) {
      scores.set(r.id, (scores.get(r.id) ?? 0) + (r.score / maxVec) * options.vectorWeight);
    }
    
    // Normalize and weight BM25 scores
    const maxBM25 = Math.max(...bm25Res.map(r => r.score));
    for (const r of bm25Res) {
      scores.set(r.id, (scores.get(r.id) ?? 0) + (r.score / maxBM25) * options.bm25Weight);
    }
    
    // Sort by combined score
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ id, score, content: getContent(id) }));
  }
  ```
- Test: Try queries that should benefit from each search type:
  ```
  "agent loop" → BM25 finds exact keyword matches
  "how the AI decides what to do next" → Vector finds semantic matches
  Hybrid combines both for best results!
  ```
- Compare results: vector-only vs BM25-only vs hybrid — verify hybrid is better

✅ **ACHIEVE**
- Hybrid search working (BM25 + vector merged with weighted scoring)
- You can demonstrate that hybrid beats either method alone
- Search returns relevant chunks for any question

💡 **KEY IDEA:** BM25 finds exact words ("agent loop"). Vector finds meaning ("how AI decides"). Hybrid finds both. That's why production RAG uses hybrid search.

---

#### [ ] Day 14 — Connect RAG to the Agent

📖 **LEARN (30 min)**
- Finish: [DeepLearning.ai "Building and Evaluating Advanced RAG"](https://www.deeplearning.ai/short-courses/) — remaining lessons

🔨 **BUILD (3 hours)**
- Create a `memory_search` tool:
  ```typescript
  export const memorySearchTool = {
    type: 'function' as const,
    function: {
      name: 'memory_search',
      description: 'Search through the knowledge base to find relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query'],
      },
    },
  };
  
  export async function executeMemorySearch(args: { query: string }): Promise<string> {
    const results = await hybridSearch(args.query, store, { limit: 5 });
    return results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
  }
  ```
- Register `memory_search` in the tool executor
- Update system prompt to tell the AI about memory:
  ```
  "You have access to a knowledge base via the memory_search tool.
   When the user asks about topics that might be in the knowledge base,
   ALWAYS search first before answering. Never make things up."
  ```
- Index your docs/architecture.md into the vector store
- Test RAG end-to-end:
  ```
  You: How does Lunar handle message routing?
  🔧 Calling tool: memory_search { query: "message routing" }
  📎 Found 5 relevant chunks
  Lunar: Lunar routes messages using a bindings[] array with priority tiers...
         [accurate answer from the architecture doc!]
  ```

✅ **ACHIEVE**
- Full RAG pipeline working: question → search memory → inject context → AI answers
- AI answers from YOUR documents, not from training data
- You can index any markdown file and ask questions about it

💡 **KEY IDEA:** RAG is the most important pattern in AI engineering. It's how you stop hallucination — force the AI to answer from REAL data instead of guessing.

---

#### [ ] Day 15 — Temporal Decay + MMR Re-ranking

📖 **LEARN (30 min)**
- Read about MMR (Maximal Marginal Relevance) — removes duplicate/similar results
- Read about temporal decay — recent memories rank higher

🔨 **BUILD (3 hours)**
- Add temporal decay to `packages/memory/src/search.ts`:
  ```typescript
  function applyTemporalDecay(results: SearchResult[], halfLifeDays = 30): SearchResult[] {
    const now = Date.now();
    return results.map(r => {
      const ageMs = now - r.createdAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decay = Math.pow(0.5, ageDays / halfLifeDays);  // exponential decay
      return { ...r, score: r.score * decay };
    }).sort((a, b) => b.score - a.score);
  }
  ```
- Add MMR re-ranking (removes near-duplicate results):
  ```typescript
  function mmrRerank(results: SearchResult[], lambda = 0.7, limit = 5): SearchResult[] {
    const selected: SearchResult[] = [];
    const remaining = [...results];
    
    while (selected.length < limit && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      
      for (let i = 0; i < remaining.length; i++) {
        const relevance = remaining[i].score;
        const maxSimilarity = Math.max(0,
          ...selected.map(s => cosineSimilarity(remaining[i].embedding, s.embedding)));
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;
        
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }
      
      selected.push(remaining.splice(bestIdx, 1)[0]);
    }
    return selected;
  }
  ```
- Update the search pipeline: `search → merge → decay → MMR → top 5`
- Add `memory_write` tool (so the AI can save new memories):
  ```typescript
  // AI can now remember things you tell it
  export async function executeMemoryWrite(args: { key: string; content: string }) {
    const filePath = `memory/${new Date().toISOString().split('T')[0]}.md`;
    await appendFile(filePath, `\n## ${args.key}\n${args.content}\n`);
    await reindex(filePath);  // re-index so it's searchable immediately
    return `Saved to memory: ${args.key}`;
  }
  ```
- Test:
  ```
  You: Remember that my favorite restaurant is Pho 99
  🔧 Calling tool: memory_write { key: "favorite restaurant", content: "Pho 99" }
  Lunar: Got it! I'll remember that your favorite restaurant is Pho 99.
  
  You: What's my favorite restaurant?
  🔧 Calling tool: memory_search { query: "favorite restaurant" }
  Lunar: Your favorite restaurant is Pho 99.
  ```

✅ **ACHIEVE**
- Full memory search pipeline: BM25 + Vector → merge → temporal decay → MMR
- AI can write to memory AND search it
- Recent memories rank higher (temporal decay)
- Results are diverse (MMR de-duplication)

💡 **KEY IDEA:** The memory pipeline (merge → decay → MMR) is what makes Lunar's RAG production-quality. Most tutorials skip decay and MMR — you're already ahead.

---

### WEEK 3 CHECKPOINT ✅

```
What you should have:
├── ✅ Text chunker (400 tokens, 80 overlap)
├── ✅ Embedding generation (Ollama nomic-embed-text)
├── ✅ SQLite vector store (sqlite-vec)
├── ✅ BM25 full-text search (FTS5)
├── ✅ Hybrid search (70% vector + 30% BM25)
├── ✅ Temporal decay (recent > old)
├── ✅ MMR re-ranking (diverse results)
├── ✅ memory_search tool (agent searches knowledge base)
├── ✅ memory_write tool (agent saves new memories)
├── ✅ RAG working end-to-end: question → search → accurate answer
└── ✅ You can explain: RAG, chunking, embeddings, hybrid search, BM25, MMR
```

---

### WEEK 4: Messaging Channels + Session Persistence

> **Week Goal:** Talk to your AI on Telegram + conversations survive restarts

---

#### [ ] Day 16 — Session Management (JSONL Transcripts)

📖 **LEARN (30 min)**
- Read Lunar architecture.md section 4.2-4.3 (sessions.json + JSONL transcripts)

🔨 **BUILD (3 hours)**
- Create `packages/session/` package
- Build session manager — `packages/session/src/manager.ts`:
  ```typescript
  export class SessionManager {
    private basePath: string;
    
    constructor(basePath: string) { this.basePath = basePath; }
    
    // Load conversation history from JSONL file
    async loadHistory(sessionId: string): Promise<Message[]> {
      const filePath = path.join(this.basePath, `${sessionId}.jsonl`);
      if (!existsSync(filePath)) return [];
      const lines = (await readFile(filePath, 'utf8')).trim().split('\n');
      return lines.map(line => JSON.parse(line));
    }
    
    // Append a new turn to the transcript
    async appendTurn(sessionId: string, message: Message) {
      const filePath = path.join(this.basePath, `${sessionId}.jsonl`);
      const line = JSON.stringify({ ...message, ts: new Date().toISOString() });
      await appendFile(filePath, line + '\n');
    }
    
    // Resolve which session a message belongs to
    resolveSessionId(provider: string, peerId: string): string {
      return `agent:main:${provider}:${peerId}`;
    }
  }
  ```
- Update the agent runner to load/save history:
  - On new message: load history → build context → run agent → save all new turns
- Test: have a conversation → close the program → restart → conversation continues!

✅ **ACHIEVE**
- Sessions persist to disk as JSONL files
- Conversation survives program restarts
- Session ID scheme: `agent:main:provider:peerId`

💡 **KEY IDEA:** JSONL (one JSON object per line) is perfect for conversation logs — human-readable, append-only, easy to parse. Each line = one turn.

---

#### [ ] Day 17 — Telegram Bot Setup

📖 **LEARN (30 min)**
- Read: [grammY Getting Started](https://grammy.dev/guide/) (30 min)

🔨 **BUILD (3 hours)**
- Set up a Telegram bot:
  1. Open Telegram → search `@BotFather` → send `/newbot`
  2. Choose name: "Lunar AI" + username: "lunar_ai_bot" (must end in `bot`)
  3. Copy the token BotFather gives you
- Create `packages/connectors/` package
- Build `packages/connectors/src/telegram/connector.ts`:
  ```typescript
  import { Bot } from 'grammy';
  
  export function createTelegramBot(token: string, onMessage: (envelope) => Promise<string>) {
    const bot = new Bot(token);
    
    bot.on('message:text', async (ctx) => {
      // Normalize into InboundEnvelope
      const envelope = {
        provider: 'telegram' as const,
        peerId: `user:${ctx.from.id}`,
        text: ctx.message.text,
        chatType: ctx.chat.type === 'private' ? 'direct' : 'group',
      };
      
      // Process through agent
      const reply = await onMessage(envelope);
      
      // Send response
      await ctx.reply(reply);
    });
    
    return bot;
  }
  ```
- Wire it up: create an entry point that starts the bot + agent engine:
  ```typescript
  const bot = createTelegramBot(process.env.TELEGRAM_TOKEN!, async (envelope) => {
    const sessionId = sessionManager.resolveSessionId(envelope.provider, envelope.peerId);
    const history = await sessionManager.loadHistory(sessionId);
    const response = await runAgent(envelope.text, systemPrompt, tools, executeTool, history);
    await sessionManager.appendTurn(sessionId, { role: 'user', content: envelope.text });
    await sessionManager.appendTurn(sessionId, { role: 'assistant', content: response });
    return response;
  });
  
  bot.start();
  console.log('🤖 Lunar is live on Telegram!');
  ```
- **Test it!** Open Telegram → message your bot → get AI responses

✅ **ACHIEVE**
- Lunar responds on Telegram!
- Bot handles direct messages
- Conversations persist between messages

💡 **KEY IDEA:** Telegram bots are free forever. grammY handles all the complexity. Your connector just normalizes the message format.

---

#### [ ] Day 18 — WebChat Connector (WebSocket)

📖 **LEARN (30 min)**
- Quick refresher: WebSocket basics (you know this from Node.js)

🔨 **BUILD (3 hours)**
- Create `packages/connectors/src/webchat/connector.ts`:
  ```typescript
  import { WebSocketServer } from 'ws';
  
  export function createWebChatServer(port: number, onMessage) {
    const wss = new WebSocketServer({ port });
    
    wss.on('connection', (ws) => {
      const peerId = `webchat:${crypto.randomUUID()}`;
      
      ws.on('message', async (data) => {
        const { text } = JSON.parse(data.toString());
        const envelope = { provider: 'webchat', peerId, text, chatType: 'direct' };
        const reply = await onMessage(envelope);
        ws.send(JSON.stringify({ type: 'message', content: reply }));
      });
    });
    
    return wss;
  }
  ```
- Create a simple HTML client for testing (save as `test-webchat.html`):
  ```html
  <script>
    const ws = new WebSocket('ws://localhost:18789');
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      document.getElementById('chat').innerHTML += `<p>Lunar: ${msg.content}</p>`;
    };
    function send() {
      const input = document.getElementById('input');
      ws.send(JSON.stringify({ text: input.value }));
      document.getElementById('chat').innerHTML += `<p>You: ${input.value}</p>`;
      input.value = '';
    }
  </script>
  <div id="chat"></div>
  <input id="input" onkeyup="if(event.key==='Enter')send()">
  <button onclick="send()">Send</button>
  ```
- Test: open the HTML file in browser → chat with Lunar via WebSocket

✅ **ACHIEVE**
- WebChat connector working via WebSocket
- Can chat with Lunar from a browser
- Two channels working: Telegram + WebChat, same agent, same memory

💡 **KEY IDEA:** Channel connectors just normalize different message formats into the same InboundEnvelope. The agent doesn't care where the message came from.

---

#### [ ] Day 19 — Long-Term Memory (MEMORY.md + Daily Logs)

📖 **LEARN (15 min)**
- Read Lunar architecture.md section 4.1 — the file system layout for memory

🔨 **BUILD (3 hours)**
- Set up the memory file structure:
  ```
  ~/.lunar/agents/main/workspace/
  ├── MEMORY.md              ← permanent facts ("User's name is Hao")
  ├── memory/
  │   ├── 2026-02-24.md      ← today's daily log
  │   └── 2026-02-25.md      ← tomorrow's daily log
  ```
- Enhance the `memory_write` tool to write to the correct files:
  - Permanent facts → append to `MEMORY.md`
  - Temporary/daily info → append to `memory/YYYY-MM-DD.md`
- Build an auto-indexer (`packages/memory/src/indexer.ts`):
  - Watch for file changes in the memory directory
  - Re-chunk and re-embed changed files
  - Keep the vector store in sync
- Teach the AI about memory structure in the system prompt:
  ```
  "You have two types of memory:
   - memory_search: find previously stored information
   - memory_write: save important facts for later
   When the user shares personal info (name, preferences, etc.), 
   always save it with memory_write."
  ```
- Test the full flow:
  ```
  Day 1:
    You: My cat's name is Luna
    Lunar: [saves to memory] Got it! Luna is your cat.
  
  Day 2 (new session):
    You: What's my cat's name?
    Lunar: [searches memory] Your cat's name is Luna!
  ```

✅ **ACHIEVE**
- MEMORY.md for permanent facts
- Daily log files for temporal information
- Auto-indexer keeps vector store in sync
- Memory persists across sessions AND across days

💡 **KEY IDEA:** This 3-tier memory (session JSONL + MEMORY.md + daily logs + vector search) is what makes Lunar a real personal AI, not just a chatbot.

---

#### [ ] Day 20 — Gateway Integration + Week 4 Polish

📖 **LEARN (1 hour)**
- Read Lunar architecture.md sections 3.1 (Gateway) and 7.1-7.2 (API Design)
- Understand: the Gateway is the central hub that starts everything

🔨 **BUILD (2.5 hours)**
- Create a simple gateway entry point — `packages/gateway/src/index.ts`:
  ```typescript
  import Fastify from 'fastify';
  
  const app = Fastify();
  
  // Health check
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));
  
  // Start everything
  async function start() {
    // 1. Load config
    // 2. Initialize memory store
    // 3. Start agent engine
    // 4. Start Telegram connector
    // 5. Start WebChat (WebSocket)
    // 6. Start HTTP server
    
    await app.listen({ port: 18789 });
    console.log('🌙 Lunar Gateway running on port 18789');
  }
  
  start();
  ```
- Wire all components together:
  - Gateway starts → initializes memory → starts agent → starts connectors
  - Single `pnpm dev` command runs everything
- Add a `GET /api/status` endpoint that shows: active sessions, loaded tools, memory stats
- Test full integration: start gateway → chat on Telegram AND WebChat → verify they share memory

✅ **ACHIEVE**
- Single entry point starts entire system
- Fastify HTTP server + WebSocket server
- Telegram + WebChat connectors running simultaneously
- Shared agent engine and memory across channels
- Health check endpoint

💡 **KEY IDEA:** The Gateway pattern (single process, multiple connectors) is how real chat systems work. One server, many channels, one AI brain.

---

### WEEK 4 CHECKPOINT ✅

```
What you should have:
├── ✅ Session management (JSONL transcripts, persist across restarts)
├── ✅ Telegram bot (live, responding to DMs)
├── ✅ WebChat (WebSocket, works in browser)
├── ✅ Long-term memory (MEMORY.md + daily logs)
├── ✅ Auto-indexer (file changes → re-index)
├── ✅ Gateway (Fastify, starts everything)
├── ✅ Shared memory across channels
└── ✅ This is a REAL AI assistant — it remembers, it takes actions, it lives on Telegram

🚀 MILESTONE: PHASE 1 COMPLETE — You have a working AI agent!
```

---

## PHASE 2: Close Critical Gaps (Weeks 5-8)

---

### WEEK 5: 🔴 Python Crash Course + Eval Service

> **Week Goal:** Learn Python and build a FastAPI evaluation service

---

#### [ ] Day 21 — Python Setup + Syntax Basics

📖 **LEARN (2 hours)**
- Read LEARNING_GUIDE.md Part 5: "Python for Node.js Developers — Survival Guide"
- Follow along: install Python 3.12+, set up a virtual environment
- Do: [Python official tutorial — first 5 sections](https://docs.python.org/3/tutorial/) (1 hour)

🔨 **BUILD (1.5 hours)**
- Set up Python project:
  ```bash
  mkdir -p packages/eval-service
  cd packages/eval-service
  python3 -m venv .venv
  source .venv/bin/activate
  pip install fastapi uvicorn pydantic httpx ollama
  ```
- Create `packages/eval-service/hello.py` — test Python works:
  ```python
  # Variables, functions, loops — compare to TypeScript counterparts
  name: str = "Hao"
  numbers: list[int] = [1, 2, 3, 4, 5]
  
  def greet(name: str) -> str:
      return f"Hello {name}!"
  
  for n in numbers:
      print(f"Number: {n}")
  
  # Async (just like Node.js!)
  import asyncio
  
  async def fetch_data() -> str:
      await asyncio.sleep(1)
      return "data loaded"
  
  asyncio.run(fetch_data())
  ```
- Create `packages/eval-service/hello_ai.py` — call Ollama from Python:
  ```python
  import ollama
  
  response = ollama.chat(
      model='llama3.3',
      messages=[{'role': 'user', 'content': 'Hi from Python!'}]
  )
  print(response['message']['content'])
  ```

✅ **ACHIEVE**
- Python environment set up (.venv, pip)
- You can write basic Python (variables, functions, loops, async)
- You can call Ollama from Python

💡 **KEY IDEA:** Python syntax is simpler than JavaScript — no braces, no semicolons, indentation matters. `const` → no keyword needed, `:string` → `:str`, `console.log` → `print`.

---

#### [ ] Day 22 — FastAPI Basics ("Python's Fastify")

📖 **LEARN (1 hour)**
- Follow: [FastAPI First Steps tutorial](https://fastapi.tiangolo.com/tutorial/first-steps/) (1 hour)

🔨 **BUILD (2.5 hours)**
- Create `packages/eval-service/main.py`:
  ```python
  from fastapi import FastAPI
  from pydantic import BaseModel
  
  app = FastAPI(title="Lunar Eval Service")
  
  class HealthResponse(BaseModel):
      status: str
      version: str
  
  @app.get("/health")
  def health() -> HealthResponse:
      return HealthResponse(status="ok", version="0.1.0")
  
  class ChatRequest(BaseModel):
      message: str
  
  class ChatResponse(BaseModel):
      reply: str
  
  @app.post("/chat")
  async def chat(req: ChatRequest) -> ChatResponse:
      import ollama
      response = ollama.chat(
          model='llama3.3',
          messages=[{'role': 'user', 'content': req.message}]
      )
      return ChatResponse(reply=response['message']['content'])
  ```
- Run it: `uvicorn main:app --reload`
- Test it: open `http://localhost:8000/docs` — FastAPI auto-generates API docs!
- Call from terminal: `curl -X POST http://localhost:8000/chat -H "Content-Type: application/json" -d '{"message": "Hello"}'`

✅ **ACHIEVE**
- FastAPI server running with auto-generated docs
- POST endpoint that calls an LLM
- You see: Pydantic = Zod, FastAPI decorators = Fastify routes

💡 **KEY IDEA:** FastAPI is incredibly similar to Fastify — route decorators, Pydantic validation (like Zod), auto-docs. If you know Fastify, you know 80% of FastAPI.

---

#### [ ] Day 23 — Build the Evaluation Endpoint

📖 **LEARN (30 min)**
- Read about LLM-as-judge: using one AI to grade another AI's answers

🔨 **BUILD (3 hours)**
- Add the evaluation endpoint to `main.py`:
  ```python
  class EvalRequest(BaseModel):
      question: str
      ai_answer: str
      context: list[str]  # retrieved chunks used to generate the answer
  
  class EvalResult(BaseModel):
      relevance: float       # 0-1: how relevant is the answer to the question?
      faithfulness: float    # 0-1: does the answer stick to the context?
      hallucination: bool    # did the AI make up facts not in the context?
      reasoning: str         # explanation of the scores
  
  @app.post("/evaluate")
  async def evaluate(req: EvalRequest) -> EvalResult:
      prompt = f"""You are an AI evaluation judge. Rate this AI response.
      
      Question: {req.question}
      Context provided to the AI: {chr(10).join(req.context)}
      AI's Answer: {req.ai_answer}
      
      Return ONLY valid JSON:
      {{
        "relevance": 0.0 to 1.0,
        "faithfulness": 0.0 to 1.0,
        "hallucination": true/false,
        "reasoning": "brief explanation"
      }}"""
      
      response = ollama.chat(model='llama3.3', messages=[{'role': 'user', 'content': prompt}])
      result = json.loads(response['message']['content'])
      return EvalResult(**result)
  ```
- Test: evaluate a real response from your Lunar agent
- Add a `/batch-evaluate` endpoint that runs multiple evaluations at once

✅ **ACHIEVE**
- Evaluation endpoint that grades AI responses (relevance, faithfulness, hallucination)
- LLM-as-judge pattern working
- Can batch-evaluate multiple test cases

💡 **KEY IDEA:** LLM-as-judge = using a smart AI to grade a cheaper AI's answers. It's how companies evaluate AI quality at scale.

---

#### [ ] Day 24 — Pytest + Connect to Lunar

📖 **LEARN (30 min)**
- Read: [pytest getting started](https://docs.pytest.org/en/stable/getting-started.html) (30 min)

🔨 **BUILD (3 hours)**
- Install: `pip install pytest pytest-asyncio httpx`
- Write tests — `packages/eval-service/tests/test_api.py`:
  ```python
  from fastapi.testclient import TestClient
  from main import app
  
  client = TestClient(app)
  
  def test_health():
      response = client.get("/health")
      assert response.status_code == 200
      assert response.json()["status"] == "ok"
  
  def test_evaluate():
      response = client.post("/evaluate", json={
          "question": "What is the capital of France?",
          "ai_answer": "The capital of France is Paris.",
          "context": ["France is a country in Europe. Its capital is Paris."]
      })
      assert response.status_code == 200
      result = response.json()
      assert result["relevance"] > 0.5
      assert result["hallucination"] == False
  ```
- Run: `pytest -v`
- Connect eval-service to Lunar's Node.js gateway via HTTP:
  ```typescript
  // In your Node.js code — call the Python eval service
  const evalResult = await fetch('http://localhost:8000/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: userQuestion,
      ai_answer: agentResponse,
      context: retrievedChunks,
    }),
  }).then(r => r.json());
  ```

✅ **ACHIEVE**
- pytest tests passing
- Eval service callable from Node.js gateway
- Polyglot architecture: TypeScript gateway ↔ Python eval service

💡 **KEY IDEA:** You now have TWO languages in your project — TypeScript for the agent, Python for evaluation. This "polyglot" pattern is exactly what employers want to see.

---

#### [ ] Day 25 — Eval Dataset + Metrics Dashboard

📖 **LEARN (15 min)**
- Think about: what makes a good test case for an AI agent?

🔨 **BUILD (3 hours)**
- Create `packages/eval-service/test_cases.jsonl` — 20 eval test cases:
  ```jsonl
  {"question": "What is my name?", "expected_tools": ["memory_search"], "category": "memory"}
  {"question": "What time is it?", "expected_tools": ["get_current_datetime"], "category": "datetime"}
  {"question": "List files in /tmp", "expected_tools": ["bash"], "category": "filesystem"}
  {"question": "Remember that I like coffee", "expected_tools": ["memory_write"], "category": "memory"}
  {"question": "Explain quantum computing", "expected_tools": [], "category": "general"}
  ```
- Build a `/run-suite` endpoint that runs ALL test cases and returns aggregate metrics:
  ```python
  @app.post("/run-suite")
  async def run_suite() -> dict:
      test_cases = load_test_cases("test_cases.jsonl")
      results = []
      for tc in test_cases:
          result = await evaluate_single(tc)
          results.append(result)
      return {
          "total": len(results),
          "avg_relevance": mean([r.relevance for r in results]),
          "avg_faithfulness": mean([r.faithfulness for r in results]),
          "hallucination_rate": sum(1 for r in results if r.hallucination) / len(results),
      }
  ```
- Run the suite and document your first metrics!

✅ **ACHIEVE**
- 20+ evaluation test cases
- Batch evaluation running all tests
- First real metrics: "Relevance: 0.85, Faithfulness: 0.78, Hallucination: 12%"
- You have NUMBERS to talk about in interviews

💡 **KEY IDEA:** Numbers beat vibes. "My RAG achieves 85% relevance" is infinitely better than "my RAG works pretty well" in an interview.

---

### WEEK 5 CHECKPOINT ✅

```
What you should have:
├── ✅ Python environment set up
├── ✅ FastAPI eval service running
├── ✅ /evaluate endpoint (LLM-as-judge)
├── ✅ /run-suite endpoint (batch evaluation)
├── ✅ pytest tests passing
├── ✅ 20+ test cases in JSONL
├── ✅ First metrics documented
├── ✅ Node.js gateway can call Python eval service
└── ✅ You can write production Python (FastAPI, Pydantic, pytest)
```

---

### WEEK 6: 🔴 Docker + Containerization

> **Week Goal:** One command to run everything

---

#### [ ] Day 26 — Docker Basics + First Dockerfile

📖 **LEARN (1.5 hours)**
- Watch: [Fireship "Docker in 100 seconds"](https://www.youtube.com/watch?v=Gjnup-PuquQ) (2 min)
- Read: [Docker Getting Started — Part 1 & 2](https://docs.docker.com/get-started/) (45 min)
- Install Docker Desktop if not already installed

🔨 **BUILD (2 hours)**
- Create `Dockerfile` for Lunar gateway (Node.js):
  ```dockerfile
  FROM node:22-alpine
  WORKDIR /app
  RUN corepack enable
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  COPY packages/gateway/package.json packages/gateway/
  COPY packages/agent/package.json packages/agent/
  COPY packages/tools/package.json packages/tools/
  COPY packages/memory/package.json packages/memory/
  COPY packages/session/package.json packages/session/
  COPY packages/connectors/package.json packages/connectors/
  COPY packages/shared/package.json packages/shared/
  RUN pnpm install --frozen-lockfile
  COPY . .
  RUN pnpm build
  EXPOSE 18789
  CMD ["node", "packages/gateway/dist/index.js"]
  ```
- Build and test:
  ```bash
  docker build -t lunar-gateway .
  docker run -p 18789:18789 lunar-gateway
  ```
- Create `packages/eval-service/Dockerfile` (Python):
  ```dockerfile
  FROM python:3.12-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install -r requirements.txt
  COPY . .
  EXPOSE 8000
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

✅ **ACHIEVE**
- Two Dockerfiles: one for Node.js gateway, one for Python eval service
- Both images build successfully
- You understand: FROM, COPY, RUN, EXPOSE, CMD

💡 **KEY IDEA:** A Dockerfile is a recipe for building a portable box (container) with your app + all its dependencies inside. Works the same everywhere.

---

#### [ ] Day 27 — Docker Compose (Run Everything Together)

📖 **LEARN (30 min)**
- Read: [Docker Compose quickstart](https://docs.docker.com/compose/gettingstarted/) (30 min)

🔨 **BUILD (3 hours)**
- Create `docker-compose.yml`:
  ```yaml
  services:
    gateway:
      build: .
      ports:
        - "18789:18789"
      environment:
        - OLLAMA_HOST=http://ollama:11434
        - EVAL_SERVICE_URL=http://eval-service:8000
      volumes:
        - lunar-data:/root/.lunar
      depends_on:
        - ollama
  
    eval-service:
      build: ./packages/eval-service
      ports:
        - "8000:8000"
      environment:
        - OLLAMA_HOST=http://ollama:11434
  
    ollama:
      image: ollama/ollama
      ports:
        - "11434:11434"
      volumes:
        - ollama-models:/root/.ollama
  
  volumes:
    lunar-data:
    ollama-models:
  ```
- Run: `docker compose up`
- Pull model inside Ollama container: `docker exec -it lunar-ollama-1 ollama pull llama3.3`
- Test: everything should work together!

✅ **ACHIEVE**
- `docker compose up` starts entire Lunar system
- Three containers running: gateway + eval-service + ollama
- They communicate over Docker network

💡 **KEY IDEA:** Docker Compose = "start my entire system with one command." The services can talk to each other by name (gateway calls `http://ollama:11434`).

---

#### [ ] Day 28 — .dockerignore + Optimization + Volumes

🔨 **BUILD (3 hours)**
- Create `.dockerignore` (like .gitignore but for Docker):
  ```
  node_modules
  .git
  docs
  *.md
  .env
  ```
- Optimize: multi-stage build for smaller images:
  ```dockerfile
  # Stage 1: Build
  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY . .
  RUN corepack enable && pnpm install && pnpm build
  
  # Stage 2: Run (smaller image, no dev dependencies)
  FROM node:22-alpine
  WORKDIR /app
  COPY --from=builder /app/packages/gateway/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  CMD ["node", "dist/index.js"]
  ```
- Add persistent volumes for data that must survive container restarts:
  - `~/.lunar/` (config, sessions, memory)
  - `~/.ollama/` (downloaded models)
- Write `docs/docker-setup.md` — "Deploy Lunar in 2 minutes":
  ```markdown
  # Quick Start with Docker
  1. Clone the repo: `git clone https://github.com/you/lunar`
  2. Run: `docker compose up`
  3. Open: http://localhost:18789
  4. Done! Chat with Lunar.
  ```

✅ **ACHIEVE**
- Optimized Docker images (multi-stage builds)
- Data persists across container restarts
- "Deploy in 2 minutes" documentation

💡 **KEY IDEA:** Docker makes your project look professional. "Clone + docker compose up" is the gold standard for developer experience.

---

#### [ ] Day 29 — Docker Networking + Environment Variables

🔨 **BUILD (3 hours)**
- Move ALL configuration to environment variables:
  ```yaml
  # docker-compose.yml — add env vars
  gateway:
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - OLLAMA_HOST=http://ollama:11434
      - LOG_LEVEL=info
  ```
- Create `.env.example`:
  ```
  TELEGRAM_BOT_TOKEN=your-bot-token-here
  OLLAMA_HOST=http://localhost:11434
  ```
- Test environment configs:
  - Development: `docker compose up` (local Ollama)
  - Production: `docker compose -f docker-compose.prod.yml up` (cloud LLM)
- Add health checks in docker-compose:
  ```yaml
  gateway:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
  ```

✅ **ACHIEVE**
- Configuration via environment variables (.env file)
- Health checks for all containers
- Dev vs prod compose files

---

#### [ ] Day 30 — Docker Security + Week Wrap

🔨 **BUILD (2.5 hours)**
- Security best practices:
  - Run containers as non-root user
  - Don't store secrets in images
  - Pin image versions (`node:22.14-alpine` not `node:latest`)
- Add `docker compose logs -f` monitoring
- Final test: completely clean Docker environment → `docker compose up` → everything works
- Update README with Docker setup instructions

✅ **ACHIEVE**
- Secure Docker setup (non-root, no secrets in images)
- Complete `docker compose up` workflow tested from clean state

---

### WEEK 6 CHECKPOINT ✅

```
├── ✅ Dockerfile for gateway (Node.js, multi-stage)
├── ✅ Dockerfile for eval-service (Python)
├── ✅ docker-compose.yml (gateway + eval + ollama)
├── ✅ Persistent volumes for data
├── ✅ Environment-based configuration
├── ✅ Health checks
├── ✅ "Deploy in 2 minutes" docs
└── ✅ `docker compose up` starts EVERYTHING from zero
```

---

### WEEK 7: 🔴 Cloud Deployment

> **Week Goal:** Lunar running in the cloud with a public URL

---

#### [ ] Day 31 — AWS Account + ECR Setup

📖 **LEARN (1 hour)**
- Create free AWS account (if you don't have one)
- Read: [AWS Free Tier](https://aws.amazon.com/free/) — what's included
- Read: [ECR Getting Started](https://docs.aws.amazon.com/AmazonECR/latest/userguide/getting-started-cli.html)

🔨 **BUILD (2.5 hours)**
- Install AWS CLI: `brew install awscli` → `aws configure`
- Create ECR repository:
  ```bash
  aws ecr create-repository --repository-name lunar-gateway
  ```
- Push Docker image to ECR:
  ```bash
  aws ecr get-login-password | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
  docker tag lunar-gateway:latest <account-id>.dkr.ecr.<region>.amazonaws.com/lunar-gateway:latest
  docker push <account-id>.dkr.ecr.<region>.amazonaws.com/lunar-gateway:latest
  ```

✅ **ACHIEVE**
- AWS account active
- Docker image pushed to ECR (cloud container registry)

---

#### [ ] Day 32 — Deploy to ECS Fargate (OR Cloud Run)

📖 **LEARN (1 hour)**
- Read: [ECS Fargate Getting Started](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/getting-started-fargate.html)
- OR: [GCP Cloud Run quickstart](https://cloud.google.com/run/docs/quickstarts)

🔨 **BUILD (3 hours)**
- **Option A: AWS ECS Fargate**
  - Create ECS cluster
  - Create task definition (your Docker image + environment vars)
  - Create service (runs the task)
  - Verify: container is running in AWS

- **Option B: GCP Cloud Run (simpler)**
  ```bash
  gcloud run deploy lunar-gateway \
    --image gcr.io/your-project/lunar-gateway \
    --port 18789 \
    --allow-unauthenticated
  ```
  - Cloud Run gives you a public URL automatically

✅ **ACHIEVE**
- Lunar running in the cloud!
- Container accessible via cloud provider's URL

---

#### [ ] Day 33 — Monitoring + Logging

🔨 **BUILD (3 hours)**
- Set up CloudWatch (AWS) or Cloud Logging (GCP):
  - Application logs visible in cloud console
  - Set up alerts for errors
- Add structured logging to your gateway:
  ```typescript
  import pino from 'pino';
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  
  logger.info({ event: 'agent_turn', sessionId, tokens: response.tokens }, 'Turn completed');
  ```
- Set up basic metrics:
  - Request count
  - Response latency (P50, P95)
  - Error rate

✅ **ACHIEVE**
- Logs visible in cloud console
- Basic monitoring alerts configured

---

#### [ ] Day 34 — Webhook + Telegram Cloud Setup

🔨 **BUILD (3 hours)**
- Set up Cloudflare Tunnel for webhook ingress:
  ```bash
  cloudflared tunnel --url http://localhost:18789
  # Or if running in cloud: configure the cloud URL as Telegram webhook
  ```
- Configure Telegram webhook (instead of polling):
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-cloud-url.com/webhook/telegram"
  ```
- Test: send message on Telegram → cloud Lunar responds!
- This is the "party trick" moment: hand someone your phone, they message the bot, it works

✅ **ACHIEVE**
- Telegram bot running via cloud webhook (not local polling)
- Anyone in the world can message your AI on Telegram
- "Here, try talking to my AI" — works from any phone

---

#### [ ] Day 35 — Cloud Documentation + Cost Review

🔨 **BUILD (3 hours)**
- Document your cloud architecture:
  ```
  User (Telegram) → Telegram API → Cloud (ECS/Cloud Run) → Ollama (Groq fallback)
  ```
- Verify everything stays within free tier
- Create architecture diagram (draw.io or Mermaid)
- Write `docs/deployment.md`:
  - How to deploy from scratch
  - Cost breakdown ($0/month on free tier)
  - How to scale if needed

✅ **ACHIEVE**
- Complete cloud deployment documented
- Cloud architecture diagram
- Cost analysis ($0 or very low)

---

### WEEK 7 CHECKPOINT ✅

```
├── ✅ Docker images in cloud registry (ECR/GCR)
├── ✅ Lunar running on AWS ECS Fargate or GCP Cloud Run
├── ✅ Cloud monitoring and logging
├── ✅ Telegram working via cloud webhook
├── ✅ Deployment documentation
├── ✅ You can put "AWS" or "GCP" on your resume honestly
└── ✅ Anyone can message your AI from their phone
```

---

### WEEK 8: 🟡 MCP (Model Context Protocol)

> **Week Goal:** Make Lunar speak the standard AI tool protocol

---

#### [ ] Day 36 — Understand the MCP Specification

📖 **LEARN (2 hours)**
- Read: [MCP Introduction](https://modelcontextprotocol.io/introduction) (30 min)
- Read: [MCP Specification — Core Concepts](https://spec.modelcontextprotocol.io/) (30 min)
- Read: [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (30 min)
- Key concepts:
  - Server = exposes tools (your app provides capabilities)
  - Client = discovers and calls tools (your app uses external capabilities)
  - Transport = how they communicate (stdio, HTTP+SSE)

🔨 **BUILD (1.5 hours)**
- Install MCP SDK: `pnpm add @modelcontextprotocol/sdk`
- Create `packages/mcp/` package structure
- Stub out the MCP server and client files

✅ **ACHIEVE**
- You understand MCP: servers expose tools, clients discover and use them
- MCP SDK installed and package structure ready

💡 **KEY IDEA:** MCP is "REST for AI tools." Your agent can plug into any MCP-compatible tool (GitHub, Slack, databases) without custom integration code.

---

#### [ ] Day 37-38 — MCP Server (Expose Lunar's Tools)

🔨 **BUILD (6 hours over 2 days)**
- Build MCP server that exposes Lunar's tools:
  ```typescript
  import { Server } from '@modelcontextprotocol/sdk/server';
  
  const server = new Server({ name: 'lunar', version: '1.0.0' });
  
  // Register Lunar's tools as MCP tools
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      { name: 'memory_search', description: 'Search Lunar knowledge base', inputSchema: {...} },
      { name: 'memory_write', description: 'Save to Lunar memory', inputSchema: {...} },
      { name: 'bash', description: 'Execute shell command', inputSchema: {...} },
    ]
  }));
  
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    const result = await executeTool(name, args);
    return { content: [{ type: 'text', text: result }] };
  });
  ```
- Test: connect with Claude Desktop or another MCP client

✅ **ACHIEVE**
- Lunar's tools exposed as MCP server
- External AI systems can use Lunar's memory and tools

---

#### [ ] Day 39-40 — MCP Client (Use External Tools)

🔨 **BUILD (6 hours over 2 days)**
- Build MCP client that connects to external MCP servers:
  ```typescript
  import { Client } from '@modelcontextprotocol/sdk/client';
  
  // Connect to an external MCP server (e.g., GitHub)
  const client = new Client({ name: 'lunar-client', version: '1.0.0' });
  await client.connect(transport);
  
  // Discover available tools
  const tools = await client.listTools();
  // → [{ name: 'github_search', ... }, { name: 'github_create_issue', ... }]
  
  // Register these as tools in Lunar's agent
  for (const tool of tools) {
    registerTool(tool.name, tool.inputSchema, async (args) => {
      const result = await client.callTool(tool.name, args);
      return result.content[0].text;
    });
  }
  ```
- The magic: Lunar's agent now automatically discovers and uses external tools!
- Test with an example MCP server (filesystem, SQLite, or build a simple one)

✅ **ACHIEVE**
- Lunar connects to external MCP servers
- Auto-discovers and registers external tools
- Lunar is now both an MCP server AND client

---

### WEEK 8 CHECKPOINT ✅

```
├── ✅ MCP server: Lunar exposes tools via MCP protocol
├── ✅ MCP client: Lunar connects to external MCP servers
├── ✅ Auto-tool-discovery working
├── ✅ MCP is on your resume
└── ✅ You can explain MCP in interviews: "It's REST for AI tools"

🚀 MILESTONE: PHASE 2 COMPLETE — All critical gaps closed!
```

---

## PHASE 3: Differentiation (Weeks 9-14)

*From this point, each week follows the same daily pattern. I'll outline the key tasks per day more concisely since you now know the rhythm.*

---

### WEEK 9: Control UI + Streaming

#### [ ] Day 41 — Next.js + shadcn/ui Setup
- Init: `npx create-next-app packages/ui --typescript --tailwind --app`
- Install shadcn/ui: `npx shadcn@latest init`
- Create layout with sidebar: Dashboard, Chat, Sessions, Memory

#### [ ] Day 42 — Chat Interface
- Build `ChatWindow.tsx` + `MessageBubble.tsx`
- WebSocket connection to gateway
- Send message → get response → display

#### [ ] Day 43 — Streaming Responses in UI
- Implement SSE/WebSocket streaming from gateway to UI
- Tokens appear word-by-word in the chat bubble
- Add `ToolCallCard.tsx` — shows when AI calls a tool

#### [ ] Day 44 — Session Inspector + Memory Browser
- Sessions page: list all sessions, read transcripts
- Memory page: browse MEMORY.md, search memory, see daily logs
- Dashboard: agent status, token usage, active channels

#### [ ] Day 45 — Polish UI + Zustand State
- Global state with Zustand
- Loading states, error handling
- Responsive design
- Dark mode (shadcn makes this easy)

### WEEK 9 CHECKPOINT: Working web dashboard with real-time chat + streaming ✅

---

### WEEK 10: Evaluation Framework (Full)

#### [ ] Day 46 — RAGAS/DeepEval Integration (Python)
- `pip install ragas deepeval`
- Implement retrieval metrics: precision, recall, MRR, NDCG

#### [ ] Day 47 — Evaluation Dataset (50+ test cases)
- Generate test cases across all categories
- Include edge cases, safety tests, multi-tool scenarios

#### [ ] Day 48 — Run Full Benchmark Suite
- Run all 50+ cases → collect results
- Compute aggregate metrics
- Identify weak spots

#### [ ] Day 49 — Eval Dashboard in UI
- `/eval` page in Control UI
- Charts: relevance over time, per-category scores
- Before/after comparison when you improve prompts

#### [ ] Day 50 — Document Results + Blog Draft
- Write up benchmark results with charts
- Draft blog: "How I Evaluate My AI Agent"
- This becomes interview material

### WEEK 10 CHECKPOINT: Full evaluation pipeline with 50+ test cases and published metrics ✅

---

### WEEK 11: Safety + Guardrails + Structured Outputs

#### [ ] Day 51 — Prompt Injection Detection
- Build input filter that detects common injection patterns
- Test with known attacks: "ignore previous instructions", "you are now DAN"

#### [ ] Day 52 — Hallucination Detection
- After each RAG response, verify answer is grounded in retrieved context
- Flag responses with low faithfulness scores

#### [ ] Day 53 — Output Safety Filtering
- PII detection (don't leak personally identifiable info)
- Content safety checks

#### [ ] Day 54 — Structured Output with Zod
- Force AI to return valid JSON matching Zod schemas
- Auto-retry on invalid output
- Type-safe tool call parsing

#### [ ] Day 55 — Audit Logging + Configurable Guardrails
- Log all safety events
- Per-agent guardrail config
- Safety dashboard in Control UI

### WEEK 11 CHECKPOINT: Safety layer protecting all AI interactions ✅

---

### WEEK 12: Sub-Agents + LangGraph Comparison

#### [ ] Day 56 — Sub-Agent Architecture
- Implement `sessions_spawn` tool
- Child sessions with own transcripts

#### [ ] Day 57 — Sub-Agent Execution + Announce
- Background execution in child session
- Results announced back to parent

#### [ ] Day 58 — LangGraph Comparison Project (Python)
- Build same workflow in LangGraph: Research → Summarize → Report

#### [ ] Day 59 — Benchmark: Custom Engine vs LangGraph
- Compare performance, latency, code complexity
- Document trade-offs

#### [ ] Day 60 — Blog Draft: "Custom Agent Engine vs LangGraph"
- Why you built your own
- What you learned
- When to use frameworks vs custom

### WEEK 12 CHECKPOINT: Sub-agents working + framework comparison documented ✅

---

### WEEK 13: Fine-Tuning Experiment

#### [ ] Day 61 — Export Training Data
- Convert Lunar conversations to training format
- Clean data, remove PII

#### [ ] Day 62 — Fine-Tune with Unsloth (Google Colab)
- Open Colab, install Unsloth
- Fine-tune Qwen 2.5-7B with LoRA on your data

#### [ ] Day 63 — Evaluate Fine-Tuned Model
- Run same eval suite on fine-tuned vs base model
- Document: accuracy improvement, speed difference

#### [ ] Day 64 — Deploy Fine-Tuned Model to Ollama
- Export GGUF → load in Ollama → test in Lunar

#### [ ] Day 65 — Blog: "Fine-Tuning a Local AI Model"
- Write up the experience with before/after metrics

### WEEK 13 CHECKPOINT: Fine-tuned model deployed with comparison metrics ✅

---

### WEEK 14: Multimodal

#### [ ] Day 66 — Vision API
- VisionProvider interface, Ollama + Gemini vision

#### [ ] Day 67 — Image Understanding + OCR
- Vision tools, image analysis in agent loop

#### [ ] Day 68 — Audio STT + TTS
- Whisper/Gemini STT, Edge/Piper TTS, AudioManager

#### [ ] Day 69 — Image Generation
- Pollinations + ComfyUI providers, image gen tool

#### [ ] Day 70 — Multimodal Integration + Week 14 Wrap
- MultimodalRouter, channel adapters, Phase 3 wrap

### WEEK 14 CHECKPOINT: Full multimodal agent ✅

---

## PHASE 4: Portfolio & Job Hunt (Weeks 15-20)

---

### WEEK 15: Testing + CI/CD

#### [ ] Day 71 — Testing Strategy + Vitest
- AI testing pyramid, unit tests for guards, mock LLM integration tests

#### [ ] Day 72 — E2E Testing + CI
- TestClient, GitHub Actions workflow, quality gate

#### [ ] Day 73 — Performance Optimization
- LLM cache, parallel tools, connection pooling, streaming

#### [ ] Day 74 — Monitoring + Metrics
- MetricsCollector, instrumentation, health endpoint

#### [ ] Day 75 — Documentation + Week 15 Wrap
- README template, API reference, CONTRIBUTING.md

### WEEK 15 CHECKPOINT: Production-ready with tests + CI/CD ✅
- Remove dead code
- Consistent naming
- Good commit history

### WEEK 15 CHECKPOINT: Production-ready GitHub repo ✅

---

### WEEK 16: Deploy

#### [ ] Day 76 — Production Docker Setup
- Multi-stage Dockerfile, docker-compose.prod.yml, Caddy reverse proxy

#### [ ] Day 77 — Backup, Recovery + Scaling
- Automated backups, restore scripts, horizontal scaling options

#### [ ] Day 78 — VPS Deployment
- Deploy to VPS with Docker, configure domain + HTTPS

#### [ ] Day 79 — Security Hardening
- Zod config validation, rate limiting, CORS, helmet, API key auth

#### [ ] Day 80 — Deployment Checklist + Week 16 Wrap
- Full production readiness checklist

### WEEK 16 CHECKPOINT: Production deployment running ✅

---

### WEEK 17: Polish + UX

#### [ ] Day 81 — Conversation UX Patterns
- Typing indicators, smart follow-ups, message formatting

#### [ ] Day 82 — Personality + Branding
- System prompt design, tone of voice, welcome messages

#### [ ] Day 83 — Edge Cases + Resilience
- Input validation, flood control, request queuing, timeouts

#### [ ] Day 84 — Accessibility + Help System
- Help commands, ARIA labels, keyboard shortcuts

#### [ ] Day 85 — Week 17 Wrap
- Full UX audit checklist

### WEEK 17 CHECKPOINT: Polished user experience ✅

---

### WEEK 18: Launch

#### [ ] Day 86 — Beta Launch Strategy
- Tester recruitment, feedback collection, success metrics

#### [ ] Day 87 — Beta Monitoring + Triage
- Analytics dashboard, alerts, bug triage workflow

#### [ ] Day 88 — Iteration + Fixes
- Process feedback, fix top bugs, ship improvements

#### [ ] Day 89 — Public Launch Prep
- README polish, demo video, landing page, social posts

#### [ ] Day 90 — Launch Day!
- GitHub release v1.0.0, post everywhere, celebrate

### WEEK 18 CHECKPOINT: Public launch complete ✅

---

### WEEK 19: Portfolio

#### [ ] Day 91 — GitHub Profile + Showcase
- Profile README, pinned repos, commit history polish

#### [ ] Day 92 — Technical Blog Writing
- 3 blog posts: architecture, RAG deep-dive, learning journey

#### [ ] Day 93 — Demo Video + Presentation
- 5-min demo video, presentation slides for interviews

#### [ ] Day 94 — LinkedIn + Professional Presence
- AI Engineer positioning, networking strategy

#### [ ] Day 95 — Week 19 Wrap
- Portfolio completeness check, cross-linking

### WEEK 19 CHECKPOINT: Full portfolio ready ✅

---

### WEEK 20: Job Hunt

#### [ ] Day 96 — AI Engineer Resume
- 1-page resume with AI/ML skills, quantified metrics

#### [ ] Day 97 — Interview Prep
- RAG, agents, system design questions, STAR stories

#### [ ] Day 98 — Job Search Strategy
- Job boards, application tracker, cover letter template

#### [ ] Day 99 — Continuous Learning Plan
- Weekly routine, newsletters, communities, skills roadmap

#### [ ] Day 100 — 🎓 Graduation Day!
- Reflect, celebrate, plan what's next

### WEEK 20 CHECKPOINT: AI Engineer career launched ✅

---

## Progress Tracker

Copy this to track your daily progress:

```
PHASE 1: AI Foundations
Week 1:  [ ][ ][ ][ ][ ]  LLM Basics
Week 2:  [ ][ ][ ][ ][ ]  Tool Calling + Agent Loop
Week 3:  [ ][ ][ ][ ][ ]  RAG Pipeline + Memory
Week 4:  [ ][ ][ ][ ][ ]  Channels + Persistence

PHASE 2: Close Critical Gaps
Week 5:  [ ][ ][ ][ ][ ]  Python + Eval Service 🔴
Week 6:  [ ][ ][ ][ ][ ]  Docker 🔴
Week 7:  [ ][ ][ ][ ][ ]  Cloud Deployment 🔴
Week 8:  [ ][ ][ ][ ][ ]  MCP 🟡

PHASE 3: Differentiation
Week 9:  [ ][ ][ ][ ][ ]  Control UI + Streaming
Week 10: [ ][ ][ ][ ][ ]  Evaluation Framework
Week 11: [ ][ ][ ][ ][ ]  Safety + Guardrails
Week 12: [ ][ ][ ][ ][ ]  Sub-Agents + LangGraph
Week 13: [ ][ ][ ][ ][ ]  Fine-Tuning
Week 14: [ ][ ][ ][ ][ ]  Multi-Modal + Observability

PHASE 4: Launch + Job Hunt
Week 15: [ ][ ][ ][ ][ ]  Testing + CI/CD
Week 16: [ ][ ][ ][ ][ ]  Deploy
Week 17: [ ][ ][ ][ ][ ]  Polish + UX
Week 18: [ ][ ][ ][ ][ ]  Launch
Week 19: [ ][ ][ ][ ][ ]  Portfolio
Week 20: [ ][ ][ ][ ][ ]  Job Hunt

Total: ___/100 days completed
```

---

**Start with Day 1. Just Day 1. Install Ollama and say hello to your first AI.**

Then do Day 2. Then Day 3.

100 days from now, you'll be an AI Engineer. 🚀
