import { randomUUID } from 'crypto';

// ─── Message Types ───

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'context' | 'feedback' | 'cancel';
  payload: TaskPayload | ContextPayload | FeedbackPayload;
  parentId?: string;       // For threading
  traceId: string;         // For tracking entire workflow
  timestamp: Date;
}

export interface TaskPayload {
  instruction: string;
  context: ContextItem[];
  constraints: TaskConstraints;
}

export interface ContextPayload {
  items: ContextItem[];
  source: string;
}

export interface FeedbackPayload {
  messageId: string;
  rating: 'good' | 'needs_improvement' | 'retry';
  notes: string;
}

export interface ContextItem {
  type: 'memory' | 'file' | 'conversation' | 'previous_result';
  content: string;
  source: string;
  relevance: number;  // 0-1
}

export interface TaskConstraints {
  maxTokens: number;
  timeout: number;       // ms
  maxToolCalls: number;
  allowedTools: string[];
  temperature?: number;
}

// ─── Result Types ───

export interface AgentResult {
  id: string;
  messageId: string;   // Which message this responds to
  from: string;
  traceId: string;
  status: 'success' | 'error' | 'partial' | 'timeout' | 'cancelled';
  output: string;
  toolsUsed: ToolCallRecord[];
  tokensUsed: number;
  durationMs: number;
  confidence: number;   // 0-1, how confident the agent is
  error?: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
}

// ─── Factory Functions ───

export function createTaskMessage(
  from: string,
  to: string,
  instruction: string,
  options: {
    context?: ContextItem[];
    constraints?: Partial<TaskConstraints>;
    traceId?: string;
    parentId?: string;
  } = {}
): AgentMessage {
  return {
    id: randomUUID(),
    from,
    to,
    type: 'task',
    payload: {
      instruction,
      context: options.context || [],
      constraints: {
        maxTokens: 2000,
        timeout: 30_000,
        maxToolCalls: 5,
        allowedTools: [],
        ...options.constraints,
      },
    },
    traceId: options.traceId || randomUUID(),
    parentId: options.parentId,
    timestamp: new Date(),
  };
}

export function createResult(
  messageId: string,
  from: string,
  traceId: string,
  data: Partial<AgentResult>
): AgentResult {
  return {
    id: randomUUID(),
    messageId,
    from,
    traceId,
    status: 'success',
    output: '',
    toolsUsed: [],
    tokensUsed: 0,
    durationMs: 0,
    confidence: 0.5,
    ...data,
  };
}
