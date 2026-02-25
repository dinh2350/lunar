import type { RawConversation, RawMessage } from './collect-data.js';

// PII patterns to redact
const PII_PATTERNS = [
  { name: 'email', regex: /[\w.-]+@[\w.-]+\.\w+/g, replacement: '<EMAIL>' },
  { name: 'phone', regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '<PHONE>' },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '<SSN>' },
  { name: 'creditcard', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '<CC>' },
  { name: 'ip', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '<IP>' },
];

/**
 * Clean a conversation for training
 */
export function cleanConversation(conv: RawConversation): RawConversation | null {
  const cleaned: RawMessage[] = [];

  for (const msg of conv.messages) {
    // Skip empty messages
    if (!msg.content?.trim()) continue;

    // Redact PII
    let content = msg.content;
    for (const pattern of PII_PATTERNS) {
      content = content.replace(pattern.regex, pattern.replacement);
    }

    // Normalize whitespace
    content = content.replace(/\n{3,}/g, '\n\n').trim();

    // Skip very short assistant responses (likely errors)
    if (msg.role === 'assistant' && content.length < 10) continue;

    cleaned.push({ ...msg, content });
  }

  // Need at least system + user + assistant
  const hasUser = cleaned.some(m => m.role === 'user');
  const hasAssistant = cleaned.some(m => m.role === 'assistant');
  
  if (!hasUser || !hasAssistant) return null;

  return { ...conv, messages: cleaned };
}

/**
 * Filter conversations by quality
 */
export function filterByQuality(
  conversations: RawConversation[],
  options: {
    minMessages?: number;
    maxMessages?: number;
    minAssistantLength?: number;
    maxTokenEstimate?: number;
    requireToolUse?: boolean;
  } = {}
): RawConversation[] {
  const {
    minMessages = 3,
    maxMessages = 20,
    minAssistantLength = 50,
    maxTokenEstimate = 2048,
    requireToolUse = false,
  } = options;

  return conversations.filter(conv => {
    // Message count limits
    if (conv.messages.length < minMessages) return false;
    if (conv.messages.length > maxMessages) return false;

    // Check assistant response quality
    const assistantMsgs = conv.messages.filter(m => m.role === 'assistant');
    const avgLength = assistantMsgs.reduce((sum, m) => sum + m.content.length, 0) / assistantMsgs.length;
    if (avgLength < minAssistantLength) return false;

    // Rough token estimate (1 token ≈ 4 chars)
    const totalChars = conv.messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars / 4 > maxTokenEstimate) return false;

    // Tool use requirement
    if (requireToolUse) {
      const hasToolCall = assistantMsgs.some(m => m.content.includes('<tool_call>'));
      if (!hasToolCall) return false;
    }

    return true;
  });
}

/**
 * Deduplicate similar conversations
 */
export function deduplicate(conversations: RawConversation[]): RawConversation[] {
  const seen = new Set<string>();
  
  return conversations.filter(conv => {
    // Create a fingerprint from first user message
    const firstUser = conv.messages.find(m => m.role === 'user');
    if (!firstUser) return false;
    
    const fingerprint = firstUser.content.toLowerCase().trim().slice(0, 100);
    if (seen.has(fingerprint)) return false;
    
    seen.add(fingerprint);
    return true;
  });
}
