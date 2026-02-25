# Day 8 — Real Tools: Bash + File System

> 🎯 **DAY GOAL:** Give the AI real powers — execute shell commands and read/write files

---

## 📚 CONCEPT 1: The Bash Tool (Shell Access)

### WHAT — Simple Definition

**A tool that lets the AI run terminal commands on your computer.** The AI says _"run `ls -la`"_ → your code runs it → result goes back to the AI.

### WHY — Why Give AI Shell Access?

| Without Bash Tool | With Bash Tool |
|---|---|
| "How many files?" → "I can't check." | "How many files?" → runs `ls | wc -l` → "12 files" |
| "Is my server running?" → "I don't know." | "Is my server running?" → runs `curl localhost:3000` → "Yes, it returns 200 OK" |
| "What Node version?" → guesses 18 | "What Node version?" → runs `node -v` → "v22.0.0" |

### WHEN — When to Use vs Not Use

- ✅ Read system info (`uname`, `df`, `ps`)
- ✅ File operations (`ls`, `cat`, `find`)
- ✅ Dev tasks (`git status`, `npm test`)
- ⚠️ Write operations (`mkdir`, `cp`) — need approval
- ❌ Destructive commands (`rm -rf`, `shutdown`) — need strict approval

### HOW — How to Make It Safe

**Never give AI unrestricted shell access.** Always add guardrails:

```
Safety layers:
  1. Timeout (10 seconds max — prevents hanging commands)
  2. Denylist (block: rm -rf, sudo, shutdown, reboot)
  3. Approval (dangerous commands need user confirmation)
  4. Working directory restriction (can't access /etc, /root)
```

### 🔗 NODE.JS ANALOGY

You already know `child_process.exec` — this is the same thing, just triggered by AI:

```typescript
// You've done this before:
exec('ls -la', (err, stdout) => console.log(stdout));

// Now the AI decides when to run it:
// AI: "I need to check the files" → calls bash tool
// Your code: exec('ls -la') → sends result back to AI
```

---

## 📚 CONCEPT 2: File System Tools

### WHAT — Simple Definition

Tools that let the AI **read, list, and write files.** Safer than bash because they're scoped to specific operations.

### WHY — Why Separate File Tools from Bash?

```
Bash tool: can run ANY command (powerful but dangerous)
File tools: can ONLY do file things (safer, more controlled)

SAFE:  readFile("readme.md")     → reads one file, nothing else
RISKY: bash("cat readme.md")     → could be bash("cat readme.md; rm -rf /")
```

Dedicated file tools = more controlled permissions = safer AI.

---

## 🔨 HANDS-ON: Build Real Tools

### Step 1: Bash Tool (20 minutes)

Create `packages/tools/src/bash.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from './types.js';

const execAsync = promisify(exec);

// Commands that should NEVER be allowed
const BLOCKED_PATTERNS = [
  /rm\s+(-[rf]+\s+)*(\/|~|\$HOME)/i,  // rm -rf / or ~
  /sudo/i,
  /shutdown|reboot|halt/i,
  /mkfs|format/i,
  />\s*\/dev\//i,  // writing to device files
  /:(){ :|:& };:/,  // fork bomb
];

export const bashTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'bash',
    description: 'Execute a shell command and return the output. Use for: listing files, checking system info, running dev tools (git, npm). Do NOT use for destructive operations.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "ls -la", "git status", "node -v")',
        },
      },
      required: ['command'],
    },
  },
};

export async function executeBash(args: { command: string }): Promise<string> {
  // Safety check: block dangerous commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(args.command)) {
      return `⛔ BLOCKED: Command "${args.command}" is not allowed for safety reasons.`;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(args.command, {
      timeout: 10_000,  // 10 second timeout
      maxBuffer: 1024 * 1024,  // 1MB output limit
      cwd: process.cwd(),  // run in current directory
    });

    const output = (stdout || stderr || '(no output)').trim();

    // If output is very long, truncate it
    if (output.length > 2000) {
      return output.slice(0, 2000) + '\n... (output truncated, showing first 2000 chars)';
    }
    return output;
  } catch (error: any) {
    if (error.killed) {
      return `⏰ Command timed out after 10 seconds: "${args.command}"`;
    }
    return `Error: ${error.message}`;
  }
}
```

### Step 2: File System Tools (20 minutes)

Create `packages/tools/src/filesystem.ts`:

```typescript
import { readFile, readdir, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ToolDefinition } from './types.js';

// === READ FILE ===

export const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the contents of a file. Use this to examine files the user asks about.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read (relative or absolute)',
        },
      },
      required: ['path'],
    },
  },
};

export async function executeReadFile(args: { path: string }): Promise<string> {
  try {
    if (!existsSync(args.path)) {
      return `File not found: ${args.path}`;
    }
    const content = await readFile(args.path, 'utf8');
    if (content.length > 5000) {
      return content.slice(0, 5000) + `\n... (file truncated, ${content.length} total chars)`;
    }
    return content;
  } catch (error: any) {
    return `Error reading file: ${error.message}`;
  }
}

// === LIST DIRECTORY ===

export const listDirTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_directory',
    description: 'List files and folders in a directory. Returns names with / suffix for folders.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)',
        },
      },
      required: [],
    },
  },
};

export async function executeListDir(args: { path?: string }): Promise<string> {
  try {
    const dirPath = args.path || '.';
    const entries = await readdir(dirPath, { withFileTypes: true });

    const items = entries.map(entry => {
      const suffix = entry.isDirectory() ? '/' : '';
      return `${entry.name}${suffix}`;
    });

    return items.join('\n') || '(empty directory)';
  } catch (error: any) {
    return `Error listing directory: ${error.message}`;
  }
}

// === WRITE FILE ===

export const writeFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist. Use ONLY when the user explicitly asks to create or modify a file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to write to',
        },
        content: {
          type: 'string',
          description: 'Content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
};

export async function executeWriteFile(args: { path: string; content: string }): Promise<string> {
  try {
    await writeFile(args.path, args.content, 'utf8');
    return `✅ Written to ${args.path} (${args.content.length} chars)`;
  } catch (error: any) {
    return `Error writing file: ${error.message}`;
  }
}
```

### Step 3: Register All Tools in Executor (10 minutes)

Update `packages/tools/src/executor.ts` to register the new tools:

```typescript
import type { ToolDefinition, ToolResult } from './types.js';
import { datetimeTool, executeDatetime } from './datetime.js';
import { calculatorTool, executeCalculator } from './calculator.js';
import { bashTool, executeBash } from './bash.js';
import { readFileTool, executeReadFile, listDirTool, executeListDir, writeFileTool, executeWriteFile } from './filesystem.js';

// All tools registry
const tools: Map<string, {
  definition: ToolDefinition;
  execute: (args: any) => string | Promise<string>;
}> = new Map();

// Register tools
tools.set('get_current_datetime', { definition: datetimeTool, execute: executeDatetime });
tools.set('calculate', { definition: calculatorTool, execute: executeCalculator });
tools.set('bash', { definition: bashTool, execute: executeBash });
tools.set('read_file', { definition: readFileTool, execute: executeReadFile });
tools.set('list_directory', { definition: listDirTool, execute: executeListDir });
tools.set('write_file', { definition: writeFileTool, execute: executeWriteFile });

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(tools.values()).map(t => t.definition);
}

export async function executeTool(name: string, args: any): Promise<ToolResult> {
  const start = Date.now();
  const tool = tools.get(name);

  if (!tool) {
    return { name, result: `Unknown tool: "${name}". Available: ${[...tools.keys()].join(', ')}`, success: false };
  }

  try {
    const result = await tool.execute(args);
    return { name, result: String(result), success: true, durationMs: Date.now() - start };
  } catch (error: any) {
    return { name, result: `Tool error: ${error.message}`, success: false, durationMs: Date.now() - start };
  }
}
```

### Step 4: Test the Full Agent (15 minutes)

```
You: How many TypeScript files are in the packages directory?
  🔧 Tool: bash({"command": "find packages -name '*.ts' | wc -l"})
  📎 Result: 8

Lunar: There are 8 TypeScript files in the packages directory.

You: Show me what's in packages/agent/src/
  🔧 Tool: list_directory({"path": "packages/agent/src"})
  📎 Result: cli.ts
             runner.ts
             llm/

Lunar: The packages/agent/src directory contains:
  - cli.ts — the CLI interface
  - runner.ts — the agent loop
  - llm/ — folder with LLM client code

You: Read the first 10 lines of my package.json
  🔧 Tool: read_file({"path": "package.json"})
  📎 Result: { "name": "lunar", ...

Lunar: Here's your package.json: [shows content]

You: What version of Node am I running?
  🔧 Tool: bash({"command": "node -v"})
  📎 Result: v22.0.0

Lunar: You're running Node.js v22.0.0
```

---

## ✅ CHECKLIST

- [ ] Bash tool executes shell commands and returns output
- [ ] Dangerous commands are blocked (test: ask AI to run `sudo rm -rf /`)
- [ ] File read tool works for any text file
- [ ] List directory tool shows files/folders
- [ ] Write file tool creates files (test: ask AI to create a test file)
- [ ] All 6 tools registered in the executor

---

## 💡 KEY TAKEAWAY

**Real tools = real utility.** With bash + file system tools, your AI can actually interact with your computer. Safety guardrails (blocked patterns, timeouts, user approval) are essential — AI + shell access is powerful but potentially dangerous.

---

## ❓ SELF-CHECK QUESTIONS

1. **Why block `rm -rf /` instead of just not mentioning it?**
   <details><summary>Answer</summary>Because the AI is unpredictable — it might decide to "clean up" by running destructive commands, even if you told it not to in the system prompt. A blocklist at the code level is a hard safety boundary, while system prompts are soft suggestions.</details>

2. **Why have separate `read_file` and `bash` tools? Can't `bash("cat file.txt")` do the same thing?**
   <details><summary>Answer</summary>Separate tools are safer and clearer. `read_file` can ONLY read files — no injection possible. `bash("cat x; rm -rf /")` could chain destructive commands. Dedicated tools = better security boundaries.</details>

3. **What happens if a bash command takes 30 seconds?**
   <details><summary>Answer</summary>The 10-second timeout kicks in. The command is killed and the tool returns "Command timed out after 10 seconds." This prevents hanging commands from blocking the agent forever.</details>

---

**Next → [Day 9: Tool Approval + Error Handling](day-09.md)**
