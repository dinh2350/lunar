import type { Guard, GuardResult, GuardContext } from '../index.js';

interface PIIMatch {
  type: string;
  value: string;
  redacted: string;
  start: number;
  end: number;
  severity: 'critical' | 'sensitive' | 'low';
}

export class PIIDetectorGuard implements Guard {
  name = 'pii-detector';

  private patterns: Array<{
    name: string;
    regex: RegExp;
    severity: 'critical' | 'sensitive' | 'low';
    redactFn: (match: string) => string;
  }> = [
    { name: 'SSN', regex: /\b\d{3}[-. ]?\d{2}[-. ]?\d{4}\b/g, severity: 'critical', redactFn: () => '[SSN-REDACTED]' },
    { name: 'credit_card', regex: /\b(?:\d{4}[-. ]?){3}\d{4}\b/g, severity: 'critical', redactFn: (m) => `[CC-****${m.slice(-4)}]` },
    { name: 'password_mention', regex: /(?:password|passwd|pwd)\s*(?:is|:)\s*\S+/gi, severity: 'critical', redactFn: () => '[PASSWORD-REDACTED]' },
    { name: 'api_key', regex: /(?:api[_-]?key|token|secret)\s*(?:is|:)\s*['"]?[\w-]{20,}['"]?/gi, severity: 'critical', redactFn: () => '[API-KEY-REDACTED]' },
    { name: 'bank_account', regex: /\b\d{8,17}\b(?=\s*(?:account|routing|bank))/gi, severity: 'critical', redactFn: () => '[BANK-ACCT-REDACTED]' },
    {
      name: 'email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      severity: 'sensitive',
      redactFn: (m) => {
        const [local, domain] = m.split('@');
        return `${local[0]}***@${domain}`;
      },
    },
    { name: 'phone', regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, severity: 'sensitive', redactFn: (m) => `[PHONE-***${m.slice(-4)}]` },
    { name: 'ip_address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, severity: 'sensitive', redactFn: () => '[IP-REDACTED]' },
    { name: 'date_of_birth', regex: /\b(?:DOB|date\s+of\s+birth|birthday)\s*(?:is|:)\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi, severity: 'sensitive', redactFn: () => '[DOB-REDACTED]' },
  ];

  detectPII(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];
    for (const pattern of this.patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (this.isLikelyFalsePositive(match[0], pattern.name, text, match.index)) continue;
        matches.push({
          type: pattern.name,
          value: match[0],
          redacted: pattern.redactFn(match[0]),
          start: match.index,
          end: match.index + match[0].length,
          severity: pattern.severity,
        });
      }
    }
    return matches;
  }

  redact(text: string): { redacted: string; matches: PIIMatch[] } {
    const matches = this.detectPII(text);
    let redacted = text;
    const sorted = [...matches].sort((a, b) => b.start - a.start);
    for (const match of sorted) {
      redacted = redacted.slice(0, match.start) + match.redacted + redacted.slice(match.end);
    }
    return { redacted, matches };
  }

  async check(input: string, _context?: GuardContext): Promise<GuardResult> {
    const matches = this.detectPII(input);
    if (matches.length === 0) return { passed: true, severity: 'info', guardName: this.name };

    const critical = matches.filter(m => m.severity === 'critical');
    const sensitive = matches.filter(m => m.severity === 'sensitive');

    if (critical.length > 0) {
      const types = [...new Set(critical.map(m => m.type))].join(', ');
      return {
        passed: false,
        reason: `Sensitive data detected (${types}). I won't process or store this for your safety.`,
        severity: 'block',
        guardName: this.name,
        metadata: { detectedTypes: critical.map(m => m.type), count: critical.length },
      };
    }

    if (sensitive.length > 0) {
      const types = [...new Set(sensitive.map(m => m.type))].join(', ');
      return {
        passed: true,
        reason: `Sensitive info detected (${types}). Will be redacted before storage.`,
        severity: 'warn',
        guardName: this.name,
        metadata: { detectedTypes: sensitive.map(m => m.type), count: sensitive.length, willRedact: true },
      };
    }

    return { passed: true, severity: 'info', guardName: this.name };
  }

  private isLikelyFalsePositive(match: string, type: string, fullText: string, index: number): boolean {
    if (type === 'SSN') {
      const context = fullText.slice(Math.max(0, index - 20), index + match.length + 20);
      if (/version|port|id|code|zip|#|config/i.test(context)) return true;
    }
    if (type === 'phone' && match.replace(/\D/g, '').length < 10) return true;
    return false;
  }
}
