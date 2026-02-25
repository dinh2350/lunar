/**
 * Tool Definition — tells the AI what tools are available.
 *
 * WHAT: A JSON Schema description of a function the AI can ask to call
 * WHY:  The AI reads this to decide WHICH tool to use and WHAT arguments to provide
 *
 * Same format used by: OpenAI, Anthropic, Ollama, Groq, Gemini
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;  // ← MOST IMPORTANT! AI decides based on this
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

/**
 * Tool Result — what we send back to the AI after executing a tool.
 */
export interface ToolResult {
  name: string;
  result: string;
  success: boolean;
  durationMs?: number;
}
