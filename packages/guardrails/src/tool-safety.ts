export interface ToolPermission {
  name: string;
  allowed: boolean;
  requiresApproval: boolean;
  rateLimit?: { maxCalls: number; windowMs: number };
  allowedArgs?: Record<string, (value: unknown) => boolean>;
  description: string;
}

export const DEFAULT_PERMISSIONS: ToolPermission[] = [
  {
    name: 'read_file',
    allowed: true,
    requiresApproval: false,
    description: 'Read file contents',
    allowedArgs: {
      path: (v) => {
        const p = String(v);
        // Block sensitive paths
        return !p.includes('..') && !p.startsWith('/etc') && !p.startsWith('/root') && !p.includes('.env');
      },
    },
  },
  {
    name: 'write_file',
    allowed: true,
    requiresApproval: true,
    description: 'Write to files',
    allowedArgs: {
      path: (v) => {
        const p = String(v);
        return !p.includes('..') && !p.startsWith('/etc') && !p.startsWith('/root');
      },
    },
  },
  {
    name: 'run_command',
    allowed: true,
    requiresApproval: true,
    rateLimit: { maxCalls: 5, windowMs: 60_000 },
    description: 'Execute shell commands',
    allowedArgs: {
      command: (v) => {
        const cmd = String(v).toLowerCase();
        const blocked = ['rm -rf', 'mkfs', 'dd if=', 'chmod 777', '> /dev/', 'shutdown', 'reboot', 'format'];
        return !blocked.some(b => cmd.includes(b));
      },
    },
  },
  {
    name: 'web_fetch',
    allowed: true,
    requiresApproval: false,
    rateLimit: { maxCalls: 10, windowMs: 60_000 },
    description: 'Fetch web pages',
  },
  {
    name: 'memory_search',
    allowed: true,
    requiresApproval: false,
    description: 'Search memory store',
  },
  {
    name: 'memory_write',
    allowed: true,
    requiresApproval: false,
    description: 'Write to memory store',
  },
];

interface AuditEntry {
  timestamp: string;
  tool: string;
  args: Record<string, unknown>;
  allowed: boolean;
  reason?: string;
  userId?: string;
}

export class ToolSafetyManager {
  private permissions: Map<string, ToolPermission>;
  private rateCounts = new Map<string, number[]>();
  private auditLog: AuditEntry[] = [];

  constructor(permissions: ToolPermission[] = DEFAULT_PERMISSIONS) {
    this.permissions = new Map(permissions.map(p => [p.name, p]));
  }

  async checkPermission(
    toolName: string,
    args: Record<string, unknown>,
    userId?: string,
  ): Promise<{ allowed: boolean; requiresApproval: boolean; reason?: string }> {
    const permission = this.permissions.get(toolName);

    if (!permission) {
      this.audit(toolName, args, false, 'Unknown tool', userId);
      return { allowed: false, requiresApproval: false, reason: `Unknown tool: ${toolName}` };
    }

    if (!permission.allowed) {
      this.audit(toolName, args, false, 'Tool disabled', userId);
      return { allowed: false, requiresApproval: false, reason: `Tool ${toolName} is disabled` };
    }

    // Check rate limit
    if (permission.rateLimit) {
      const key = `${toolName}:${userId || 'global'}`;
      const now = Date.now();
      const timestamps = (this.rateCounts.get(key) || []).filter(
        t => now - t < permission.rateLimit!.windowMs,
      );

      if (timestamps.length >= permission.rateLimit.maxCalls) {
        this.audit(toolName, args, false, 'Rate limited', userId);
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Rate limit: ${toolName} (${timestamps.length}/${permission.rateLimit.maxCalls} per ${permission.rateLimit.windowMs / 1000}s)`,
        };
      }

      timestamps.push(now);
      this.rateCounts.set(key, timestamps);
    }

    // Validate arguments
    if (permission.allowedArgs) {
      for (const [argName, validator] of Object.entries(permission.allowedArgs)) {
        if (args[argName] !== undefined && !validator(args[argName])) {
          this.audit(toolName, args, false, `Invalid arg: ${argName}`, userId);
          return {
            allowed: false,
            requiresApproval: false,
            reason: `Blocked argument for ${toolName}: ${argName}`,
          };
        }
      }
    }

    this.audit(toolName, args, true, undefined, userId);
    return { allowed: true, requiresApproval: permission.requiresApproval };
  }

  private audit(
    tool: string,
    args: Record<string, unknown>,
    allowed: boolean,
    reason?: string,
    userId?: string,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      tool,
      args,
      allowed,
      reason,
      userId,
    });

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  getPermission(toolName: string): ToolPermission | undefined {
    return this.permissions.get(toolName);
  }

  setPermission(permission: ToolPermission): void {
    this.permissions.set(permission.name, permission);
  }
}
