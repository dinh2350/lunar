// ============================================
// Core message types (used everywhere)
// ============================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ============================================
// Tool types
// ============================================

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
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

export interface ToolResult {
  name: string;
  result: string;
  success: boolean;
  durationMs: number;
}

// ============================================
// LLM types
// ============================================

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ============================================
// Envelope (from architecture: InboundEnvelope)
// ============================================

export interface InboundEnvelope {
  provider: 'cli' | 'telegram' | 'webchat' | 'discord';
  peerId: string;
  text: string;
  chatType: 'direct' | 'group';
  ts: string;
}
