# Day 7 — The Agent Loop (THE Most Important Day)

> 🎯 **DAY GOAL:** Build the core AI agent pattern — the engine that powers ALL intelligent AI systems

---

## ⚠️ THIS IS THE MOST IMPORTANT DAY IN THE ENTIRE COURSE

Everything you've learned so far was preparation for today. The **agent loop** is:
- The core of ChatGPT, Claude, Gemini Agents
- The thing you'll build at any AI engineering job
- The foundation of Lunar's intelligence
- **~20 lines of code that make AI actually useful**

After today, you'll have a real AI agent — not a chatbot.

---

## 📚 CONCEPT 1: Chatbot vs Agent

### WHAT — Simple Definition

```
CHATBOT = AI that can only talk
  Input: text → Output: text
  "What's the weather?" → "I can't check the weather."

AGENT = AI that can think AND act
  Input: text → Thinks → Uses tools → Thinks again → Output: text
  "What's the weather?" → calls weather API → "It's 28°C in Hanoi!"
```

### WHY — Why Agents Are the Future

```
Job posting 2024: "ChatGPT chatbot for customer service"
Job posting 2026: "AI Agent that handles entire customer workflows"

Chatbots answer questions.
Agents SOLVE problems.

That's why "AI Agent Engineer" pays more than "chatbot developer."
```

### HOW — What Makes an Agent Different?

The agent has a **loop** — it keeps going until the task is done:

```
CHATBOT (one-shot):
  User → AI → Response → Done.

AGENT (loop):
  User → AI → "I need data" → Tool → Result → AI → "I need more data" 
       → Tool → Result → AI → "Now I can answer" → Response → Done.
```

The AI keeps calling tools and thinking until it has enough information to give a complete answer.

**Visual: The Agent Loop**
```
            ┌─────────────────────────────┐
            │     START: User Message      │
            └──────────────┬──────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Send messages to AI   │ ◄──────────────────────┐
              └────────────┬───────────┘                         │
                           │                                     │
                           ▼                                     │
              ┌────────────────────────┐                         │
              │  AI responds with:      │                        │
              │  • tool_calls? OR       │                        │
              │  • text response?       │                        │
              └─────┬──────────┬───────┘                         │
                    │          │                                  │
            ┌───────┘          └────────┐                        │
            ▼                           ▼                        │
  ┌──────────────────┐     ┌────────────────────┐               │
  │  Has tool_calls  │     │   No tool_calls    │               │
  │                  │     │   (just text)       │               │
  └────────┬─────────┘     └────────┬───────────┘               │
           │                        │                            │
           ▼                        ▼                            │
  ┌──────────────────┐     ┌────────────────────┐               │
  │  Execute each    │     │   RETURN response  │               │
  │  tool call       │     │   to user          │               │
  │                  │     │   ── DONE ──       │               │
  └────────┬─────────┘     └────────────────────┘               │
           │                                                     │
           ▼                                                     │
  ┌──────────────────┐                                           │
  │  Add tool results │                                          │
  │  to messages      │──────────────────────────────────────────┘
  │  (loop back!)     │
  └──────────────────┘
```

### 🔗 NODE.JS ANALOGY

The agent loop is like an **event loop with middleware**:

```typescript
// Node.js event loop:
while (true) {
  const event = getNextEvent();    // wait for something to happen
  const result = process(event);   // handle it
  if (result.done) break;          // stop when done
}

// Agent loop:
while (true) {
  const response = await llm.chat(messages);     // ask AI
  if (!response.tool_calls) return response.text; // done? return answer
  
  for (const call of response.tool_calls) {
    const result = await executeTool(call);        // run the tool
    messages.push({ role: 'tool', content: result }); // add result
  }
  // loop back → AI sees the tool results → decides next step
}
```

Same pattern. `while(true)` + check exit condition + do work + repeat.

---

## 📚 CONCEPT 2: Multi-Turn Tool Calling

### WHAT — Simple Definition

**The AI can call multiple tools in sequence**, using the result of one to decide what to do next.

### WHY — Why Multiple Tool Calls?

Real tasks require multiple steps:

```
User: "What time is it in Hanoi, and calculate how many hours until midnight?"

Step 1: AI calls get_current_datetime({ timezone: "Asia/Ho_Chi_Minh" })
        → Result: "3:45 PM"

Step 2: AI calls calculate({ expression: "24 - 15.75" })
        → Result: "8.25"

Step 3: AI responds: "It's 3:45 PM in Hanoi. There are about 8 hours and 15 minutes until midnight."
```

The AI used **two tools** and **combined their results** into one natural response.

### HOW — How Messages Look During Multi-Turn

```typescript
// The messages array grows throughout the agent loop:

[
  // Initial messages
  { role: 'system', content: 'You are Lunar...' },
  { role: 'user', content: 'What time is it? Also calculate 2+2' },

  // AI's first response (wants to call tools)
  { role: 'assistant', content: '', tool_calls: [
    { function: { name: 'get_current_datetime', arguments: '{}' } },
    { function: { name: 'calculate', arguments: '{"expression":"2+2"}' } },
  ]},

  // Tool results (YOUR code executed these)
  { role: 'tool', content: 'Monday, February 24, 2026, 3:45 PM' },
  { role: 'tool', content: '2+2 = 4' },

  // AI's final response (uses tool results to answer)
  { role: 'assistant', content: "It's 3:45 PM on Monday, and 2+2 = 4!" },
]
```

---

## 🔨 HANDS-ON: Build the Agent Loop

### Step 1: Create the Agent Runner (30 minutes)

This is the most important file in Lunar. Create `packages/agent/src/runner.ts`:

```typescript
/**
 * ═══════════════════════════════════════════════════════
 *  THE AGENT LOOP — The Core of AI Engineering
 * ═══════════════════════════════════════════════════════
 * 
 * WHAT: A while loop that makes the AI think, use tools, and respond
 * WHY:  This turns a chatbot into an agent that can DO things
 * HOW:  
 *   1. Send messages to AI
 *   2. If AI wants tools → execute them → add results → loop back
 *   3. If AI has text → return it (done!)
 * 
 * This ~30-line function is the same pattern used by:
 * - ChatGPT (OpenAI)
 * - Claude (Anthropic) 
 * - Every AI agent framework (LangChain, CrewAI, etc.)
 */

import { ollama } from './llm/client.js';
import type { Message, ChatOptions } from './llm/types.js';
import { getToolDefinitions, executeTool } from '../../tools/src/executor.js';

/** Maximum number of tool-calling turns to prevent infinite loops */
const MAX_ITERATIONS = 10;

export interface AgentResult {
  response: string;         // final text response
  toolCalls: ToolCallLog[]; // what tools were used
  turns: number;            // how many turns the loop ran
}

export interface ToolCallLog {
  tool: string;
  args: any;
  result: string;
  durationMs?: number;
}

/**
 * Run the agent loop.
 * 
 * @param messages - Conversation history (including system prompt + user message)
 * @param options - LLM options (model, temperature)
 * @returns AgentResult with the final response and tool call log
 */
export async function runAgent(
  messages: Message[],
  options?: ChatOptions,
): Promise<AgentResult> {
  const toolCallLog: ToolCallLog[] = [];
  const tools = getToolDefinitions();
  let turns = 0;

  // ═══════════════════════════════════════
  //  THE LOOP — keep going until AI is done
  // ═══════════════════════════════════════
  while (turns < MAX_ITERATIONS) {
    turns++;

    // Step 1: Send everything to the AI
    const response = await ollama.chat({
      model: options?.model ?? 'llama3.2',
      messages,
      tools,  // ← tell AI what tools are available
      options: {
        temperature: options?.temperature ?? 0.7,
      },
    });

    // Step 2: Check — does the AI want to call tools?
    const toolCalls = response.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // ──── NO TOOL CALLS → AI is done, return the text response ────
      return {
        response: response.message.content,
        toolCalls: toolCallLog,
        turns,
      };
    }

    // ──── YES TOOL CALLS → Execute each tool ────

    // Save AI's decision (the tool_calls) in message history
    messages.push(response.message as any);

    for (const call of toolCalls) {
      const toolName = call.function.name;
      const toolArgs = call.function.arguments;

      // Log what's happening (visible in CLI)
      console.log(`  🔧 Tool: ${toolName}(${JSON.stringify(toolArgs)})`);

      // Execute the tool
      const result = await executeTool(toolName, toolArgs);

      // Log what's happening
      console.log(`  📎 Result: ${result.result.slice(0, 100)}${result.result.length > 100 ? '...' : ''}`);

      // Record in tool call log
      toolCallLog.push({
        tool: toolName,
        args: toolArgs,
        result: result.result,
        durationMs: result.durationMs,
      });

      // Add tool result to messages so AI can see it
      messages.push({
        role: 'tool',
        content: result.result,
      });
    }

    // Loop back to Step 1 → AI now sees the tool results
    // and decides: call more tools? or respond with text?
  }

  // Safety: if we hit max iterations, return what we have
  return {
    response: 'I seem to be stuck in a loop. Let me stop here.',
    toolCalls: toolCallLog,
    turns,
  };
}
```

### Step 2: Wire Agent to CLI (15 minutes)

Update `packages/agent/src/cli.ts` to use the agent loop:

```typescript
import * as readline from 'readline';
import type { Message } from './llm/types.js';
import { runAgent } from './runner.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Conversation history
const messages: Message[] = [
  {
    role: 'system',
    content: `You are Lunar, a helpful personal AI assistant.

You have access to tools. Use them when appropriate:
- get_current_datetime: for time/date questions
- calculate: for ANY math (never do math in your head!)

If the user asks for something you can't do, say so honestly.
Be concise and friendly.`,
  },
];

async function chat(userInput: string): Promise<void> {
  messages.push({ role: 'user', content: userInput });

  const result = await runAgent(messages, { temperature: 0.7 });

  // Add assistant response to history
  messages.push({ role: 'assistant', content: result.response });

  console.log(`\nLunar: ${result.response}`);

  // Show stats
  if (result.toolCalls.length > 0) {
    console.log(`  ⚡ ${result.toolCalls.length} tool call(s) in ${result.turns} turn(s)`);
  }
  console.log('');
}

function ask(): void {
  rl.question('You: ', async (input) => {
    if (!input.trim()) { ask(); return; }
    if (input.toLowerCase() === 'exit') { rl.close(); return; }

    try {
      await chat(input);
    } catch (err: any) {
      console.error(`❌ ${err.message}\n`);
    }
    ask();
  });
}

console.log('╔═════════════════════════════════════════╗');
console.log('║  🌙 Lunar AI Agent — v0.2 (with tools)  ║');
console.log('║  I can check the time and do math!      ║');
console.log('╚═════════════════════════════════════════╝\n');

ask();
```

### Step 3: Test the Agent! (15 minutes)

```bash
npx tsx packages/agent/src/cli.ts
```

**Test 1: Simple question (no tool needed)**
```
You: What is TypeScript?
Lunar: TypeScript is a typed superset of JavaScript...
```
→ AI answered directly, no tools used.

**Test 2: Time question (tool needed)**
```
You: What time is it right now?
  🔧 Tool: get_current_datetime({})
  📎 Result: Monday, February 24, 2026, 03:45:00 PM

Lunar: It's currently 3:45 PM on Monday, February 24, 2026.
  ⚡ 1 tool call(s) in 2 turn(s)
```
→ AI recognized it needed a tool, called it, and used the result!

**Test 3: Math (tool needed)**
```
You: What is 2847 multiplied by 394?
  🔧 Tool: calculate({"expression":"2847 * 394"})
  📎 Result: 2847 * 394 = 1121718

Lunar: 2847 × 394 = 1,121,718
  ⚡ 1 tool call(s) in 2 turn(s)
```
→ AI used the calculator instead of guessing!

**Test 4: Multiple tools in one question**
```
You: What time is it, and what's 15% of 230?
  🔧 Tool: get_current_datetime({})
  📎 Result: Monday, February 24, 2026, 03:46:00 PM
  🔧 Tool: calculate({"expression":"230 * 0.15"})
  📎 Result: 230 * 0.15 = 34.5

Lunar: It's 3:46 PM, and 15% of 230 is 34.50.
  ⚡ 2 tool call(s) in 2 turn(s)
```
→ AI called TWO tools and combined both results!

**Test 5: Mixed (some need tools, some don't)**
```
You: Hi! What's 100 divided by 7? And explain what REST means.
  🔧 Tool: calculate({"expression":"100/7"})
  📎 Result: 100/7 = 14.285714285714286

Lunar: Hello! 100 ÷ 7 = approximately 14.29.

REST stands for Representational State Transfer. It's an architectural
style for designing APIs...
  ⚡ 1 tool call(s) in 2 turn(s)
```
→ AI used a tool for math but answered the REST question from its knowledge!

---

## ✅ CHECKLIST

- [ ] `packages/agent/src/runner.ts` contains the agent loop
- [ ] Agent calls `get_current_datetime` when asked about time
- [ ] Agent calls `calculate` when asked math questions
- [ ] Agent can use multiple tools in one turn
- [ ] Agent responds directly without tools for general questions
- [ ] Max iterations (10) prevents infinite loops
- [ ] Tool calls are logged in the console

---

## 💡 KEY TAKEAWAY

**The agent loop is a `while(true)` that sends messages to AI, checks if it wants tools, executes them, feeds results back, and repeats until the AI responds with text.** This ~20 lines of code is the core of AI engineering. Everything else (RAG, channels, memory, UI) plugs into this loop.

---

## ❓ SELF-CHECK QUESTIONS

1. **In plain English, describe the agent loop in 3 steps.**
   <details><summary>Answer</summary>1. Send messages to AI. 2. If AI wants tools → execute them, add results to messages, go back to step 1. 3. If AI responds with text → return it (done).</details>

2. **Why do we need `MAX_ITERATIONS`?**
   <details><summary>Answer</summary>Safety valve. If the AI keeps calling tools endlessly (a bug, or a confusing situation), MAX_ITERATIONS stops it after 10 rounds instead of looping forever.</details>

3. **After the AI calls `get_current_datetime`, what role do we use for the result message?**
   <details><summary>Answer</summary>`role: 'tool'`. This tells the AI "this is a tool execution result" not a user message or another AI response.</details>

4. **If the user asks "What's your name?", will the agent call any tools?**
   <details><summary>Answer</summary>No. The AI can answer this from its system prompt knowledge — it doesn't need a tool. The AI only calls tools when it decides it NEEDS external data or computation.</details>

5. **Can the AI call tools that you didn't register in the executor?**
   <details><summary>Answer</summary>The AI might TRY to call a tool that doesn't exist (hallucination). Your executor should handle this gracefully — return "Unknown tool: X" and the AI will adapt. That's why error handling in the executor matters.</details>

---

**Next → [Day 8: Real Tools (Bash + File System)](day-08.md)**
