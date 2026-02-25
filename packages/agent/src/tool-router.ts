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
    this.builtinTools.set(def.function.name, { def, exec: executor });
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
