/**
 * Conversation UX utilities — typing indicators, follow-ups, error messages, formatting
 */

// ── Typing Indicator ──

export interface ChannelContext {
  startTyping(): () => void;
  reply(message: string): Promise<void>;
  channel: string;
}

// ── Smart Follow-up Suggestions ──

export function generateFollowUps(response: string, _context?: string): string[] {
  const suggestions: string[] = [];

  if (response.includes('saved') || response.includes('remember')) {
    suggestions.push('What do you remember about me?');
  }
  if (response.includes('code') || response.includes('function')) {
    suggestions.push('Can you explain this code?', 'Can you add tests?');
  }
  if (response.includes('error') || response.includes('bug')) {
    suggestions.push('How do I fix this?', 'Show me an example');
  }
  if (response.includes('search') || response.includes('found')) {
    suggestions.push('Tell me more', 'Search for something else');
  }

  return suggestions.slice(0, 3);
}

// ── Graceful Error Messages ──

export const ERROR_MESSAGES: Record<string, string> = {
  timeout: "I'm taking longer than expected. Let me try a simpler approach...",
  rateLimit: 'I need a moment to catch my breath. Try again in a few seconds.',
  toolError: "I tried to look that up but ran into an issue. Let me try differently.",
  llmError: "I'm having trouble thinking right now. Please try again shortly.",
  modelUnavailable: 'My brain is loading up. Give me a moment...',
  default: 'Something went wrong on my end. Could you try rephrasing your question?',
};

export function getErrorMessage(errorType?: string): string {
  return ERROR_MESSAGES[errorType || 'default'] || ERROR_MESSAGES.default;
}

// ── Message Formatting (per channel) ──

export function formatResponse(text: string, channel: string): string {
  if (channel === 'telegram') {
    return text; // Telegram supports Markdown natively
  }

  if (channel === 'discord') {
    return text.replace(/#{4,}/g, '###'); // Discord max h3
  }

  if (channel === 'web') {
    return text; // Web UI handles Markdown rendering
  }

  return text;
}

// ── Long Response Chunking ──

export function chunkMessage(text: string, maxLength = 4000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to break at paragraph
    let breakPoint = remaining.lastIndexOf('\n\n', maxLength);
    if (breakPoint < maxLength * 0.5) {
      // Try line break
      breakPoint = remaining.lastIndexOf('\n', maxLength);
    }
    if (breakPoint < maxLength * 0.5) {
      // Force break at space
      breakPoint = remaining.lastIndexOf(' ', maxLength);
    }
    if (breakPoint <= 0) breakPoint = maxLength;

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}
