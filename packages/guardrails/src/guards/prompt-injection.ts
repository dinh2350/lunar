import type { Guard, GuardResult, GuardContext } from '../index.js';

export class PromptInjectionGuard implements Guard {
  name = 'prompt-injection';

  private patterns: Array<{ regex: RegExp; description: string }> = [
    { regex: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i, description: 'Instruction override attempt' },
    { regex: /you\s+are\s+now\s+(a|an)\s+/i, description: 'Role reassignment attempt' },
    { regex: /forget\s+(everything|all)\s+(you|about)/i, description: 'Memory wipe attempt' },
    { regex: /system\s*prompt|system\s*message|initial\s*instructions/i, description: 'System prompt extraction attempt' },
    { regex: /\[?(INST|SYS|SYSTEM)\]?\s*:?\s*/i, description: 'Instruction tag injection' },
    { regex: /pretend\s+(you'?re|to\s+be)\s+(not\s+)?an?\s+AI/i, description: 'Identity override attempt' },
    { regex: /do\s+not\s+follow\s+(your|any|the)\s+(rules?|guidelines?|instructions?)/i, description: 'Rule bypass attempt' },
    { regex: /reveal\s+(your|the)\s+(system|hidden|secret|initial)\s+(prompt|instructions?|message)/i, description: 'System prompt leak attempt' },
    { regex: /act\s+as\s+(if\s+)?you\s+have\s+no\s+(restrictions?|limits?|guardrails?)/i, description: 'Restriction removal attempt' },
  ];

  async check(input: string, _context?: GuardContext): Promise<GuardResult> {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(input)) {
        return {
          passed: false,
          reason: `Prompt injection detected: ${pattern.description}`,
          severity: 'block',
          guardName: this.name,
          metadata: { pattern: pattern.description },
        };
      }
    }

    const suspiciousChars = input.match(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g);
    if (suspiciousChars && suspiciousChars.length > 3) {
      return {
        passed: false,
        reason: 'Suspicious hidden characters detected',
        severity: 'warn',
        guardName: this.name,
        metadata: { hiddenChars: suspiciousChars.length },
      };
    }

    return { passed: true, severity: 'info', guardName: this.name };
  }
}
