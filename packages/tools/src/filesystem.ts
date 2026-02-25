import { readFile, readdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { ToolDefinition } from './types.js';

// === READ FILE ===

export const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the contents of a file. Use this to examine files the user asks about.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read (relative or absolute)',
        },
      },
      required: ['path'],
    },
  },
};

export async function executeReadFile(args: { path: string }): Promise<string> {
  try {
    if (!existsSync(args.path)) {
      return `File not found: ${args.path}`;
    }
    const content = await readFile(args.path, 'utf8');
    if (content.length > 5000) {
      return content.slice(0, 5000) + `\n... (file truncated, ${content.length} total chars)`;
    }
    return content;
  } catch (error: any) {
    return `Error reading file: ${error.message}`;
  }
}

// === LIST DIRECTORY ===

export const listDirTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_directory',
    description: 'List files and folders in a directory. Returns names with / suffix for folders.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)',
        },
      },
      required: [],
    },
  },
};

export async function executeListDir(args: { path?: string }): Promise<string> {
  try {
    const dirPath = args.path || '.';
    const entries = await readdir(dirPath, { withFileTypes: true });

    const items = entries.map(entry => {
      const suffix = entry.isDirectory() ? '/' : '';
      return `${entry.name}${suffix}`;
    });

    return items.join('\n') || '(empty directory)';
  } catch (error: any) {
    return `Error listing directory: ${error.message}`;
  }
}

// === WRITE FILE ===

export const writeFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it does not exist. Use ONLY when the user explicitly asks to create or modify a file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to write to',
        },
        content: {
          type: 'string',
          description: 'Content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
};

export async function executeWriteFile(args: { path: string; content: string }): Promise<string> {
  try {
    await writeFile(args.path, args.content, 'utf8');
    return `✅ Written to ${args.path} (${args.content.length} chars)`;
  } catch (error: any) {
    return `Error writing file: ${error.message}`;
  }
}
