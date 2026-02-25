import { Ollama } from 'ollama';
import type { LLMProvider, Message, ChatOptions, ChatResponse } from './types.js';

/**
 * Ollama LLM Provider — runs AI locally on your Mac.
 *
 * WHAT: Wraps the Ollama API into a clean provider interface
 * WHY:  So we can swap to Groq/Gemini later without changing other code
 * WHEN: Default provider for development (free, private, offline)
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private client: Ollama;
  private defaultModel: string;

  constructor(host = 'http://localhost:11434', defaultModel = 'llama3.2') {
    this.client = new Ollama({ host });
    this.defaultModel = defaultModel;
  }

  /**
   * Non-streaming chat — waits for full response.
   * Use when: you need the complete text before proceeding
   * (e.g., evaluating the response, parsing JSON from it)
   */
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel;

    const response = await this.client.chat({
      model,
      messages,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2048,
      },
    });

    return {
      content: response.message.content,
      model,
      tokensUsed: response.eval_count,
    };
  }

  /**
   * Streaming chat — calls onToken for each word as it's generated.
   * Use when: displaying to user (CLI, chat UI, Telegram)
   *
   * How it works:
   *   1. Ollama starts generating tokens
   *   2. Each token is sent to onToken() immediately
   *   3. Meanwhile, we build the full string
   *   4. When done, return the complete response
   */
  async chatStream(
    messages: Message[],
    onToken: (token: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model ?? this.defaultModel;

    const stream = await this.client.chat({
      model,
      messages,
      stream: true,   // ← THE KEY: enables streaming
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 2048,
      },
    });

    // Collect the full response while streaming each token
    let fullContent = '';

    // "for await" reads async streams — same as Node.js ReadableStream
    for await (const chunk of stream) {
      const token = chunk.message.content;
      fullContent += token;
      onToken(token);  // ← print/display immediately
    }

    return {
      content: fullContent,
      model,
    };
  }
}

// Default provider instance
export const defaultProvider = new OllamaProvider();
