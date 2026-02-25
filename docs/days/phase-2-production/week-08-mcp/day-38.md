# Day 38 — MCP + Lunar Integration

> 🎯 **DAY GOAL:** Wire MCP into the Lunar agent engine — built-in tools + MCP tools presented unified to the LLM

---

## 📚 CONCEPT 1: Unified Tool Registry

### WHAT — Simple Definition

**The agent should see all tools (built-in AND MCP) identically. The LLM doesn't need to know where a tool comes from.**

```
AGENT ENGINE sees:
  ┌─────────────────────────────────────┐
  │  ALL TOOLS (unified list):          │
  │                                     │
  │  Built-in:                          │
  │    memory_search                    │
  │    memory_write                     │
  │    bash                             │
  │    readFile                         │
  │                                     │
  │  From MCP servers:                  │
  │    mcp_github_search_issues         │
  │    mcp_github_create_pr             │
  │    mcp_slack_send_message           │
  │    mcp_filesystem_read_file         │
  │                                     │
  │  LLM sees them all the same way!   │
  └─────────────────────────────────────┘
```

### HOW — Integration Architecture

```
Gateway startup:
  1. Load built-in tools (memory_search, bash, etc.)
  2. Load MCP config (mcp-config.json)
  3. Connect to each MCP server
  4. Get tool definitions from each server
  5. Merge all tools into one list
  6. Pass unified list to Agent Engine
  
Agent loop:
  1. LLM sees ALL tools (built-in + MCP)
  2. LLM chooses a tool to call
  3. If built-in → execute locally
  4. If MCP → route to MCP client → forward to server
  5. Return result to LLM
```

---

## 🔨 HANDS-ON: Integrate MCP into Gateway

### Step 1: Tool Router (25 minutes)

Create `packages/agent/src/tool-router.ts`:

```typescript
import type { MCPManager } from '@lunar/mcp';
import type { ToolDefinition, ToolResult } from '@lunar/shared';

type BuiltinExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;

/**
 * Routes tool calls to the correct handler:
 *   - Built-in tools → local executor functions
 *   - MCP tools → MCP client → MCP server
 */
export class ToolRouter {
  private builtinTools: Map<string, { def: ToolDefinition; exec: BuiltinExecutor }> = new Map();
  private mcpManager: MCPManager | null = null;
  private mcpTools: ToolDefinition[] = [];

  /** Register a built-in tool */
  registerBuiltin(def: ToolDefinition, executor: BuiltinExecutor): void {
    this.builtinTools.set(def.name, { def, exec: executor });
  }

  /** Set MCP manager and load its tools */
  async setMCPManager(manager: MCPManager): Promise<void> {
    this.mcpManager = manager;
    this.mcpTools = await manager.getAllTools();
  }

  /** Get all tool definitions (for sending to LLM) */
  getAllTools(): ToolDefinition[] {
    const builtinDefs = [...this.builtinTools.values()].map(t => t.def);
    return [...builtinDefs, ...this.mcpTools];
  }

  /** Execute a tool by name */
  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = Date.now();

    // Check built-in tools first
    const builtin = this.builtinTools.get(toolName);
    if (builtin) {
      return builtin.exec(args);
    }

    // Check MCP tools
    if (this.mcpManager && toolName.startsWith('mcp_')) {
      try {
        const result = await this.mcpManager.callTool(toolName, args);
        return {
          name: toolName,
          result,
          success: true,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          name: toolName,
          result: `MCP tool error: ${err instanceof Error ? err.message : String(err)}`,
          success: false,
          durationMs: Date.now() - start,
        };
      }
    }

    return {
      name: toolName,
      result: `Unknown tool: ${toolName}`,
      success: false,
      durationMs: Date.now() - start,
    };
  }
}
```

### Step 2: Update Gateway to Load MCP (20 minutes)

```typescript
// In packages/gateway/src/index.ts — update bootstrap

import { MCPManager } from '@lunar/mcp';
import { ToolRouter } from '@lunar/agent';

async function main() {
  console.log('🌙 Lunar Gateway starting...');

  // ... (store, memory, sessions setup as before) ...

  // Tool Router
  const router = new ToolRouter();

  // Register built-in tools
  router.registerBuiltin(memorySearchTool, createMemorySearchExecutor(store));
  router.registerBuiltin(memoryWriteTool, createMemoryWriteExecutor(store, memoryFiles, indexer));
  router.registerBuiltin(bashTool, executeBash);
  router.registerBuiltin(readFileTool, executeReadFile);

  // Connect MCP servers
  const mcpConfigPath = path.join(__dirname, '../../mcp-config.json');
  if (existsSync(mcpConfigPath)) {
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
    const enabledServers = mcpConfig.servers.filter((s: any) => s.enabled);
    
    if (enabledServers.length > 0) {
      console.log('  🔌 Connecting MCP servers...');
      const mcpManager = new MCPManager();
      await mcpManager.connectAll(enabledServers);
      await router.setMCPManager(mcpManager);
      console.log(`  ✅ MCP: ${enabledServers.length} servers connected`);
    }
  }

  // Agent engine with unified tool router
  const agent = createAgentEngine({
    llm: config.llm,
    router,  // ← unified tool router!
    sessions,
    store,
    systemPrompt: buildSystemPrompt(config),
  });

  // ... (rest of gateway setup) ...
}
```

### Step 3: Update Agent Engine (15 minutes)

```typescript
// In packages/agent/src/engine.ts — update tool execution

async function agentLoop(
  messages: Message[],
  router: ToolRouter,
): Promise<string> {
  // Get ALL tools (built-in + MCP)
  const allTools = router.getAllTools();

  while (true) {
    const response = await llm.chat(messages, allTools);

    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const call of response.toolCalls) {
        // Router handles dispatching to correct handler
        const result = await router.execute(call.name, call.arguments);
        
        messages.push({
          role: 'tool',
          content: result.result,
          tool_call_id: call.id,
        });
      }
      continue;
    }

    return response.content;
  }
}
```

### Step 4: Test End-to-End (15 minutes)

```bash
# Start with filesystem MCP server enabled
# In mcp-config.json, set filesystem to enabled: true

pnpm dev

# Test:
You: What files are in my workspace?
🔧 mcp_filesystem_list_directory({"path": "/home/lunar/.lunar/agents/main/workspace"})
📎 MEMORY.md, memory/

You: Search my memory for important dates
🔧 memory_search({"query": "important dates"})
📎 Found: [memory/2026-02-25.md] "Meeting at 3pm..."

# Both built-in AND MCP tools used seamlessly!
```

---

## ✅ CHECKLIST

- [ ] ToolRouter dispatches to built-in or MCP handlers
- [ ] MCP servers loaded from config on startup
- [ ] All tools (built-in + MCP) visible to LLM
- [ ] Agent can call MCP tools seamlessly
- [ ] Error handling for MCP failures
- [ ] Can add new MCP servers via config only (no code change)

---

## 💡 KEY TAKEAWAY

**The ToolRouter is the bridge — it presents a unified interface to the LLM regardless of where tools come from. Adding a new MCP server is config-only: edit mcp-config.json, restart. No code changes needed.**

---

**Next → [Day 39: Popular MCP Servers + Ecosystem](day-39.md)**
