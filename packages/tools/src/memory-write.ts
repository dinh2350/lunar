import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import type { ToolDefinition, ToolResult } from './types.js';
import { chunkMarkdown } from '../../memory/src/chunker.js';
import { embedBatch } from '../../memory/src/embedder.js';
import type { VectorStore } from '../../memory/src/store.js';

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

export function createMemoryWriteExecutor(store: VectorStore, basePath: string) {
  return async function executeMemoryWrite(
    args: { key: string; content: string; permanent?: string },
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const isPermanent = args.permanent === 'true';

    try {
      // Choose file: permanent facts go to MEMORY.md, daily to dated file
      const filePath = isPermanent
        ? path.join(basePath, 'MEMORY.md')
        : path.join(basePath, 'memory', `${new Date().toISOString().split('T')[0]}.md`);

      // Ensure directory exists
      await mkdir(path.dirname(filePath), { recursive: true });

      // Append to the file
      const entry = `\n## ${args.key}\n${args.content}\n_Saved: ${new Date().toISOString()}_\n`;
      await appendFile(filePath, entry);

      // Index for search (so it's immediately searchable)
      const chunks = chunkMarkdown(entry, path.relative(basePath, filePath));
      if (chunks.length > 0) {
        const embeddings = await embedBatch(chunks.map(c => c.content));
        store.insertChunks(chunks, embeddings);
      }

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
