import type { RawConversation } from './collect-data.js';

interface ChatMLExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

const DEFAULT_SYSTEM = 'You are Lunar, a helpful AI agent built with Node.js. You use tools when needed and remember user preferences.';

/**
 * Convert to ChatML format (standard for fine-tuning)
 */
export function toChatML(conversations: RawConversation[]): ChatMLExample[] {
  return conversations.map(conv => {
    const messages: ChatMLExample['messages'] = [];
    
    // Ensure system message exists
    const hasSystem = conv.messages.some(m => m.role === 'system');
    if (!hasSystem) {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM });
    }

    for (const msg of conv.messages) {
      if (msg.role === 'tool') {
        // Wrap tool results in the assistant flow
        messages.push({
          role: 'user',
          content: `<tool_result>${msg.content}</tool_result>`,
        });
      } else if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    return { messages };
  });
}

/**
 * Write to JSONL file
 */
export function toJSONL(examples: ChatMLExample[]): string {
  return examples.map(ex => JSON.stringify(ex)).join('\n');
}

/**
 * Split into train/validation sets
 */
export function trainValSplit(
  examples: ChatMLExample[],
  valRatio = 0.1,
): { train: ChatMLExample[]; val: ChatMLExample[] } {
  // Shuffle
  const shuffled = [...examples].sort(() => Math.random() - 0.5);
  
  const valSize = Math.max(1, Math.floor(shuffled.length * valRatio));
  
  return {
    val: shuffled.slice(0, valSize),
    train: shuffled.slice(valSize),
  };
}

/**
 * Print dataset statistics
 */
export function printStats(examples: ChatMLExample[]): void {
  const totalMessages = examples.reduce((sum, ex) => sum + ex.messages.length, 0);
  const totalChars = examples.reduce(
    (sum, ex) => sum + ex.messages.reduce((s, m) => s + m.content.length, 0), 0
  );
  const avgMessages = totalMessages / examples.length;
  const estimatedTokens = Math.floor(totalChars / 4);

  const withTools = examples.filter(ex =>
    ex.messages.some(m => m.content.includes('<tool_call>'))
  ).length;

  console.log(`
Dataset Statistics:
  Examples:        ${examples.length}
  Total messages:  ${totalMessages}
  Avg messages:    ${avgMessages.toFixed(1)} per example
  Total chars:     ${totalChars.toLocaleString()}
  Est. tokens:     ${estimatedTokens.toLocaleString()}
  With tool calls: ${withTools} (${((withTools / examples.length) * 100).toFixed(1)}%)
  `);
}
