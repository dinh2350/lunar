import type { ToolDefinition, ToolResult } from './types.js';
import type { VectorStore } from '../../memory/src/store.js';
import type { MemoryFiles } from '../../memory/src/files.js';
import type { MemoryIndexer } from '../../memory/src/indexer.js';

export const memoryWriteTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_write',
    description: 'Save important information to memory for future retrieval. Use this when the user shares personal info, preferences, or facts they want remembered.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'A short label for what is being saved (e.g., "favorite restaurant", "pet name")',
        },
        content: {
          type: 'string',
          description: 'The information to save',
        },
        permanent: {
          type: 'string',
          enum: ['true', 'false'],
          description: '"true" for permanent facts (name, preferences), "false" for temporary/daily info',
        },
      },
      required: ['key', 'content'],
    },
  },
};

export function createMemoryWriteExecutor(
  store: VectorStore,
  memoryFiles: MemoryFiles,
  indexer: MemoryIndexer,
) {
  return async function executeMemoryWrite(
    args: { key: string; content: string; permanent?: string },
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const isPermanent = args.permanent === 'true';

    try {
      // Write to the appropriate memory file
      const filePath = isPermanent
        ? await memoryFiles.appendPermanentMemory(args.key, args.content)
        : await memoryFiles.appendDailyNote(args.key, args.content);

      // Auto-index the changed file
      await indexer.indexFile(filePath);

      return {
        name: 'memory_write',
        result: `Saved "${args.key}" to ${isPermanent ? 'permanent memory' : 'daily notes'}.`,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        name: 'memory_write',
        result: `Failed to save: ${error.message}`,
        success: false,
        durationMs: Date.now() - startTime,
      };
    }
  };
}
