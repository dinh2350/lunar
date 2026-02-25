export interface SubAgent {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];       // Tool names this agent can use
  model?: string;        // Optional: different model per agent
  temperature?: number;
}

export interface TaskResult {
  agentName: string;
  success: boolean;
  output: string;
  toolsUsed: string[];
  tokensUsed: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface RoutingDecision {
  pattern: 'router' | 'pipeline' | 'parallel';
  agents: string[];            // Which agents to use
  instructions: string[];      // What to tell each agent
  mergeStrategy?: 'concatenate' | 'summarize' | 'pick_best';
}
