import type { ContextItem } from './protocol.js';

/**
 * Builds relevant context for a sub-agent task.
 * Gathers from: memory, conversation history, previous results.
 */
export class ContextBuilder {
  private memorySearch: (query: string) => Promise<any[]>;

  constructor(memorySearch: (query: string) => Promise<any[]>) {
    this.memorySearch = memorySearch;
  }

  /**
   * Build context for a task instruction
   */
  async buildContext(
    instruction: string,
    options: {
      conversationHistory?: Array<{ role: string; content: string }>;
      previousResults?: Array<{ agent: string; output: string }>;
      maxItems?: number;
    } = {}
  ): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const maxItems = options.maxItems || 10;

    // 1. Search memory for relevant context
    try {
      const memories = await this.memorySearch(instruction);
      for (const mem of memories.slice(0, 5)) {
        items.push({
          type: 'memory',
          content: mem.content,
          source: mem.source || 'memory',
          relevance: mem.score || 0.5,
        });
      }
    } catch {
      // Memory unavailable — continue without it
    }

    // 2. Add relevant conversation history
    if (options.conversationHistory) {
      const recent = options.conversationHistory.slice(-6);
      for (const msg of recent) {
        items.push({
          type: 'conversation',
          content: `${msg.role}: ${msg.content}`,
          source: 'conversation',
          relevance: 0.7,
        });
      }
    }

    // 3. Add previous agent results (for pipeline pattern)
    if (options.previousResults) {
      for (const prev of options.previousResults) {
        items.push({
          type: 'previous_result',
          content: `[${prev.agent} output]: ${prev.output}`,
          source: prev.agent,
          relevance: 0.9,
        });
      }
    }

    // Sort by relevance, take top N
    return items
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxItems);
  }

  /**
   * Format context items for inclusion in a prompt
   */
  static formatForPrompt(items: ContextItem[]): string {
    if (items.length === 0) return '';

    return `<context>
${items.map(item => 
  `[${item.type}|${item.source}|relevance:${item.relevance.toFixed(2)}]
${item.content}`
).join('\n\n')}
</context>`;
  }
}
