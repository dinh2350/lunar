import type { ToolDefinition, ToolResult } from './types.js';
import { hybridSearch } from '../../memory/src/search.js';
import type { VectorStore } from '../../memory/src/store.js';

export const memorySearchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_search',
    description: 'Search the knowledge base for relevant information. Use this BEFORE answering questions about documented topics.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — describe what information you need',
        },
      },
      required: ['query'],
    },
  },
};

export function createMemorySearchExecutor(store: VectorStore) {
  return async function executeMemorySearch(
    args: { query: string },
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const results = await hybridSearch(args.query, store, { limit: 5 });

      if (results.length === 0) {
        return {
          name: 'memory_search',
          result: 'No relevant information found in the knowledge base.',
          success: true,
          durationMs: Date.now() - startTime,
        };
      }

      const formatted = results.map((r, i) => {
        const source = r.filePath ? ` (source: ${r.filePath})` : '';
        return `[${i + 1}]${source}\n${r.content}`;
      }).join('\n\n---\n\n');

      return {
        name: 'memory_search',
        result: formatted,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        name: 'memory_search',
        result: `Search error: ${error.message}`,
        success: false,
        durationMs: Date.now() - startTime,
      };
    }
  };
}
