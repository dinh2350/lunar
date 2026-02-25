import type { AgentMessage, AgentResult } from './protocol.js';
import { createTaskMessage, createResult } from './protocol.js';
import { SpecialistAgent } from './specialist.js';
import { ExecutionTracker } from './tracker.js';
import { ContextBuilder } from './context-builder.js';

interface DelegationPlan {
  pattern: 'router' | 'pipeline' | 'parallel';
  steps: DelegationStep[];
}

interface DelegationStep {
  agent: string;
  instruction: string;
  dependsOn?: string[];    // agent names this step needs results from
}

export class CoordinatorAgent {
  private specialists = new Map<string, SpecialistAgent>();
  private tracker: ExecutionTracker;
  private contextBuilder: ContextBuilder;
  private plannerLlm: (messages: any[], options: any) => Promise<any>;

  constructor(
    plannerLlm: (messages: any[], options: any) => Promise<any>,
    memorySearch: (query: string) => Promise<any[]>,
  ) {
    this.plannerLlm = plannerLlm;
    this.tracker = new ExecutionTracker();
    this.contextBuilder = new ContextBuilder(memorySearch);
  }

  registerSpecialist(agent: SpecialistAgent): void {
    this.specialists.set(agent.name, agent);
  }

  /**
   * Main entry: handle a user request by planning + delegating
   */
  async handle(
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<string> {
    // 1. Plan how to handle this request
    const plan = await this.planDelegation(userMessage);

    if (!plan) {
      // Simple query — handle directly
      return this.handleDirectly(userMessage, conversationHistory);
    }

    // 2. Execute the plan
    const traceId = crypto.randomUUID();
    const results = await this.executePlan(plan, traceId, conversationHistory);

    // 3. Synthesize final response from agent results
    const finalResponse = await this.synthesize(userMessage, results);

    // 4. Log trace for debugging
    console.log(this.tracker.formatTrace(traceId));

    return finalResponse;
  }

  /**
   * Decide which agents to use and in what pattern
   */
  private async planDelegation(userMessage: string): Promise<DelegationPlan | null> {
    const agentDescriptions = [...this.specialists.entries()]
      .map(([name, agent]) => `- ${name}: ${agent.description}`)
      .join('\n');

    const response = await this.plannerLlm([
      {
        role: 'system',
        content: `You are a task planner. Given a user request and available agents, decide:
1. Can this be handled directly (no delegation needed)? → respond: {"delegate": false}
2. Should one agent handle it? → respond: {"delegate": true, "pattern": "router", "steps": [{"agent": "name", "instruction": "..."}]}
3. Should multiple agents work in sequence? → respond: {"delegate": true, "pattern": "pipeline", "steps": [{"agent": "name", "instruction": "...", "dependsOn": []}]}
4. Should multiple agents work in parallel? → respond: {"delegate": true, "pattern": "parallel", "steps": [...]}

Available agents:
${agentDescriptions}

RESPOND WITH JSON ONLY.`,
      },
      { role: 'user', content: userMessage },
    ], { temperature: 0 });

    try {
      const plan = JSON.parse(response.content);
      if (!plan.delegate) return null;
      return plan as DelegationPlan;
    } catch {
      return null; // Failed to parse — handle directly
    }
  }

  /**
   * Execute a delegation plan
   */
  private async executePlan(
    plan: DelegationPlan,
    traceId: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();

    switch (plan.pattern) {
      case 'router': {
        // Single agent handles it
        const step = plan.steps[0];
        const result = await this.delegate(
          step.agent, step.instruction, traceId, { conversationHistory }
        );
        results.set(step.agent, result);
        break;
      }

      case 'pipeline': {
        // Sequential — each agent gets previous results
        for (const step of plan.steps) {
          const previousResults = step.dependsOn?.map(dep => ({
            agent: dep,
            output: results.get(dep)?.output || '',
          }));

          const result = await this.delegate(
            step.agent, step.instruction, traceId,
            { conversationHistory, previousResults }
          );
          results.set(step.agent, result);

          // Stop pipeline if a step fails
          if (result.status === 'error') break;
        }
        break;
      }

      case 'parallel': {
        // All agents work simultaneously
        const promises = plan.steps.map(step =>
          this.delegate(step.agent, step.instruction, traceId, { conversationHistory })
            .then(result => [step.agent, result] as const)
        );

        const settled = await Promise.allSettled(promises);
        for (const item of settled) {
          if (item.status === 'fulfilled') {
            results.set(item.value[0], item.value[1]);
          }
        }
        break;
      }
    }

    return results;
  }

  /**
   * Delegate a task to a specific specialist
   */
  private async delegate(
    agentName: string,
    instruction: string,
    traceId: string,
    options: {
      conversationHistory?: Array<{ role: string; content: string }>;
      previousResults?: Array<{ agent: string; output: string }>;
    } = {}
  ): Promise<AgentResult> {
    const specialist = this.specialists.get(agentName);
    if (!specialist) {
      return createResult('unknown', agentName, traceId, {
        status: 'error',
        error: `Agent "${agentName}" not found`,
      });
    }

    // Build context for the specialist
    const context = await this.contextBuilder.buildContext(instruction, options);

    // Create structured message
    const message = createTaskMessage('coordinator', agentName, instruction, {
      context: context,
      traceId,
    });

    // Track and execute
    this.tracker.startStep(message);
    const result = await specialist.execute(message);
    this.tracker.completeStep(result);

    return result;
  }

  /**
   * Combine multiple agent results into one response
   */
  private async synthesize(
    originalRequest: string,
    results: Map<string, AgentResult>,
  ): Promise<string> {
    if (results.size === 1) {
      const [, result] = [...results.entries()][0];
      return result.output;
    }

    const agentOutputs = [...results.entries()]
      .map(([name, result]) => `[${name} — ${result.status}]: ${result.output}`)
      .join('\n\n---\n\n');

    const response = await this.plannerLlm([
      {
        role: 'system',
        content: 'Combine multiple agent outputs into a single coherent response for the user. Do not mention agents or internal details.',
      },
      {
        role: 'user',
        content: `Original request: ${originalRequest}\n\nAgent outputs:\n${agentOutputs}`,
      },
    ], { temperature: 0.3 });

    return response.content;
  }

  private async handleDirectly(
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const response = await this.plannerLlm([
      { role: 'system', content: 'You are a helpful AI assistant.' },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message },
    ], { temperature: 0.7 });

    return response.content;
  }
}
