/**
 * Beta iteration — feedback categorization, context management, model fallback
 */

// ── Feedback Categorization ──

export type FeedbackCategory = 'bug' | 'feature' | 'ux' | 'performance' | 'praise';

const CATEGORY_KEYWORDS: Record<FeedbackCategory, string[]> = {
  bug: ['bug', 'broken', 'crash', 'error', 'fail', 'wrong', 'doesn\'t work', 'issue'],
  feature: ['add', 'want', 'wish', 'could you', 'would be nice', 'feature', 'support'],
  ux: ['confusing', 'unclear', 'hard to', 'improve', 'better', 'ugly', 'slow to find'],
  performance: ['slow', 'timeout', 'lag', 'takes too long', 'fast', 'speed'],
  praise: ['love', 'great', 'awesome', 'amazing', 'nice', 'thanks', 'good job', 'helpful'],
};

export function categorizeFeedback(text: string): FeedbackCategory {
  const lower = text.toLowerCase();
  let bestCategory: FeedbackCategory = 'ux';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as FeedbackCategory;
    }
  }

  return bestCategory;
}

// ── Dynamic Timeout per complexity ──

export interface Message {
  role: string;
  content: string;
}

const DYNAMIC_TIMEOUT: Record<string, number> = {
  simple: 10_000,
  normal: 30_000,
  complex: 60_000,
  tool: 45_000,
};

export function getTimeoutForMessage(message: string): number {
  if (message.length < 20) return DYNAMIC_TIMEOUT.simple;
  if (/code|write|generate|implement|create/i.test(message)) return DYNAMIC_TIMEOUT.complex;
  return DYNAMIC_TIMEOUT.normal;
}

// ── Context Window Management ──

export function trimContext(messages: Message[], maxTokens: number): Message[] {
  let tokens = 0;
  const kept: Message[] = [];

  // Always keep system prompt + last 2 messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    if (tokens + msgTokens > maxTokens && kept.length >= 2) break;
    tokens += msgTokens;
    kept.unshift(messages[i]);
  }

  return kept;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // ~4 chars per token
}

// ── Model Fallback ──

export async function selectAvailableModel(
  preferredModel: string,
  checkFn: (model: string) => Promise<boolean>,
): Promise<string> {
  const fallbackOrder = [preferredModel, 'llama3.2:3b', 'gemma2:2b', 'mistral:7b'];

  for (const model of fallbackOrder) {
    if (await checkFn(model)) {
      return model;
    }
  }

  throw new Error('No models available');
}

// ── Release Notes Template ──

export function generateReleaseNotes(
  version: string,
  fixes: string[],
  improvements: string[],
  stats: { messages: number; successRate: number; avgResponseMs: number },
): string {
  return [
    `## Lunar ${version} — Beta Update\n`,
    '### 🐛 Bug Fixes',
    ...fixes.map((f) => `- ${f}`),
    '',
    '### ✨ Improvements',
    ...improvements.map((i) => `- ${i}`),
    '',
    '### 📊 Stats Since Last Update',
    `- Processed ${stats.messages.toLocaleString()} messages`,
    `- ${stats.successRate.toFixed(1)}% success rate`,
    `- Avg response time: ${(stats.avgResponseMs / 1000).toFixed(1)}s`,
  ].join('\n');
}
