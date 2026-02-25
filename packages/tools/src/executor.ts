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
