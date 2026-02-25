#!/usr/bin/env node
/**
 * Lunar Memory MCP Server
 * Exposes Lunar's memory system as MCP tools + resources.
 * Any MCP client (Claude Desktop, Cursor, etc.) can access Lunar memory.
 */
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
        content: [{ type: 'text' as const, text: results || 'No results found.' }],
      };
    }

    case 'list_daily_notes': {
      const notes = listDailyNotes();
      return {
        content: [{ type: 'text' as const, text: notes || 'No daily notes found.' }],
      };
    }

    case 'read_daily_note': {
      const date = args?.date as string;
      const content = readDailyNote(date);
      return {
        content: [{ type: 'text' as const, text: content || `No note found for ${date}` }],
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
    const content = safeReadFile(path.join(WORKSPACE, 'MEMORY.md'));
    return { contents: [{ uri, text: content, mimeType: 'text/markdown' }] };
  }

  const dailyMatch = uri.match(/^lunar:\/\/memory\/daily\/(\d{4}-\d{2}-\d{2})$/);
  if (dailyMatch) {
    const content = safeReadFile(path.join(WORKSPACE, 'memory', `${dailyMatch[1]}.md`));
    return { contents: [{ uri, text: content, mimeType: 'text/markdown' }] };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ---- Helper Functions ----

function searchMemoryFiles(query: string): string {
  const queryLower = query.toLowerCase();
  const results: string[] = [];

  // Search MEMORY.md
  const memContent = safeReadFile(path.join(WORKSPACE, 'MEMORY.md'));
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
      const content = safeReadFile(path.join(dailyDir, file));
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
  return safeReadFile(path.join(WORKSPACE, 'memory', `${date}.md`));
}

function safeReadFile(filePath: string): string {
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
