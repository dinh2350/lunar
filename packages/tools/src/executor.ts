import type { ToolDefinition, ToolResult } from './types.js';
import { datetimeTool, executeDatetime } from './datetime.js';
import { calculatorTool, executeCalculator } from './calculator.js';
import { bashTool, executeBash } from './bash.js';
import { readFileTool, executeReadFile, listDirTool, executeListDir, writeFileTool, executeWriteFile } from './filesystem.js';
import { memorySearchTool, createMemorySearchExecutor } from './memory-search.js';
import { memoryWriteTool, createMemoryWriteExecutor } from './memory-write.js';
import type { VectorStore } from '../../memory/src/store.js';

// Registry: all available tools
const tools: Map<string, {
  definition: ToolDefinition;
  execute: (args: any) => string | Promise<string>;
}> = new Map();

// Register core tools
tools.set('get_current_datetime', { definition: datetimeTool, execute: executeDatetime });
tools.set('calculate', { definition: calculatorTool, execute: executeCalculator });
tools.set('bash', { definition: bashTool, execute: executeBash });
tools.set('read_file', { definition: readFileTool, execute: executeReadFile });
tools.set('list_directory', { definition: listDirTool, execute: executeListDir });
tools.set('write_file', { definition: writeFileTool, execute: executeWriteFile });

/**
 * Initialize memory-dependent tools. Call once at startup with a VectorStore.
 */
export function initializeTools(store: VectorStore, memoryBasePath = './data/workspace') {
  const executeMemorySearch = createMemorySearchExecutor(store);
  tools.set('memory_search', {
    definition: memorySearchTool,
    execute: (args: any) => executeMemorySearch(args).then(r => r.result),
  });

  const executeMemoryWrite = createMemoryWriteExecutor(store, memoryBasePath);
  tools.set('memory_write', {
    definition: memoryWriteTool,
    execute: (args: any) => executeMemoryWrite(args).then(r => r.result),
  });
}

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
