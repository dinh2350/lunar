# Day 54 — Tool Safety + Sandboxing

> 🎯 **DAY GOAL:** Make tool execution safe — permission levels, path restrictions, command allowlists, and sandboxing dangerous operations

---

## 📚 CONCEPT 1: Tool Execution Is Dangerous

### WHAT — Simple Definition

**When an LLM calls tools, it can read files, run commands, and write data. Without safety controls, a manipulated LLM could delete files, read secrets, or execute malicious code.**

```
DANGER: The LLM Decides What Tools Do

User: "Clean up my project"
LLM thinks: call bash_exec("rm -rf ~/Documents/*")
                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                 THIS DELETES EVERYTHING!

SAFE: Permission + Validation Before Execution

User: "Clean up my project"
LLM wants: bash_exec("rm -rf ~/Documents/*")
  ↓
Permission check: ❌ rm -rf not in allowlist
  ↓
Path check: ❌ ~ is outside sandbox directory
  ↓
Result: "I can't execute that command. It's outside my allowed operations."
```

### WHY — Defense Against Tool Misuse

```
ATTACK VECTORS:
  1. Prompt injection → LLM calls dangerous tools
  2. Path traversal → read_file("../../.env")
  3. Command injection → bash("echo hi; rm -rf /")
  4. Data exfiltration → write sensitive data to external URL
  5. Resource exhaustion → infinite loop tool calls

DEFENSE LAYERS:
  Layer 1: Tool permissions (which tools are available)
  Layer 2: Argument validation (limit paths, commands)
  Layer 3: Sandboxing (restrict OS-level access)
  Layer 4: Human approval (for destructive operations)
  Layer 5: Audit logging (track all tool calls)
```

---

## 🔨 HANDS-ON: Build Tool Safety

### Step 1: Permission System (20 minutes)

Create `packages/guardrails/src/tool-safety.ts`:

```typescript
export type PermissionLevel = 'read' | 'write' | 'execute' | 'admin';

export interface ToolPermission {
  toolName: string;
  level: PermissionLevel;
  requiresApproval: boolean;
  allowedPaths?: string[];     // For file tools
  allowedCommands?: string[];  // For exec tools
  maxExecutions?: number;      // Rate limit per session
  description: string;
}

// Default permission configuration
export const DEFAULT_PERMISSIONS: ToolPermission[] = [
  // SAFE — read-only tools
  {
    toolName: 'memory_search',
    level: 'read',
    requiresApproval: false,
    description: 'Search agent memory (safe, read-only)',
  },
  {
    toolName: 'read_file',
    level: 'read',
    requiresApproval: false,
    allowedPaths: ['./workspace', './docs', './data'],
    description: 'Read files in allowed directories',
  },
  {
    toolName: 'list_directory',
    level: 'read',
    requiresApproval: false,
    allowedPaths: ['./workspace', './docs'],
    description: 'List directory contents',
  },

  // MODERATE — write operations
  {
    toolName: 'memory_write',
    level: 'write',
    requiresApproval: false,
    description: 'Write to agent memory',
  },
  {
    toolName: 'write_file',
    level: 'write',
    requiresApproval: true,  // ← Needs user approval!
    allowedPaths: ['./workspace', './output'],
    description: 'Write files (requires approval)',
  },

  // DANGEROUS — execute operations
  {
    toolName: 'bash_exec',
    level: 'execute',
    requiresApproval: true,
    allowedCommands: [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
      'date', 'echo', 'pwd', 'whoami',
      'node', 'npx', 'pnpm',
      'git log', 'git status', 'git diff',
    ],
    maxExecutions: 10,  // Max 10 commands per session
    description: 'Execute shell commands (restricted)',
  },
];

export class ToolSafetyManager {
  private permissions: Map<string, ToolPermission>;
  private executionCounts = new Map<string, number>();

  constructor(permissions: ToolPermission[] = DEFAULT_PERMISSIONS) {
    this.permissions = new Map(permissions.map(p => [p.toolName, p]));
  }

  /**
   * Check if a tool call is allowed
   */
  async checkToolCall(
    toolName: string,
    args: Record<string, unknown>,
    sessionId: string,
  ): Promise<{
    allowed: boolean;
    needsApproval: boolean;
    reason?: string;
  }> {
    const permission = this.permissions.get(toolName);

    // Unknown tool — block
    if (!permission) {
      return {
        allowed: false,
        needsApproval: false,
        reason: `Tool "${toolName}" is not registered in permissions`,
      };
    }

    // Rate limit check
    if (permission.maxExecutions) {
      const key = `${sessionId}:${toolName}`;
      const count = this.executionCounts.get(key) || 0;
      if (count >= permission.maxExecutions) {
        return {
          allowed: false,
          needsApproval: false,
          reason: `Rate limit: ${toolName} used ${count}/${permission.maxExecutions} times this session`,
        };
      }
    }

    // Path validation
    if (permission.allowedPaths) {
      const pathArg = (args.path || args.filePath || args.directory) as string;
      if (pathArg && !this.isPathAllowed(pathArg, permission.allowedPaths)) {
        return {
          allowed: false,
          needsApproval: false,
          reason: `Path "${pathArg}" is outside allowed directories`,
        };
      }
    }

    // Command validation
    if (permission.allowedCommands) {
      const cmd = (args.command || args.cmd) as string;
      if (cmd && !this.isCommandAllowed(cmd, permission.allowedCommands)) {
        return {
          allowed: false,
          needsApproval: false,
          reason: `Command not in allowlist: "${cmd.split(' ')[0]}"`,
        };
      }
    }

    // Track execution
    const key = `${sessionId}:${toolName}`;
    this.executionCounts.set(key, (this.executionCounts.get(key) || 0) + 1);

    return {
      allowed: true,
      needsApproval: permission.requiresApproval,
    };
  }

  /**
   * Check if path is within allowed directories
   */
  private isPathAllowed(inputPath: string, allowed: string[]): boolean {
    const path = require('path');
    const resolved = path.resolve(inputPath);

    // Block path traversal
    if (inputPath.includes('..')) return false;

    // Check against allowed paths
    return allowed.some(allowedPath => {
      const resolvedAllowed = path.resolve(allowedPath);
      return resolved.startsWith(resolvedAllowed);
    });
  }

  /**
   * Check if command starts with an allowed command
   */
  private isCommandAllowed(cmd: string, allowed: string[]): boolean {
    const trimmed = cmd.trim();

    // Block command chaining: ; | && || ` $()
    if (/[;|`]|\$\(|&&|\|\|/.test(trimmed)) {
      return false;
    }

    // Check if command starts with allowed prefix
    return allowed.some(allowedCmd => {
      return trimmed === allowedCmd || trimmed.startsWith(allowedCmd + ' ');
    });
  }

  /**
   * Reset session execution counts
   */
  resetSession(sessionId: string): void {
    for (const key of this.executionCounts.keys()) {
      if (key.startsWith(sessionId)) {
        this.executionCounts.delete(key);
      }
    }
  }
}
```

### Step 2: Human Approval Flow (15 minutes)

```typescript
// In packages/agent/src/approval.ts

export interface ApprovalRequest {
  toolName: string;
  args: Record<string, unknown>;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

export type ApprovalCallback = (request: ApprovalRequest) => Promise<boolean>;

export class ApprovalManager {
  private callback?: ApprovalCallback;
  private autoApproveLevel: 'none' | 'low' | 'medium' | 'all' = 'low';

  setApprovalCallback(callback: ApprovalCallback): void {
    this.callback = callback;
  }

  setAutoApproveLevel(level: typeof this.autoApproveLevel): void {
    this.autoApproveLevel = level;
  }

  async requestApproval(request: ApprovalRequest): Promise<boolean> {
    // Auto-approve based on level
    const autoApproveMap = { none: 0, low: 1, medium: 2, all: 3 };
    const riskMap = { low: 1, medium: 2, high: 3 };

    if (autoApproveMap[this.autoApproveLevel] >= riskMap[request.risk]) {
      return true;
    }

    // Ask human
    if (this.callback) {
      return this.callback(request);
    }

    // No callback registered — deny
    return false;
  }
}
```

### Step 3: Wire Into Tool Router (15 minutes)

```typescript
// In packages/agent/src/tool-router.ts — add safety checks:

import { ToolSafetyManager } from '@lunar/guardrails/tool-safety';
import { ApprovalManager } from './approval.js';

export class SafeToolRouter {
  private safety = new ToolSafetyManager();
  private approval = new ApprovalManager();
  private auditLog: Array<{ timestamp: Date; tool: string; args: any; result: string }> = [];

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    sessionId: string,
  ): Promise<{ success: boolean; result: unknown; blocked?: string }> {
    
    // 1. Safety check
    const check = await this.safety.checkToolCall(name, args, sessionId);

    if (!check.allowed) {
      this.auditLog.push({
        timestamp: new Date(),
        tool: name,
        args,
        result: `BLOCKED: ${check.reason}`,
      });
      return { success: false, result: null, blocked: check.reason };
    }

    // 2. Approval check (if needed)
    if (check.needsApproval) {
      const approved = await this.approval.requestApproval({
        toolName: name,
        args,
        description: `Execute ${name} with ${JSON.stringify(args)}`,
        risk: name === 'bash_exec' ? 'high' : 'medium',
      });

      if (!approved) {
        this.auditLog.push({
          timestamp: new Date(),
          tool: name,
          args,
          result: 'DENIED: User did not approve',
        });
        return { success: false, result: null, blocked: 'User denied approval' };
      }
    }

    // 3. Execute the tool
    const result = await this.tools.get(name)!.execute(args);

    // 4. Audit log
    this.auditLog.push({
      timestamp: new Date(),
      tool: name,
      args,
      result: 'SUCCESS',
    });

    return { success: true, result };
  }
}
```

---

## ✅ CHECKLIST

- [ ] Permission system with read/write/execute levels
- [ ] Path validation (no traversal, allowlisted dirs only)
- [ ] Command allowlist (block chaining, restrict commands)
- [ ] Rate limiting per tool per session
- [ ] Human approval flow for destructive operations
- [ ] Auto-approve based on risk level
- [ ] Audit log of all tool calls
- [ ] Unknown tools are blocked by default

---

## 💡 KEY TAKEAWAY

**Tool safety is about defense in depth: permissions check WHAT can run, path/command validation checks HOW it runs, approval flow adds HUMAN judgment, and audit logging ensures ACCOUNTABILITY. The principle of least privilege applies: tools should have the minimum access needed. This is what separates a safe AI agent from a dangerous one.**

---

**Next → [Day 55: Safety Audit + Week 11 Wrap](day-55.md)**
