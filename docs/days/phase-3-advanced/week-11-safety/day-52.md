# Day 52 — PII Detection + Data Privacy

> 🎯 **DAY GOAL:** Build PII (Personally Identifiable Information) detection to prevent storing or leaking sensitive data

---

## 📚 CONCEPT 1: What Is PII?

### WHAT — Simple Definition

**PII = any data that can identify a specific person. SSN, credit card numbers, phone numbers, email addresses, passwords, medical info, etc. Your AI agent must NEVER store or leak this.**

```
PII EXAMPLES:
  🔴 CRITICAL (never store):
     SSN:          123-45-6789
     Credit Card:  4532-1234-5678-9012
     Password:     MyP@ssw0rd!
     Bank Account: 12345678901234

  🟡 SENSITIVE (redact before storing):
     Phone:        +1-555-123-4567
     Email:        john@example.com
     Address:      123 Main St, City, ST 12345
     Date of Birth: 01/15/1990
     IP Address:   192.168.1.100

  🟢 GENERALLY SAFE (can store):
     First Name:   John
     Preferences:  "Likes TypeScript"
     Public Info:  "Works at Google"
```

### WHY — Legal + Ethical Obligation

```
IF YOUR AI LEAKS PII:
  → GDPR fines: up to €20M or 4% of revenue
  → CCPA fines: $7,500 per violation
  → User trust: destroyed permanently
  → Career: serious professional consequences

  Example breach scenario:
  User tells Lunar: "My SSN is 123-45-6789"
  → Lunar stores in memory ❌
  → Memory file gets committed to Git ❌
  → SSN exposed publicly 💀

WITH PII PROTECTION:
  User: "My SSN is 123-45-6789"
  → PII detector catches SSN pattern
  → Lunar: "I detected a Social Security Number.
     I won't store that for your safety."
  → SSN never reaches memory or logs ✅
```

---

## 🔨 HANDS-ON: Build PII Detector

### Step 1: PII Pattern Matcher (25 minutes)

Create `packages/guardrails/src/guards/pii-detector.ts`:

```typescript
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

  // PII patterns with named groups
  private patterns: Array<{
    name: string;
    regex: RegExp;
    severity: 'critical' | 'sensitive' | 'low';
    redactFn: (match: string) => string;
  }> = [
    // CRITICAL — never store
    {
      name: 'SSN',
      regex: /\b\d{3}[-. ]?\d{2}[-. ]?\d{4}\b/g,
      severity: 'critical',
      redactFn: () => '[SSN-REDACTED]',
    },
    {
      name: 'credit_card',
      regex: /\b(?:\d{4}[-. ]?){3}\d{4}\b/g,
      severity: 'critical',
      redactFn: (m) => `[CC-****${m.slice(-4)}]`,
    },
    {
      name: 'password_mention',
      regex: /(?:password|passwd|pwd)\s*(?:is|:)\s*\S+/gi,
      severity: 'critical',
      redactFn: () => '[PASSWORD-REDACTED]',
    },
    {
      name: 'api_key',
      regex: /(?:api[_-]?key|token|secret)\s*(?:is|:)\s*['"]?[\w-]{20,}['"]?/gi,
      severity: 'critical',
      redactFn: () => '[API-KEY-REDACTED]',
    },
    {
      name: 'bank_account',
      regex: /\b\d{8,17}\b(?=\s*(?:account|routing|bank))/gi,
      severity: 'critical',
      redactFn: () => '[BANK-ACCT-REDACTED]',
    },

    // SENSITIVE — redact before storing
    {
      name: 'email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      severity: 'sensitive',
      redactFn: (m) => {
        const [local, domain] = m.split('@');
        return `${local[0]}***@${domain}`;
      },
    },
    {
      name: 'phone',
      regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      severity: 'sensitive',
      redactFn: (m) => `[PHONE-***${m.slice(-4)}]`,
    },
    {
      name: 'ip_address',
      regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      severity: 'sensitive',
      redactFn: () => '[IP-REDACTED]',
    },
    {
      name: 'date_of_birth',
      regex: /\b(?:DOB|date\s+of\s+birth|birthday)\s*(?:is|:)\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
      severity: 'sensitive',
      redactFn: () => '[DOB-REDACTED]',
    },
  ];

  /**
   * Scan text for PII matches
   */
  detectPII(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];

    for (const pattern of this.patterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        // Validate: skip obvious non-PII (e.g., "123-45-6789" in code context)
        if (this.isLikelyFalsePositive(match[0], pattern.name, text, match.index)) {
          continue;
        }

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

  /**
   * Replace PII with redacted placeholders
   */
  redact(text: string): { redacted: string; matches: PIIMatch[] } {
    const matches = this.detectPII(text);
    let redacted = text;

    // Replace in reverse order to preserve indices
    const sorted = [...matches].sort((a, b) => b.start - a.start);
    for (const match of sorted) {
      redacted = redacted.slice(0, match.start) + match.redacted + redacted.slice(match.end);
    }

    return { redacted, matches };
  }

  /**
   * Guard check — blocks critical PII, warns on sensitive
   */
  async check(input: string, _context?: GuardContext): Promise<GuardResult> {
    const matches = this.detectPII(input);

    if (matches.length === 0) {
      return { passed: true, severity: 'info', guardName: this.name };
    }

    const critical = matches.filter(m => m.severity === 'critical');
    const sensitive = matches.filter(m => m.severity === 'sensitive');

    if (critical.length > 0) {
      const types = [...new Set(critical.map(m => m.type))].join(', ');
      return {
        passed: false,
        reason: `Sensitive data detected (${types}). I won't process or store this for your safety.`,
        severity: 'block',
        guardName: this.name,
        metadata: {
          detectedTypes: critical.map(m => m.type),
          count: critical.length,
        },
      };
    }

    if (sensitive.length > 0) {
      const types = [...new Set(sensitive.map(m => m.type))].join(', ');
      return {
        passed: true,  // Allow but will be redacted
        reason: `Sensitive info detected (${types}). Will be redacted before storage.`,
        severity: 'warn',
        guardName: this.name,
        metadata: {
          detectedTypes: sensitive.map(m => m.type),
          count: sensitive.length,
          willRedact: true,
        },
      };
    }

    return { passed: true, severity: 'info', guardName: this.name };
  }

  /**
   * Filter false positives
   */
  private isLikelyFalsePositive(
    match: string, type: string, fullText: string, index: number
  ): boolean {
    // SSN: skip if in code-like context
    if (type === 'SSN') {
      const context = fullText.slice(Math.max(0, index - 20), index + match.length + 20);
      if (/version|port|id|code|zip|#|config/i.test(context)) return true;
    }

    // Phone: skip very short matches that might be other numbers
    if (type === 'phone' && match.replace(/\D/g, '').length < 10) return true;

    return false;
  }
}
```

### Step 2: Redaction in Memory Pipeline (15 minutes)

```typescript
// In packages/memory/src/writer.ts — add PII redaction:

import { PIIDetectorGuard } from '@lunar/guardrails/guards/pii-detector';

export class MemoryWriter {
  private piiDetector = new PIIDetectorGuard();

  async writeMemory(content: string, source: string): Promise<void> {
    // ALWAYS redact PII before storing
    const { redacted, matches } = this.piiDetector.redact(content);

    if (matches.length > 0) {
      this.logger.info('PII redacted from memory write', {
        source,
        redactedTypes: matches.map(m => m.type),
        count: matches.length,
      });
    }

    // Store the REDACTED version only
    await this.store.insert({
      content: redacted,
      source,
      metadata: {
        piiRedacted: matches.length > 0,
        redactedTypes: matches.map(m => m.type),
      },
    });
  }
}
```

### Step 3: Redaction in Logging (10 minutes)

```typescript
// Create packages/guardrails/src/redact-logger.ts

import { PIIDetectorGuard } from './guards/pii-detector.js';

const piiDetector = new PIIDetectorGuard();

/**
 * Wrap any logger to auto-redact PII from log messages
 */
export function createSafeLogger(baseLogger: any) {
  return {
    info: (msg: string, data?: any) => {
      baseLogger.info(piiDetector.redact(msg).redacted, redactData(data));
    },
    warn: (msg: string, data?: any) => {
      baseLogger.warn(piiDetector.redact(msg).redacted, redactData(data));
    },
    error: (msg: string, data?: any) => {
      baseLogger.error(piiDetector.redact(msg).redacted, redactData(data));
    },
  };
}

function redactData(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') return piiDetector.redact(data).redacted;
  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        result[key] = piiDetector.redact(value).redacted;
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return data;
}
```

---

## ✅ CHECKLIST

- [ ] PII detector catches SSN, credit card, password, API key
- [ ] PII detector catches email, phone, IP, DOB
- [ ] Redaction replaces PII with safe placeholders
- [ ] False positive filtering (code context, short numbers)
- [ ] Memory writer auto-redacts before storage
- [ ] Logger auto-redacts in messages
- [ ] Critical PII blocks input entirely
- [ ] Sensitive PII warns but allows (redacted)

---

## 💡 KEY TAKEAWAY

**PII protection is a REQUIREMENT, not a feature. Every path where user data flows — memory, logs, responses — must pass through PII detection and redaction. The key pattern: detect → classify severity → block critical / redact sensitive → log (redacted). Even if Lunar is self-hosted and private, building this habit prepares you for production AI systems where PII compliance is legally required.**

---

**Next → [Day 53: Output Safety + Response Filtering](day-53.md)**
