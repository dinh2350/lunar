import type { Guard, GuardResult, GuardContext } from '../../index.js';

export class ResponseQualityGuard implements Guard {
  name = 'response-quality';

  async check(output: string, context?: GuardContext): Promise<GuardResult> {
    const issues: string[] = [];

    if (output.trim().length < 5) {
      return {
        passed: false,
        reason: 'Response is empty or too short',
        severity: 'block',
        guardName: this.name,
      };
    }

    if (this.isRepetitive(output)) issues.push('Repetitive text detected (possible generation loop)');
    if (this.isIncomplete(output)) issues.push('Response appears to be cut off');

    const overconfidentPatterns = [/definitely|absolutely|100% certain|without a doubt/gi];
    const uncertainTopics = [/predict|future|will.*happen|stock.*price|weather.*tomorrow/gi];
    const hasOverconfidence = overconfidentPatterns.some(p => p.test(output));
    const hasUncertainTopic = uncertainTopics.some(p => p.test(output));
    if (hasOverconfidence && hasUncertainTopic) issues.push('Overconfident language on uncertain topic');

    if (issues.length > 0) {
      return {
        passed: true,
        reason: issues.join('; '),
        severity: 'warn',
        guardName: this.name,
        metadata: { issues },
      };
    }
    return { passed: true, severity: 'info', guardName: this.name };
  }

  private isRepetitive(text: string): boolean {
    const words = text.split(/\s+/);
    if (words.length < 20) return false;
    const trigrams = new Map<string, number>();
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = words.slice(i, i + 3).join(' ').toLowerCase();
      trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1);
    }
    const maxRepeat = Math.max(...trigrams.values());
    return maxRepeat >= 3 && maxRepeat / (words.length / 3) > 0.1;
  }

  private isIncomplete(text: string): boolean {
    const trimmed = text.trim();
    if (/[,;:\-–—]\s*$/.test(trimmed)) return true;
    if (/\b(the|a|an|in|on|at|to|for|and|or|but)\s*$/i.test(trimmed)) return true;
    return false;
  }
}
