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

// Tools that are always safe
const AUTO_APPROVE_TOOLS = new Set([
  'get_current_datetime',
  'calculate',
  'read_file',
  'list_directory',
]);

export function getPolicy(toolName: string, args: Record<string, any>): ApprovalPolicy {
  // Check deny patterns for bash
  if (toolName === 'bash' && args.command) {
    for (const pattern of DENY_PATTERNS) {
      if (pattern.test(args.command)) return 'deny';
    }
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
