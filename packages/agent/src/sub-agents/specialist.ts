import type { AgentMessage, AgentResult, TaskPayload } from './protocol.js';
import { createResult } from './protocol.js';
import { ContextBuilder } from './context-builder.js';

export interface SpecialistConfig {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  defaultConstraints: {
    maxTokens: number;
    timeout: number;
    maxToolCalls: number;
    temperature: number;
  };
}

export class SpecialistAgent {
  private config: SpecialistConfig;
  private llmCall: (messages: any[], options: any) => Promise<any>;

  constructor(
    config: SpecialistConfig,
    llmCall: (messages: any[], options: any) => Promise<any>,
  ) {
    this.config = config;
    this.llmCall = llmCall;
  }

  get name() { return this.config.name; }
  get description() { return this.config.description; }

  /**
   * Execute a task message and return a result
   */
  async execute(message: AgentMessage): Promise<AgentResult> {
    const start = Date.now();
    const payload = message.payload as TaskPayload;

    try {
      // Build prompt with context
      const contextText = ContextBuilder.formatForPrompt(payload.context);

      const messages = [
        { role: 'system', content: this.config.systemPrompt },
        {
          role: 'user',
          content: [
            contextText,
            `\nTask: ${payload.instruction}`,
            `\nConstraints: max ${payload.constraints.maxTokens} tokens, max ${payload.constraints.maxToolCalls} tool calls`,
          ].filter(Boolean).join('\n'),
        },
      ];

      // Call LLM with constraints
      const response = await this.callWithConstraints(messages, payload.constraints);

      return createResult(message.id, this.config.name, message.traceId, {
        status: 'success',
        output: response.content,
        toolsUsed: response.toolCalls || [],
        tokensUsed: response.tokensUsed || 0,
        durationMs: Date.now() - start,
        confidence: this.estimateConfidence(response),
      });

    } catch (error) {
      return createResult(message.id, this.config.name, message.traceId, {
        status: 'error',
        output: '',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
        confidence: 0,
      });
    }
  }

  private async callWithConstraints(messages: any[], constraints: any) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), constraints.timeout);

    try {
      return await this.llmCall(messages, {
        maxTokens: constraints.maxTokens,
        temperature: constraints.temperature || this.config.defaultConstraints.temperature,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private estimateConfidence(response: any): number {
    // Simple heuristic — can be improved
    if (!response.content) return 0;
    if (response.content.length < 50) return 0.3;
    if (response.content.includes("I'm not sure") || response.content.includes("I don't know")) return 0.4;
    return 0.8;
  }
}
