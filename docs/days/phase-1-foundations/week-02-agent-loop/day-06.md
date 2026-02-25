# Day 6 — Understanding Tool Calling

> 🎯 **DAY GOAL:** Understand how AI can DO things (not just talk) through tool calling

---

## 📚 CONCEPT 1: Tool Calling (Function Calling)

### WHAT — Simple Definition

**Tool calling = the AI tells YOUR code which function to run and with what arguments.**

The AI doesn't actually run any code. It just says: _"I think you should call `get_weather` with `{city: "Hanoi"}`."_ Then YOUR code runs the function and feeds the result back to the AI.

```
WITHOUT tools (chatbot — can only TALK):
  User: "What time is it?"
  AI: "I don't have access to the current time."  ← useless!

WITH tools (agent — can DO things):
  User: "What time is it?"
  AI: → calls tool: get_current_time()
  Your code runs it → returns "3:45 PM"
  AI: "It's currently 3:45 PM." ← actually useful!
```

### WHY — Why Is Tool Calling Important?

**It's the difference between a chatbot and an AI agent.**

| Chatbot (no tools) | Agent (with tools) |
|---|---|
| Can only generate text | Can take actions |
| "I don't have access to..." | Actually does the thing |
| Can't check real data | Reads files, calls APIs, queries databases |
| Basically fancy autocomplete | Actually useful assistant |

**Tool calling is what makes AI engineering valuable.** Anyone can build a chatbot. Agents that DO things = real value.

### WHEN — When Do You Use Tool Calling?

Any time the AI needs to:
- Access real-time data (time, weather, stock prices)
- Read/write files on disk
- Execute system commands
- Search a database or knowledge base
- Call external APIs (Slack, GitHub, email)
- Perform calculations (math, data analysis)

### HOW — How Tool Calling Works (Step by Step)

**The 5-step dance:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: YOU define available tools as JSON Schema        │
│                                                          │
│  tools: [{                                               │
│    name: "get_weather",                                  │
│    description: "Get current weather for a city",        │
│    parameters: {                                         │
│      city: { type: "string", description: "City name" }  │
│    }                                                     │
│  }]                                                      │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Send user message + tools list to AI             │
│                                                          │
│  chat({ messages: ["What's the weather in Hanoi?"],      │
│         tools: [...] })                                  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: AI DECIDES to call a tool (or just respond)      │
│                                                          │
│  AI response: {                                          │
│    tool_calls: [{                                        │
│      function: {                                         │
│        name: "get_weather",         ← which function     │
│        arguments: { city: "Hanoi" } ← with what args     │
│      }                                                   │
│    }]                                                    │
│  }                                                       │
│                                                          │
│  NOTE: The AI did NOT run the function!                   │
│  It just told you what to call.                          │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: YOUR CODE executes the function                  │
│                                                          │
│  const result = getWeather("Hanoi");                     │
│  // → "28°C, sunny"                                     │
│                                                          │
│  Send result back to AI as a 'tool' message:             │
│  messages.push({ role: 'tool', content: '28°C, sunny' })│
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Step 5: AI generates final response using the result     │
│                                                          │
│  "The weather in Hanoi is currently 28°C and sunny! ☀️"  │
│                                                          │
│  (AI used the tool result to give a real answer)         │
└─────────────────────────────────────────────────────────┘
```

**Critical insight:** The AI NEVER runs code. It just outputs structured JSON saying "I want to call this function." Your code does the actual execution. The AI is the brain, your code is the hands.

### 🔗 NODE.JS ANALOGY

Think of tool calling like an **Express middleware chain**:

```typescript
// In Express, middleware decides what to do:
app.post('/api', authMiddleware, validateMiddleware, handler);
// Each middleware decides: "should I handle this? or pass to next?"

// Tool calling is similar:
// The AI is like a smart router that decides which handler to call
// But instead of routes, it chooses TOOLS based on the user's intent

// Express:
app.get('/weather/:city',  weatherHandler);   // route → handler
app.get('/time',           timeHandler);       // route → handler

// Tool calling:
tools = [weather_tool, time_tool];
// AI decides: user asked about weather → call weather_tool
// AI decides: user asked about time   → call time_tool
// AI decides: user asked "hi"         → no tool, just respond
```

---

## 📚 CONCEPT 2: JSON Schema (How to Define a Tool)

### WHAT — Simple Definition

**JSON Schema = a way to describe the shape of JSON data.** Tools are defined using JSON Schema so the AI knows what arguments each tool accepts.

### WHY — Why JSON Schema?

The AI needs to know:
1. What tools exist (names + descriptions)
2. What parameters each tool takes (types + descriptions)
3. Which parameters are required vs optional

JSON Schema is the standard way to express this — used by OpenAI, Anthropic, Ollama, and all other providers.

### HOW — How to Write a Tool Definition

```typescript
// A tool definition has 3 parts: name, description, parameters

const getWeatherTool = {
  type: 'function',
  function: {
    // 1. NAME: what the AI calls to invoke this tool
    name: 'get_weather',

    // 2. DESCRIPTION: helps AI decide WHEN to use this tool
    //    (this is CRITICAL — bad description = AI picks wrong tool)
    description: 'Get the current weather for a city. Returns temperature and conditions.',

    // 3. PARAMETERS: what arguments the function takes
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city name, e.g., "Hanoi" or "Ho Chi Minh City"',
        },
        units: {
          type: 'string',
          description: 'Temperature units: "celsius" or "fahrenheit"',
          enum: ['celsius', 'fahrenheit'],  // restrict to these values
        },
      },
      required: ['city'],  // city is required, units is optional
    },
  },
};
```

**The description is EVERYTHING.** The AI reads the description to decide when to use the tool:

```
GOOD description: "Get the current weather for a city. Returns temperature and conditions."
→ AI knows: use this when user asks about weather

BAD description: "Weather function"
→ AI is confused: when should I use this? what does it return?
```

### 🔗 NODE.JS ANALOGY

JSON Schema for tools = Zod schemas for API validation:

```typescript
// Zod (you might know this):
const WeatherInput = z.object({
  city: z.string().describe('City name'),
  units: z.enum(['celsius', 'fahrenheit']).optional(),
});

// JSON Schema (same concept, different syntax):
{
  type: 'object',
  properties: {
    city: { type: 'string', description: 'City name' },
    units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
  },
  required: ['city'],
}

// Same purpose: describe the shape of expected data
// Zod validates at runtime in your code
// JSON Schema tells the AI what arguments to send
```

---

## 🔨 HANDS-ON: Create Your First Tools

### Step 1: Create Tool Types (10 minutes)

Create `packages/tools/package.json`:
```json
{
  "name": "@lunar/tools",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts"
}
```

Create `packages/tools/src/types.ts`:

```typescript
/**
 * Tool Definition — tells the AI what tools are available.
 * 
 * WHAT: A JSON Schema description of a function the AI can ask to call
 * WHY:  The AI reads this to decide WHICH tool to use and WHAT arguments to provide
 * 
 * Same format used by: OpenAI, Anthropic, Ollama, Groq, Gemini
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;  // ← MOST IMPORTANT! AI decides based on this
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

/**
 * Tool Result — what we send back to the AI after executing a tool.
 */
export interface ToolResult {
  name: string;
  result: string;
  success: boolean;
  durationMs?: number;
}
```

### Step 2: Build the DateTime Tool (10 minutes)

Create `packages/tools/src/datetime.ts`:

```typescript
import type { ToolDefinition } from './types.js';

/**
 * DateTime Tool — returns the current date and time.
 * 
 * WHAT: Tells the AI the current date/time (AI doesn't know this on its own!)
 * WHEN: User asks "what time is it?", "what's today's date?", etc.
 * WHY:  LLMs have no real-time awareness — they need tools for current info
 */
export const datetimeTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_current_datetime',
    description: 'Get the current date and time. Use this when the user asks about the current time, date, or day of the week.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "Asia/Ho_Chi_Minh", "UTC"). Defaults to system timezone.',
        },
      },
      required: [],  // no required params — timezone is optional
    },
  },
};

/**
 * Execute the datetime tool.
 * This is a plain function — nothing AI-related about the execution.
 */
export function executeDatetime(args: { timezone?: string }): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: args.timezone || undefined,
  };

  return new Date().toLocaleString('en-US', options);
}
```

### Step 3: Build a Calculator Tool (15 minutes)

Create `packages/tools/src/calculator.ts`:

```typescript
import type { ToolDefinition } from './types.js';

/**
 * Calculator Tool — performs math calculations.
 * 
 * WHAT: Runs mathematical expressions and returns the result
 * WHEN: User asks math questions ("what's 15% of 230?", "convert 5km to miles")
 * WHY:  LLMs are BAD at math! They predict text, not calculate numbers.
 *       2847 * 394 → LLM might get this wrong. Calculator always gets it right.
 */
export const calculatorTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Evaluate a mathematical expression. Use this for ANY math calculation. Returns the numeric result.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate, e.g., "2847 * 394" or "Math.sqrt(144)"',
        },
      },
      required: ['expression'],
    },
  },
};

/**
 * Execute the calculator.
 * Uses JavaScript's built-in eval — safe here because the AI only sends math expressions.
 * In production, you'd use a proper math parser like mathjs.
 */
export function executeCalculator(args: { expression: string }): string {
  try {
    // Basic safety: only allow math-related characters
    const sanitized = args.expression.replace(/[^0-9+\-*/().%\s,Math.sqrtpowabsceilfloorround]/g, '');
    const result = new Function(`return ${sanitized}`)();
    return `${args.expression} = ${result}`;
  } catch (error: any) {
    return `Error calculating "${args.expression}": ${error.message}`;
  }
}
```

### Step 4: Create the Tool Executor (15 minutes)

Create `packages/tools/src/executor.ts`:

```typescript
import type { ToolDefinition, ToolResult } from './types.js';
import { datetimeTool, executeDatetime } from './datetime.js';
import { calculatorTool, executeCalculator } from './calculator.js';

/**
 * Tool Executor — the central hub that dispatches tool calls to the right handler.
 * 
 * WHAT: Receives a tool name + arguments, runs the corresponding function, returns result
 * WHY:  Clean separation — AI decides WHAT to call, executor actually runs it
 * 
 * NODE.JS ANALOGY: Like an Express router that maps URLs to handlers:
 *   router.get('/weather', weatherHandler)
 *   router.get('/time', timeHandler)
 * 
 *   executor.register('get_weather', weatherHandler)
 *   executor.register('get_current_datetime', datetimeHandler)
 */

// Registry: all available tools
const tools: Map<string, {
  definition: ToolDefinition;
  execute: (args: any) => string | Promise<string>;
}> = new Map();

// Register built-in tools
tools.set('get_current_datetime', {
  definition: datetimeTool,
  execute: executeDatetime,
});

tools.set('calculate', {
  definition: calculatorTool,
  execute: executeCalculator,
});

/**
 * Get all tool definitions (to send to the AI)
 */
export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(tools.values()).map(t => t.definition);
}

/**
 * Execute a tool by name with given arguments.
 * 
 * @param name - Tool name (from AI's tool_call)
 * @param args - Arguments (from AI's tool_call)
 * @returns ToolResult with the execution result
 */
export async function executeTool(name: string, args: any): Promise<ToolResult> {
  const startTime = Date.now();
  const tool = tools.get(name);

  if (!tool) {
    return {
      name,
      result: `Unknown tool: "${name}". Available tools: ${Array.from(tools.keys()).join(', ')}`,
      success: false,
    };
  }

  try {
    const result = await tool.execute(args);
    return {
      name,
      result: typeof result === 'string' ? result : JSON.stringify(result),
      success: true,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      name,
      result: `Tool "${name}" failed: ${error.message}`,
      success: false,
      durationMs: Date.now() - startTime,
    };
  }
}
```

### Step 5: Test Tool Definitions (10 minutes)

Create a quick test file `packages/tools/src/test.ts`:

```typescript
import { getToolDefinitions, executeTool } from './executor.js';

async function test() {
  // List available tools
  console.log('Available tools:');
  for (const tool of getToolDefinitions()) {
    console.log(`  - ${tool.function.name}: ${tool.function.description}`);
  }

  // Test datetime tool
  console.log('\n--- Testing datetime ---');
  const dateResult = await executeTool('get_current_datetime', {});
  console.log(`Result: ${dateResult.result}`);

  // Test calculator tool
  console.log('\n--- Testing calculator ---');
  const calcResult = await executeTool('calculate', { expression: '2847 * 394' });
  console.log(`Result: ${calcResult.result}`);

  // Test unknown tool
  console.log('\n--- Testing unknown tool ---');
  const errorResult = await executeTool('nonexistent', {});
  console.log(`Result: ${errorResult.result}`);
}

test();
```

Run it:
```bash
npx tsx packages/tools/src/test.ts
```

Expected output:
```
Available tools:
  - get_current_datetime: Get the current date and time...
  - calculate: Evaluate a mathematical expression...

--- Testing datetime ---
Result: Monday, February 24, 2026, 03:45:00 PM

--- Testing calculator ---
Result: 2847 * 394 = 1,121,718

--- Testing unknown tool ---
Result: Unknown tool: "nonexistent". Available tools: get_current_datetime, calculate
```

---

## ✅ CHECKLIST

- [ ] Tool types defined (ToolDefinition, ToolResult) in `packages/tools/src/types.ts`
- [ ] DateTime tool created and tested
- [ ] Calculator tool created and tested
- [ ] Tool executor dispatches to the right handler
- [ ] You can explain the 5-step tool calling flow
- [ ] You understand: the AI NEVER runs code — it just asks you to run it

---

## 💡 KEY TAKEAWAY

**Tool calling is the bridge from chatbot to agent.** The AI says "call this function with these args" → your code executes → you feed the result back → the AI gives a real answer. The tool description is the most important part — it tells the AI when and how to use each tool.

---

## ❓ SELF-CHECK QUESTIONS

1. **Does the AI actually execute tool functions? Explain.**
   <details><summary>Answer</summary>No. The AI outputs structured JSON saying "I want to call function X with arguments Y." Your code reads that JSON, executes the actual function, and sends the result back as a `tool` message. The AI is the decision-maker, your code is the executor.</details>

2. **Why is the tool `description` field more important than the `name`?**
   <details><summary>Answer</summary>The AI reads the description to decide WHEN to use the tool. A good description like "Get the current weather for a city" tells the AI exactly when to use it. A bad description like "weather" gives the AI no guidance.</details>

3. **What happens if the AI calls a tool that doesn't exist in your executor?**
   <details><summary>Answer</summary>The executor returns an error result: "Unknown tool: X. Available tools: ...". The AI receives this error and can either try a different tool or tell the user it can't help.</details>

4. **Why does the calculator tool exist? Can't the AI just do math?**
   <details><summary>Answer</summary>LLMs are bad at math! They predict text patterns, not calculate numbers. "2847 * 394" — an LLM might guess wrong because it's pattern-matching, not computing. The calculator always gets the right answer.</details>

---

**Next → [Day 7: The Agent Loop (THE Most Important Pattern)](day-07.md)**
