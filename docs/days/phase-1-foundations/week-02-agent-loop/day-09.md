# Day 9 — Tool Approval + Error Handling

> 🎯 **DAY GOAL:** Make the agent safe and robust — approve dangerous tools, handle any error gracefully

---

## 📚 CONCEPT 1: Tool Approval System

### WHAT — Simple Definition

**A permission system that decides: should this tool call be allowed, need user confirmation, or be denied?** Like `sudo` on Linux — some operations need extra approval.

### WHY — Why Approve Some Tools?

```
Without approval:
  User: "Delete old logs"
  AI: 🔧 bash("rm -rf /var/log/*")  ← runs immediately, no questions asked 😱

With approval:
  User: "Delete old logs"
  AI: 🔧 bash("rm -rf /var/log/*")
  System: ⚠️ This command modifies your system. Allow? [y/N]
  User: n
  System: ❌ Tool call denied by user.
```

### WHEN — Which Tools Need Approval?

```
TIER 1 — AUTO-APPROVE (safe, read-only):
  ✅ get_current_datetime
  ✅ calculate
  ✅ read_file
  ✅ list_directory

TIER 2 — ASK USER (writes or modifies):
  ⚠️ write_file
  ⚠️ bash (if command modifies something)

TIER 3 — ALWAYS DENY (too dangerous):
  ❌ bash with sudo
  ❌ bash with rm -rf
  ❌ Any network request to unknown hosts
```

### HOW — Implementation Pattern

```typescript
type ApprovalPolicy = 'auto' | 'ask' | 'deny';

function getToolPolicy(toolName: string, args: any): ApprovalPolicy {
  // Tier 3: Always deny
  if (toolName === 'bash' && BLOCKED_PATTERNS.some(p => p.test(args.command))) {
    return 'deny';
  }

  // Tier 2: Ask user
  if (toolName === 'write_file' || toolName === 'bash') {
    return 'ask';
  }

  // Tier 1: Auto approve
  return 'auto';
}
```

### 🔗 NODE.JS ANALOGY

Tool approval = your Express.js middleware chain:

```
// Express middleware:
app.use(authMiddleware);     // Check: are you allowed?
app.use(rateLimiter);        // Check: too many requests?
app.get('/admin', adminOnly); // Check: right role?

// Tool approval middleware:
checkDenylist(tool)   → blocked? reject immediately
checkPolicy(tool)     → needs approval? ask user
executeWithTimeout()  → approved? run with safety
```

---

## 📚 CONCEPT 2: Error Handling in AI Agents

### WHAT — Simple Definition

**Making sure the agent doesn't crash when things go wrong.** Errors are normal in agents — a tool might fail, an API might timeout, a file might not exist. A good agent recovers gracefully.

### WHY — Why Is Error Handling Critical for Agents?

| Error Type | Without Handling | With Handling |
|---|---|---|
| Tool fails | Agent crashes | Agent tells user: "I couldn't read that file, it doesn't exist" |
| LLM returns no tool call | Infinite loop | Agent says: "I don't have a tool for that" |
| JSON parse fails | Crash | Agent retries or reports the issue |
| Timeout | Hangs forever | Agent reports: "That took too long, try again?" |
| Max iterations | Infinite loop | Agent stops: "I hit the maximum number of attempts" |

### WHEN — Where to Add Error Handling

```
Every boundary in your agent needs error handling:

  User Input → [validate]
      ↓
  LLM Call → [try/catch: API timeout, rate limit, bad response]
      ↓
  Parse Response → [try/catch: missing tool_calls, bad JSON in args]
      ↓
  Tool Execution → [try/catch: tool-specific errors]
      ↓
  Result → [validate: is result too long? truncate.]
      ↓
  Loop Control → [max iterations check]
```

### HOW — Error Recovery Strategies

```
Strategy 1: TELL THE AI
  When a tool fails, send the error back as a tool result.
  The AI is smart — it might try a different approach!

  bash("wrong_command") → Error: command not found
  AI: "Let me try a different command..."
  bash("correct_command") → Success!

Strategy 2: RETRY WITH BACKOFF
  For transient errors (network timeouts):
  Attempt 1: fail → wait 1s
  Attempt 2: fail → wait 2s
  Attempt 3: fail → give up, report error

Strategy 3: GRACEFUL DEGRADATION
  If the fancy approach fails, try a simpler one:
  Try: bash("jq '.name' package.json")  → jq not installed
  Fallback: read_file("package.json")   → parse JSON manually
```

### 🔗 NODE.JS ANALOGY

Same error patterns you use in Express.js:

```typescript
// Express error handler:
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Agent error handler:
try {
  result = await executeTool(name, args);
} catch (error) {
  // Don't crash — send error back to AI as a tool result
  result = `Error: ${error.message}`;
  // The AI will see this and adapt its approach
}
```

---

## 🔨 HANDS-ON: Build Approval + Error System

### Step 1: Approval System (25 minutes)

Create `packages/agent/src/approval.ts`:

```typescript
import readline from 'readline/promises';

export type ApprovalPolicy = 'auto' | 'ask' | 'deny';
export type ApprovalResult = 'approved' | 'denied';

// Dangerous patterns that are always denied
const DENY_PATTERNS = [
  /rm\s+(-[rf]+\s+)*(\/|~|\$HOME)/i,
  /sudo/i,
  /shutdown|reboot|halt/i,
  /mkfs|format/i,
];

// Tools that are always safe
const AUTO_APPROVE_TOOLS = new Set([
  'get_current_datetime',
  'calculate',
  'read_file',
  'list_directory',
]);

export function getPolicy(toolName: string, args: Record<string, any>): ApprovalPolicy {
  // Check deny patterns for bash
  if (toolName === 'bash' && args.command) {
    for (const pattern of DENY_PATTERNS) {
      if (pattern.test(args.command)) return 'deny';
    }
  }

  // Auto-approve safe tools
  if (AUTO_APPROVE_TOOLS.has(toolName)) return 'auto';

  // Everything else needs approval
  return 'ask';
}

export async function askUserApproval(
  toolName: string,
  args: Record<string, any>
): Promise<ApprovalResult> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n⚠️  APPROVAL NEEDED`);
  console.log(`   Tool: ${toolName}`);
  console.log(`   Args: ${JSON.stringify(args, null, 2)}`);

  const answer = await rl.question('   Allow? (y/N): ');
  rl.close();

  return answer.toLowerCase() === 'y' ? 'approved' : 'denied';
}
```

### Step 2: Robust Agent Runner (25 minutes)

Update `packages/agent/src/runner.ts`:

```typescript
import type { OllamaProvider } from './llm/ollama.js';
import { getToolDefinitions, executeTool } from '../../tools/src/executor.js';
import { getPolicy, askUserApproval } from './approval.js';

const MAX_ITERATIONS = 10;
const MAX_TOOL_OUTPUT = 3000;

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export async function runAgent(
  llm: OllamaProvider,
  userMessage: string,
  systemPrompt: string,
  history: Message[]
): Promise<{ reply: string; history: Message[] }> {
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // === LLM CALL WITH ERROR HANDLING ===
    let response;
    try {
      response = await llm.chat(messages, getToolDefinitions());
    } catch (error: any) {
      // LLM failed — return error message, don't crash
      return {
        reply: `⚠️ LLM error: ${error.message}. Please try again.`,
        history: [...messages.slice(1)], // remove system prompt
      };
    }

    // === NO TOOL CALLS — FINAL RESPONSE ===
    if (!response.tool_calls || response.tool_calls.length === 0) {
      messages.push({ role: 'assistant', content: response.content });
      return {
        reply: response.content,
        history: messages.slice(1), // remove system prompt
      };
    }

    // === TOOL CALLS — PROCESS EACH ONE ===
    messages.push({
      role: 'assistant',
      content: response.content || '',
      tool_calls: response.tool_calls,
    });

    for (const toolCall of response.tool_calls) {
      const { name } = toolCall.function;
      let args: Record<string, any>;

      // Parse args safely
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: 'Error: Could not parse tool arguments as JSON.',
        });
        continue;
      }

      // === CHECK APPROVAL ===
      const policy = getPolicy(name, args);

      if (policy === 'deny') {
        console.log(`  ❌ DENIED: ${name}(${JSON.stringify(args)})`);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `⛔ This action is blocked for safety. The command was not executed.`,
        });
        continue;
      }

      if (policy === 'ask') {
        const approval = await askUserApproval(name, args);
        if (approval === 'denied') {
          console.log(`  🚫 User denied: ${name}`);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `User denied this tool call. Try a different approach or ask what the user wants.`,
          });
          continue;
        }
      }

      // === EXECUTE WITH ERROR HANDLING ===
      console.log(`  🔧 ${name}(${JSON.stringify(args)})`);
      const result = await executeTool(name, args);

      // Truncate long results
      let output = result.result;
      if (output.length > MAX_TOOL_OUTPUT) {
        output = output.slice(0, MAX_TOOL_OUTPUT) + `\n...(truncated)`;
      }

      console.log(`  📎 ${result.success ? '✅' : '❌'} ${output.slice(0, 100)}...`);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: output,
      });
    }
  }

  // Max iterations reached
  return {
    reply: `⚠️ I reached the maximum number of steps (${MAX_ITERATIONS}). Here's what I was trying to do — could you simplify the request?`,
    history: messages.slice(1),
  };
}
```

### Step 3: Test Scenarios (15 minutes)

```
Test 1 — AUTO APPROVE:
  You: What time is it?
  → get_current_datetime → auto approved → shows time ✅

Test 2 — ASK APPROVAL:
  You: Create a file called test.txt with "hello"
  → write_file({"path":"test.txt","content":"hello"})
  → ⚠️ APPROVAL NEEDED — Allow? (y/N): y
  → File created ✅

Test 3 — DENY:
  You: Run sudo apt update
  → bash({"command":"sudo apt update"})
  → ❌ DENIED: blocked by safety system ✅

Test 4 — ERROR RECOVERY:
  You: Read the file nonexistent.txt
  → read_file({"path":"nonexistent.txt"})
  → "File not found: nonexistent.txt"
  → AI: "That file doesn't exist. Would you like me to check what files are available?" ✅

Test 5 — USER DENIES:
  You: Delete the build folder
  → bash({"command":"rm -rf build"})
  → ⚠️ APPROVAL NEEDED — Allow? (y/N): n
  → AI: "Okay, I won't delete the build folder." ✅
```

---

## ✅ CHECKLIST

- [ ] Approval system differentiates auto/ask/deny
- [ ] Dangerous commands are always denied
- [ ] User can approve or deny tool calls
- [ ] LLM errors don't crash the agent
- [ ] Tool errors are sent back to AI (not swallowed)
- [ ] Max iterations prevents infinite loops
- [ ] Long tool outputs are truncated

---

## 💡 KEY TAKEAWAY

**Safety + robustness = production quality.** Approval tiers protect users from dangerous operations. Error handling ensures the agent never crashes — it recovers or reports gracefully. These patterns distinguish toy demos from real AI applications.

---

## ❓ SELF-CHECK QUESTIONS

1. **Why send tool errors back to the AI instead of just catching them silently?**
   <details><summary>Answer</summary>Because the AI can adapt! If a file doesn't exist, the AI might try a different path, list the directory first, or ask the user. Swallowing errors means the AI has no information to recover from.</details>

2. **Why have MAX_ITERATIONS instead of letting the loop run forever?**
   <details><summary>Answer</summary>The AI might enter a cycle: call tool A → get error → call tool A again → get error → repeat. Max iterations is a circuit breaker that prevents infinite loops and unbounded API costs.</details>

3. **What's the difference between 'deny' and user saying 'no' to 'ask'?**
   <details><summary>Answer</summary>'Deny' means the code blocks it automatically — the user never sees it. 'Ask' means the user sees the request and decides. 'Deny' is for things that should NEVER run (like `rm -rf /`). 'Ask' is for things that are sometimes okay (like writing files).</details>

4. **Why truncate long tool outputs?**
   <details><summary>Answer</summary>LLMs have token limits. If a tool returns 50,000 characters (like `cat` on a large file), it would fill the context window, push out conversation history, and cost more tokens. Truncation keeps the context manageable.</details>

---

**Next → [Day 10: Polish + Architecture Alignment](day-10.md)**
