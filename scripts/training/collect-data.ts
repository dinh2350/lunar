import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolCalls?: any[];
}

interface RawConversation {
  sessionId: string;
  messages: RawMessage[];
  metadata?: {
    channel: string;
    userId: string;
    rating?: number;
  };
}

/**
 * Collect conversations from Lunar's JSONL transcript logs
 */
function collectFromTranscripts(logsDir: string): RawConversation[] {
  const conversations: RawConversation[] = [];

  const files = readdirSync(logsDir).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const lines = readFileSync(join(logsDir, file), 'utf-8')
      .split('\n')
      .filter(Boolean);

    const messages: RawMessage[] = [];
    let sessionId = file.replace('.jsonl', '');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.role && entry.content) {
          messages.push({
            role: entry.role,
            content: entry.content,
            timestamp: entry.timestamp,
            toolCalls: entry.toolCalls,
          });
        }
      } catch { /* skip malformed lines */ }
    }

    if (messages.length >= 2) { // At least one exchange
      conversations.push({ sessionId, messages });
    }
  }

  return conversations;
}

/**
 * Generate synthetic training examples for tool usage
 */
function generateSyntheticToolExamples(): RawConversation[] {
  const examples: RawConversation[] = [];
  
  const toolPatterns = [
    {
      user: "What's the weather in Tokyo?",
      assistant: 'Let me check the weather for you.\n\n<tool_call>{"name": "get_weather", "args": {"city": "Tokyo"}}</tool_call>',
    },
    {
      user: "Remember that my favorite language is TypeScript",
      assistant: "I'll save that preference for you.\n\n<tool_call>{\"name\": \"save_memory\", \"args\": {\"content\": \"User's favorite language is TypeScript\", \"type\": \"preference\"}}</tool_call>",
    },
    {
      user: "Find information about vector databases",
      assistant: 'Let me search my knowledge base.\n\n<tool_call>{"name": "search_memory", "args": {"query": "vector databases"}}</tool_call>',
    },
    {
      user: "What did we talk about yesterday?",
      assistant: 'Let me look through our conversation history.\n\n<tool_call>{"name": "search_memory", "args": {"query": "yesterday conversation summary"}}</tool_call>',
    },
  ];

  for (const pattern of toolPatterns) {
    examples.push({
      sessionId: `synthetic-${Math.random().toString(36).slice(2, 8)}`,
      messages: [
        { role: 'system', content: 'You are Lunar, a helpful AI agent.' },
        { role: 'user', content: pattern.user },
        { role: 'assistant', content: pattern.assistant },
      ],
    });
  }

  return examples;
}

// Export for pipeline
export { collectFromTranscripts, generateSyntheticToolExamples };
export type { RawConversation, RawMessage };
