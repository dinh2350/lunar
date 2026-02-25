import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition } from './types.js';

const execAsync = promisify(exec);

// Commands that should NEVER be allowed
const BLOCKED_PATTERNS = [
  /rm\s+(-[rf]+\s+)*(\/|~|\$HOME)/i,  // rm -rf / or ~
  /sudo/i,
  /shutdown|reboot|halt/i,
  /mkfs|format/i,
  />\s*\/dev\//i,  // writing to device files
  /:(){ :|:& };:/,  // fork bomb
];

export const bashTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'bash',
    description: 'Execute a shell command and return the output. Use for: listing files, checking system info, running dev tools (git, npm). Do NOT use for destructive operations.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute (e.g., "ls -la", "git status", "node -v")',
        },
      },
      required: ['command'],
    },
  },
};

export async function executeBash(args: { command: string }): Promise<string> {
  // Safety check: block dangerous commands
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(args.command)) {
      return `⛔ BLOCKED: Command "${args.command}" is not allowed for safety reasons.`;
    }
  }

  try {
    const { stdout, stderr } = await execAsync(args.command, {
      timeout: 10_000,  // 10 second timeout
      maxBuffer: 1024 * 1024,  // 1MB output limit
      cwd: process.cwd(),  // run in current directory
    });

    const output = (stdout || stderr || '(no output)').trim();

    // If output is very long, truncate it
    if (output.length > 2000) {
      return output.slice(0, 2000) + '\n... (output truncated, showing first 2000 chars)';
    }
    return output;
  } catch (error: any) {
    if (error.killed) {
      return `⏰ Command timed out after 10 seconds: "${args.command}"`;
    }
    return `Error: ${error.message}`;
  }
}
