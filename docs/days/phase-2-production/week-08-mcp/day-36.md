# Day 36 — MCP: Model Context Protocol

> 🎯 **DAY GOAL:** Understand MCP — the universal standard for connecting AI agents to external tools and data sources

---

## 📚 CONCEPT 1: What is MCP?

### WHAT — Simple Definition

**MCP (Model Context Protocol) is a standard way for AI agents to connect to external tools and data. Think of it as USB for AI — any MCP server works with any MCP client.**

```
WITHOUT MCP (custom integration per tool):
  Lunar → custom code → GitHub API
  Lunar → custom code → Slack API
  Lunar → custom code → Database
  Lunar → custom code → File system
  (4 different integrations to maintain!)

WITH MCP (universal protocol):
  Lunar (MCP Client) → MCP Protocol → GitHub MCP Server
                     → MCP Protocol → Slack MCP Server
                     → MCP Protocol → Database MCP Server
                     → MCP Protocol → File System MCP Server
  (1 protocol, plug in any server!)
```

### WHY — Why MCP Matters

```
Before MCP (2024):
  ❌ Every AI tool built custom integrations
  ❌ LangChain tools ≠ AutoGPT tools ≠ Claude tools
  ❌ No standard → vendor lock-in
  ❌ Can't share tool implementations between frameworks

After MCP (2024+):
  ✅ One standard protocol (created by Anthropic, open source)
  ✅ Write a tool ONCE, use it everywhere
  ✅ Claude Desktop, VS Code Copilot, Cursor all support MCP
  ✅ Growing ecosystem of MCP servers
  ✅ Lunar supports MCP → can use ANY MCP tool!

Industry adoption:
  → Anthropic (Claude) — creator of MCP
  → OpenAI — compatible tooling
  → Google DeepMind — adopting
  → Microsoft (Copilot, VS Code) — supporting
  → All major AI frameworks adding MCP support
```

### WHEN — Where MCP Fits in Lunar

```
LUNAR'S TOOL SYSTEM:
  ┌──────────────────────────────────────────────┐
  │  Agent Engine                                 │
  │  ├── Built-in Tools                          │
  │  │   ├── memory_search (custom)              │
  │  │   ├── memory_write (custom)               │
  │  │   ├── bash (custom)                       │
  │  │   └── readFile (custom)                   │
  │  │                                           │
  │  └── MCP Tools (universal!)         ← NEW   │
  │      ├── @mcp/github (issues, PRs, repos)    │
  │      ├── @mcp/slack (messages, channels)     │
  │      ├── @mcp/postgres (query database)      │
  │      └── Any MCP server...                   │
  └──────────────────────────────────────────────┘
```

### 🔗 NODE.JS ANALOGY

```
MCP = HTTP for AI tools

HTTP Protocol:
  → Any HTTP client can talk to any HTTP server
  → Browser → HTTP → Express/Fastify/Django
  → curl → HTTP → Any web API
  → Standard request/response format

MCP Protocol:
  → Any MCP client can use any MCP server
  → Lunar → MCP → GitHub/Slack/Database
  → Claude → MCP → Same servers!
  → Standard tool/resource/prompt format
```

---

## 📚 CONCEPT 2: MCP Architecture

### HOW — The Protocol Structure

```
MCP CLIENT (your agent)                MCP SERVER (tool provider)
  ┌───────────────┐                     ┌───────────────┐
  │  Lunar Agent  │                     │  GitHub MCP   │
  │               │ ──── initialize ──► │  Server       │
  │               │ ◄─── capabilities ─ │               │
  │               │                     │               │
  │  "list tools" │ ──── tools/list ──► │               │
  │               │ ◄─── tool defs ──── │  Tools:       │
  │               │                     │  - search     │
  │  "call tool"  │ ──── tools/call ──► │  - create_pr  │
  │               │ ◄─── result ─────── │  - list_issues│
  │               │                     │               │
  │  "resources"  │ ──── resources ───► │  Resources:   │
  │               │ ◄─── file list ──── │  - repo files │
  └───────────────┘                     └───────────────┘

TRANSPORT: stdio (local) or HTTP+SSE (remote)
FORMAT: JSON-RPC 2.0
```

### MCP Primitives (3 things MCP provides):

```
1. TOOLS — Functions the AI can call
   → search_issues(query: string)
   → create_pr(title, body, branch)
   → Same concept as our custom tools!

2. RESOURCES — Data the AI can read
   → file://repo/README.md
   → db://users/profile
   → Like RAG context, but standardized

3. PROMPTS — Reusable prompt templates
   → "Summarize this PR"
   → "Review this code"
   → Pre-built instructions the user can select
```

---

## 🔨 HANDS-ON: Use Existing MCP Servers

### Step 1: Install MCP SDK (10 minutes)

```bash
cd ~/Documents/project/lunar
pnpm add @modelcontextprotocol/sdk
```

### Step 2: Create MCP Client (30 minutes)

Create `packages/mcp/src/client.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolDefinition } from '@lunar/shared';

/**
 * MCP Client — connects to MCP servers and exposes their tools
 * to the Lunar agent engine.
 */
export class MCPClient {
  private client: Client;
  private serverName: string;
  private connected = false;

  constructor(serverName: string) {
    this.serverName = serverName;
    this.client = new Client({
      name: 'lunar-agent',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
  }

  /** Connect to MCP server via stdio */
  async connect(command: string, args: string[] = [], env?: Record<string, string>): Promise<void> {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env },
    });

    await this.client.connect(transport);
    this.connected = true;
    console.log(`  🔌 MCP connected: ${this.serverName}`);
  }

  /** Get tools from MCP server as Lunar ToolDefinitions */
  async getTools(): Promise<ToolDefinition[]> {
    if (!this.connected) throw new Error('Not connected');

    const result = await this.client.listTools();
    
    return result.tools.map(tool => ({
      name: `mcp_${this.serverName}_${tool.name}`,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: tool.inputSchema as Record<string, unknown>,
      source: 'mcp',
      server: this.serverName,
    }));
  }

  /** Call an MCP tool */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.connected) throw new Error('Not connected');

    // Strip the mcp_servername_ prefix
    const mcpToolName = toolName.replace(`mcp_${this.serverName}_`, '');

    const result = await this.client.callTool({
      name: mcpToolName,
      arguments: args,
    });

    // Extract text content from result
    const textContent = result.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    return textContent || JSON.stringify(result.content);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this.connected = false;
  }
}
```

### Step 3: MCP Server Manager (20 minutes)

Create `packages/mcp/src/manager.ts`:

```typescript
import { MCPClient } from './client.js';
import type { ToolDefinition } from '@lunar/shared';

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Manages multiple MCP server connections.
 * Loads config, connects, and provides unified tool list.
 */
export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();

  async connectServer(config: MCPServerConfig): Promise<void> {
    const client = new MCPClient(config.name);
    await client.connect(config.command, config.args || [], config.env);
    this.clients.set(config.name, client);
  }

  async connectAll(configs: MCPServerConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        await this.connectServer(config);
      } catch (err) {
        console.warn(`  ⚠️ Failed to connect MCP server: ${config.name}`, err);
      }
    }
  }

  /** Get all tools from all connected MCP servers */
  async getAllTools(): Promise<ToolDefinition[]> {
    const allTools: ToolDefinition[] = [];
    for (const [name, client] of this.clients) {
      try {
        const tools = await client.getTools();
        allTools.push(...tools);
        console.log(`    ${name}: ${tools.length} tools`);
      } catch (err) {
        console.warn(`  ⚠️ Failed to list tools from ${name}`, err);
      }
    }
    return allTools;
  }

  /** Call a tool (routes to correct MCP server) */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    for (const [name, client] of this.clients) {
      if (toolName.startsWith(`mcp_${name}_`)) {
        return client.callTool(toolName, args);
      }
    }
    throw new Error(`No MCP server found for tool: ${toolName}`);
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}
```

### Step 4: Configure MCP Servers (10 minutes)

Create `mcp-config.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/lunar/.lunar"],
      "enabled": true
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" },
      "enabled": false
    }
  ]
}
```

---

## ✅ CHECKLIST

- [ ] Understand MCP = USB for AI tools
- [ ] Know 3 MCP primitives: Tools, Resources, Prompts
- [ ] MCP Client connects to servers via stdio
- [ ] MCP Manager handles multiple servers
- [ ] Tools from MCP servers appear as Lunar tools
- [ ] Can call MCP tools through the agent

---

## 💡 KEY TAKEAWAY

**MCP makes your AI agent extensible without custom code. Write the MCP client once, then plug in any MCP server: GitHub, Slack, databases, file systems. It's the emerging standard—supported by Claude, Copilot, Cursor, and now Lunar.**

---

**Next → [Day 37: Build Your Own MCP Server](day-37.md)**
