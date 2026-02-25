# Day 37 — Build Your Own MCP Server

> 🎯 **DAY GOAL:** Build a custom MCP server that exposes Lunar's memory as a standard MCP resource — usable by any MCP client

---

## 📚 CONCEPT 1: MCP Server = Tool Provider

### WHAT — Simple Definition

**An MCP server is a program that exposes tools, resources, and prompts via the MCP protocol. Any MCP client (Claude Desktop, VS Code Copilot, Lunar, etc.) can connect and use them.**

```
YOU BUILD:                            WHO CAN USE IT:
  ┌─────────────────┐                  ┌──────────────────┐
  │  Lunar Memory    │                  │ Lunar Agent ✅   │
  │  MCP Server      │ ◄───MCP────── │ Claude Desktop ✅ │
  │                  │                  │ VS Code Copilot ✅│
  │  Tools:          │                  │ Cursor ✅        │
  │  - search_memory │                  │ Any MCP client ✅│
  │  - write_memory  │                  └──────────────────┘
  │                  │
  │  Resources:      │
  │  - MEMORY.md     │
  │  - daily notes   │
  └─────────────────┘
```

### WHY — Why Build Your Own MCP Server?

```
1. PORTFOLIO:
   "I built a custom MCP server" → demonstrates protocol knowledge

2. INTEROPERABILITY:
   → Claude Desktop can access Lunar's memory
   → VS Code Copilot can search your notes
   → Any tool that supports MCP can use your data

3. LEARNING:
   → Understanding both client AND server = complete knowledge
   → Most devs only use existing MCP servers
   → You can BUILD them → stands out
```

### 🔗 NODE.JS ANALOGY

```
Building MCP Server = Building a REST API

REST:
  → Define routes (GET /api/search, POST /api/write)
  → Handle requests, return JSON
  → Any HTTP client can use it

MCP:
  → Define tools (search_memory, write_memory)
  → Handle tool calls, return text/content
  → Any MCP client can use it
```

---

## 🔨 HANDS-ON: Build Lunar Memory MCP Server

### Step 1: Set Up (5 minutes)

```bash
mkdir -p packages/mcp-server
cd packages/mcp-server
pnpm init
pnpm add @modelcontextprotocol/sdk
```

### Step 2: Create the MCP Server (40 minutes)

Create `packages/mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

// ---- Configuration ----
const WORKSPACE = process.env.LUNAR_WORKSPACE
  || path.join(process.env.HOME || '~', '.lunar', 'agents', 'main', 'workspace');

// ---- Create Server ----
const server = new Server(
  {
    name: 'lunar-memory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ---- TOOLS ----

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_memory',
      description: 'Search Lunar agent memory for information about the user or past conversations',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query — what you want to find in memory',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'list_daily_notes',
      description: 'List all daily note files with dates',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'read_daily_note',
      description: 'Read a specific daily note by date',
      inputSchema: {
        type: 'object' as const,
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format',
          },
        },
        required: ['date'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'search_memory': {
      const query = (args?.query as string) || '';
      const results = searchMemoryFiles(query);
      return {
        content: [{ type: 'text', text: results || 'No results found.' }],
      };
    }

    case 'list_daily_notes': {
      const notes = listDailyNotes();
      return {
        content: [{ type: 'text', text: notes || 'No daily notes found.' }],
      };
    }

    case 'read_daily_note': {
      const date = args?.date as string;
      const content = readDailyNote(date);
      return {
        content: [{ type: 'text', text: content || `No note found for ${date}` }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ---- RESOURCES ----

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  // MEMORY.md
  const memPath = path.join(WORKSPACE, 'MEMORY.md');
  if (existsSync(memPath)) {
    resources.push({
      uri: 'lunar://memory/permanent',
      name: 'Permanent Memory',
      description: 'Long-term facts and preferences',
      mimeType: 'text/markdown',
    });
  }

  // Daily notes
  const dailyDir = path.join(WORKSPACE, 'memory');
  if (existsSync(dailyDir)) {
    const files = readdirSync(dailyDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const date = file.replace('.md', '');
      resources.push({
        uri: `lunar://memory/daily/${date}`,
        name: `Daily Notes: ${date}`,
        description: `Notes from ${date}`,
        mimeType: 'text/markdown',
      });
    }
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'lunar://memory/permanent') {
    const content = readFile(path.join(WORKSPACE, 'MEMORY.md'));
    return { contents: [{ uri, text: content, mimeType: 'text/markdown' }] };
  }

  const dailyMatch = uri.match(/^lunar:\/\/memory\/daily\/(\d{4}-\d{2}-\d{2})$/);
  if (dailyMatch) {
    const content = readFile(path.join(WORKSPACE, 'memory', `${dailyMatch[1]}.md`));
    return { contents: [{ uri, text: content, mimeType: 'text/markdown' }] };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ---- Helper Functions ----

function searchMemoryFiles(query: string): string {
  const queryLower = query.toLowerCase();
  const results: string[] = [];

  // Search MEMORY.md
  const memContent = readFile(path.join(WORKSPACE, 'MEMORY.md'));
  if (memContent) {
    const lines = memContent.split('\n').filter(l => l.toLowerCase().includes(queryLower));
    if (lines.length > 0) {
      results.push(`## MEMORY.md\n${lines.join('\n')}`);
    }
  }

  // Search daily notes
  const dailyDir = path.join(WORKSPACE, 'memory');
  if (existsSync(dailyDir)) {
    for (const file of readdirSync(dailyDir).filter(f => f.endsWith('.md'))) {
      const content = readFile(path.join(dailyDir, file));
      if (content) {
        const lines = content.split('\n').filter(l => l.toLowerCase().includes(queryLower));
        if (lines.length > 0) {
          results.push(`## ${file}\n${lines.join('\n')}`);
        }
      }
    }
  }

  return results.join('\n\n');
}

function listDailyNotes(): string {
  const dailyDir = path.join(WORKSPACE, 'memory');
  if (!existsSync(dailyDir)) return 'No daily notes directory.';
  
  const files = readdirSync(dailyDir).filter(f => f.endsWith('.md')).sort().reverse();
  return files.map(f => `- ${f.replace('.md', '')}`).join('\n');
}

function readDailyNote(date: string): string {
  return readFile(path.join(WORKSPACE, 'memory', `${date}.md`));
}

function readFile(filePath: string): string {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8');
}

// ---- Start Server ----

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🌙 Lunar Memory MCP Server running');
}

main().catch(console.error);
```

### Step 3: Test with MCP Inspector (10 minutes)

```bash
# Install MCP inspector
npx @modelcontextprotocol/inspector

# It opens a web UI where you can:
# 1. Connect to your server
# 2. List tools
# 3. Call tools interactively
# 4. Browse resources
```

### Step 4: Use with Claude Desktop (10 minutes)

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "lunar-memory": {
      "command": "npx",
      "args": ["tsx", "/path/to/lunar/packages/mcp-server/src/index.ts"],
      "env": {
        "LUNAR_WORKSPACE": "/Users/yourname/.lunar/agents/main/workspace"
      }
    }
  }
}
```

Now Claude Desktop can access your Lunar memory!

---

## ✅ CHECKLIST

- [ ] MCP server created with tools + resources
- [ ] search_memory tool works
- [ ] list_daily_notes and read_daily_note work
- [ ] Resources expose MEMORY.md and daily notes
- [ ] Tested with MCP inspector
- [ ] Can configure in Claude Desktop

---

## 💡 KEY TAKEAWAY

**Building an MCP server is like building a REST API — define endpoints (tools), handle requests, return data. The difference: MCP tools are automatically usable by any AI agent that supports MCP. Your Lunar memory is now a universal resource.**

---

**Next → [Day 38: MCP + Lunar Integration](day-38.md)**
