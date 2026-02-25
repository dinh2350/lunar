import readline from 'readline/promises';

export type ApprovalPolicy = 'auto' | 'ask' | 'deny';
export type ApprovalResult = 'approved' | 'denied';

// Dangerous patterns that are always denied
const DENY_PATTERNS = [
  /rm\s+(-[rf]+\s+)*(\/|~|\$HOME)/i,
  /sudo/i,
  /shutdown|reboot|halt/i,
  /mkfs|format/i,
];

// Tools that are always safe (including read-only MCP tools)
const AUTO_APPROVE_TOOLS = new Set([
  'get_current_datetime',
  'calculate',
  'read_file',
  'list_directory',
  'memory_search',
]);

// Read-only MCP tool patterns (auto-approve)
const MCP_AUTO_PATTERNS = [
  /^mcp_.*_search/,
  /^mcp_.*_list/,
  /^mcp_.*_read/,
  /^mcp_.*_get/,
  /^mcp_fetch_/,
];

// Destructive MCP tool patterns (always deny)
const MCP_DENY_PATTERNS = [
  /^mcp_.*_drop/i,
  /^mcp_.*_delete_repo/i,
  /^mcp_.*_truncate/i,
];

export function getPolicy(toolName: string, args: Record<string, any>): ApprovalPolicy {
  // Check deny patterns for bash
  if (toolName === 'bash' && args.command) {
    for (const pattern of DENY_PATTERNS) {
      if (pattern.test(args.command)) return 'deny';
    }
  }

  // MCP tool deny patterns
  if (toolName.startsWith('mcp_')) {
    for (const pattern of MCP_DENY_PATTERNS) {
      if (pattern.test(toolName)) return 'deny';
    }
    // MCP auto-approve (read-only)
    for (const pattern of MCP_AUTO_PATTERNS) {
      if (pattern.test(toolName)) return 'auto';
    }
    // All other MCP tools need approval (write operations)
    return 'ask';
  }

  // Auto-approve safe tools
  if (AUTO_APPROVE_TOOLS.has(toolName)) return 'auto';

  // Everything else needs approval
  return 'ask';
}

export async function askUserApproval(
  toolName: string,
  args: Record<string, any>,
): Promise<ApprovalResult> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n⚠️  APPROVAL NEEDED`);
  console.log(`   Tool: ${toolName}`);
  console.log(`   Args: ${JSON.stringify(args, null, 2)}`);

  const answer = await rl.question('   Allow? (y/N): ');
  rl.close();

  return answer.toLowerCase() === 'y' ? 'approved' : 'denied';
}
