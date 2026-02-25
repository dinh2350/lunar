/**
 * A single message in the conversation.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * LLM Provider Interface — the contract every LLM provider must follow.
 *
 * WHY: So we can swap Ollama ↔ Groq ↔ Gemini without changing any calling code.
 *
 * Think of it like a database driver interface:
 *   interface DB { query(sql: string): Promise<Row[]> }
 *   class PostgresDB implements DB { ... }
 *   class MySQLDB implements DB { ... }
 */
export interface LLMProvider {
  /** Provider name (for logging) */
  readonly name: string;

  /** Send messages, get full response */
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;

  /** Send messages, get response token by token */
  chatStream(
    messages: Message[],
    onToken: (token: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResponse>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;       // the full response text
  model: string;         // which model was actually used
  tokensUsed?: number;   // how many tokens (if available)
}
