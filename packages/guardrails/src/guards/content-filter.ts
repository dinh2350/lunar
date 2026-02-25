import type { Guard, GuardResult, GuardContext } from '../index.js';

export class ContentFilterGuard implements Guard {
  name = 'content-filter';

  private blockedPatterns: Array<{ regex: RegExp; category: string }> = [
    { regex: /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|explosive|weapon)/i, category: 'violence' },
    { regex: /how\s+to\s+(hack|crack|break\s+into)\s/i, category: 'illegal' },
    { regex: /how\s+to\s+(kill|harm|hurt)\s+(myself|yourself|themselves)/i, category: 'self-harm' },
  ];

  private warnPatterns: Array<{ regex: RegExp; category: string }> = [
    { regex: /password|credential|secret\s+key|api\s+key/i, category: 'credentials' },
    { regex: /\b(hack|exploit|vulnerability)\b/i, category: 'security' },
  ];

  async check(input: string, _context?: GuardContext): Promise<GuardResult> {
    for (const pattern of this.blockedPatterns) {
      if (pattern.regex.test(input)) {
        return {
          passed: false,
          reason: `Harmful content detected: ${pattern.category}`,
          severity: 'block',
          guardName: this.name,
          metadata: { category: pattern.category },
        };
      }
    }

    for (const pattern of this.warnPatterns) {
      if (pattern.regex.test(input)) {
        return {
          passed: true,
          reason: `Sensitive topic: ${pattern.category}`,
          severity: 'warn',
          guardName: this.name,
          metadata: { category: pattern.category },
        };
      }
    }

    return { passed: true, severity: 'info', guardName: this.name };
  }
}
