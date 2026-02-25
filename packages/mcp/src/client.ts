import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ToolDefinition } from '@lunar/shared';

/**
 * MCP Client — connects to MCP servers and exposes their tools
 * to the Lunar agent engine.
 * Supports both stdio (local) and HTTP+SSE (remote) transports.
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

  /** Connect to MCP server via stdio (local) */
  async connectStdio(command: string, args: string[] = [], env?: Record<string, string>): Promise<void> {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env } as Record<string, string>,
    });

    await this.client.connect(transport);
    this.connected = true;
    console.log(`  🔌 MCP connected (stdio): ${this.serverName}`);
  }

  /** Connect to MCP server via HTTP+SSE (remote) */
  async connectHTTP(url: string, headers?: Record<string, string>): Promise<void> {
    const transport = new SSEClientTransport(new URL(url), {
      requestInit: { headers },
    });

    await this.client.connect(transport);
    this.connected = true;
    console.log(`  🔌 MCP connected (HTTP): ${this.serverName}`);
  }

  /** Get tools from MCP server as Lunar ToolDefinitions */
  async getTools(): Promise<ToolDefinition[]> {
    if (!this.connected) throw new Error('Not connected');

    const result = await this.client.listTools();
    
    return result.tools.map(tool => {
      // Convert MCP tool schema to Lunar's ToolDefinition format
      const inputSchema = (tool.inputSchema ?? {}) as Record<string, unknown>;
      const properties = (inputSchema.properties ?? {}) as Record<string, { type: string; description?: string }>;
      const required = (inputSchema.required ?? []) as string[];

      const convertedProps: Record<string, { type: string; description: string }> = {};
      for (const [key, value] of Object.entries(properties)) {
        convertedProps[key] = {
          type: typeof value === 'object' && value.type ? String(value.type) : 'string',
          description: typeof value === 'object' && value.description ? String(value.description) : key,
        };
      }

      return {
        type: 'function' as const,
        function: {
          name: `mcp_${this.serverName}_${tool.name}`,
          description: tool.description || `MCP tool: ${tool.name}`,
          parameters: {
            type: 'object' as const,
            properties: convertedProps,
            required,
          },
        },
      };
    });
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
    const textContent = (result.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === 'text' && c.text)
      .map(c => c.text!)
      .join('\n');

    return textContent || JSON.stringify(result.content);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this.connected = false;
  }
}
