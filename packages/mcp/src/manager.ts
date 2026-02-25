import { MCPClient } from './client.js';
import type { ToolDefinition } from '@lunar/shared';

interface MCPServerConfig {
  name: string;
  transport?: 'stdio' | 'http';
  // stdio options
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http options
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Manages multiple MCP server connections.
 * Loads config, connects, and provides unified tool list.
 * Supports both stdio (local) and HTTP+SSE (remote) transports.
 */
export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();

  async connectServer(config: MCPServerConfig): Promise<void> {
    const client = new MCPClient(config.name);

    if (config.transport === 'http' && config.url) {
      await client.connectHTTP(config.url, config.headers);
    } else if (config.command) {
      await client.connectStdio(config.command, config.args || [], config.env);
    } else {
      throw new Error(`Invalid MCP server config for "${config.name}": need command (stdio) or url (http)`);
    }

    this.clients.set(config.name, client);
  }

  async connectAll(configs: MCPServerConfig[]): Promise<void> {
    const enabledConfigs = configs.filter(c => c.enabled !== false);
    for (const config of enabledConfigs) {
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

  /** Check if a tool name belongs to an MCP server */
  isMCPTool(toolName: string): boolean {
    return toolName.startsWith('mcp_');
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}
