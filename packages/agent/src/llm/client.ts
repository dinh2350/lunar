/**
 * LLM Client — talks to Ollama
 *
 * This is the lowest-level AI code in Lunar.
 * Everything else builds on top of this.
 */
import { Ollama } from 'ollama';

// === CONNECTION ===
export const ollama = new Ollama({
  host: 'http://localhost:11434',
});

// === CONFIGURATION ===

/**
 * LLM Configuration
 * Controls how the AI behaves for each request.
 *
 * Think of this like Express request options:
 *   { timeout: 5000, maxRetries: 3 }
 * But for AI:
 *   { temperature: 0.7, maxTokens: 2048 }
 */
export interface LLMConfig {
  model: string;       // which AI brain to use
  temperature: number; // 0 = deterministic, 1 = creative
  maxTokens: number;   // max response length in tokens
}

/** Default config — good for general conversation */
const DEFAULT_CONFIG: LLMConfig = {
  model: 'llama3.2',
  temperature: 0.7,
  maxTokens: 2048,
};

// === PRESET CONFIGS FOR DIFFERENT TASKS ===

/** For code generation — precise, no creativity */
export const CODE_CONFIG: Partial<LLMConfig> = {
  temperature: 0.1,
  maxTokens: 4096,
};

/** For factual Q&A — deterministic, consistent answers */
export const FACTUAL_CONFIG: Partial<LLMConfig> = {
  temperature: 0,
  maxTokens: 1024,
};

/** For creative tasks — more variation */
export const CREATIVE_CONFIG: Partial<LLMConfig> = {
  temperature: 1.0,
  maxTokens: 4096,
};

// === MAIN CHAT FUNCTION ===

/**
 * Send a message to the AI.
 *
 * @param userMessage  - What the user typed
 * @param systemPrompt - Instructions for the AI (optional)
 * @param config       - Override default settings (optional)
 * @returns The AI's response text
 */
export async function chat(
  userMessage: string,
  systemPrompt?: string,
  config: Partial<LLMConfig> = {}
): Promise<string> {
  // Merge: defaults ← overrides
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const response = await ollama.chat({
    model: cfg.model,
    messages: [
      {
        role: 'system',
        content: systemPrompt ?? 'You are Lunar, a helpful personal assistant. Be concise.',
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    options: {
      temperature: cfg.temperature,
      num_predict: cfg.maxTokens, // Ollama uses "num_predict" instead of "max_tokens"
    },
  });

  return response.message.content;
}
