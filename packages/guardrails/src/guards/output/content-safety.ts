import type { Guard, GuardResult, GuardContext } from '../../index.js';

export class OutputContentGuard implements Guard {
  name = 'output-content';

  private harmfulPatterns: Array<{ regex: RegExp; category: string }> = [
    { regex: /rm\s+-rf\s+\/(?!\w)/g, category: 'destructive_command' },
    { regex: /DROP\s+TABLE|DELETE\s+FROM\s+\*|TRUNCATE/gi, category: 'destructive_sql' },
    { regex: /format\s+[cC]:\s*\//g, category: 'destructive_command' },
    { regex: /eval\(|exec\(|__import__\(|Runtime\.getRuntime/g, category: 'code_execution' },
  ];

  async check(output: string, _context?: GuardContext): Promise<GuardResult> {
    for (const pattern of this.harmfulPatterns) {
      if (pattern.regex.test(output)) {
        return {
          passed: false,
          reason: `Potentially harmful content in response: ${pattern.category}`,
          severity: 'block',
          guardName: this.name,
          metadata: { category: pattern.category },
        };
      }
    }
    return { passed: true, severity: 'info', guardName: this.name };
  }
}
