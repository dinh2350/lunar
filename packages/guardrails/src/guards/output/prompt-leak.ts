import type { Guard, GuardResult, GuardContext } from '../../index.js';

export class PromptLeakGuard implements Guard {
  name = 'prompt-leak';
  constructor(private systemPromptFragments: string[] = []) {}

  setPromptFragments(fragments: string[]): void {
    this.systemPromptFragments = fragments.map(f => f.toLowerCase());
  }

  async check(output: string, _context?: GuardContext): Promise<GuardResult> {
    const lower = output.toLowerCase();
    const leakPatterns = [
      /my (?:system |initial )?(?:prompt|instructions?) (?:say|tell|are|is)/i,
      /i was (?:told|instructed|programmed) to/i,
      /my (?:rules|guidelines|constraints) (?:include|are|state)/i,
      /here (?:are|is) my (?:system |)(?:prompt|instructions?)/i,
      /the (?:system |)(?:prompt|instructions?) (?:I was given|say)/i,
    ];

    for (const pattern of leakPatterns) {
      if (pattern.test(output)) {
        return {
          passed: false,
          reason: 'Response appears to reveal system prompt',
          severity: 'block',
          guardName: this.name,
        };
      }
    }

    if (this.systemPromptFragments.length > 0) {
      let matchCount = 0;
      for (const fragment of this.systemPromptFragments) {
        if (lower.includes(fragment)) matchCount++;
      }
      if (matchCount >= 3) {
        return {
          passed: false,
          reason: 'Response contains system prompt content',
          severity: 'block',
          guardName: this.name,
          metadata: { matchedFragments: matchCount },
        };
      }
    }

    return { passed: true, severity: 'info', guardName: this.name };
  }
}
