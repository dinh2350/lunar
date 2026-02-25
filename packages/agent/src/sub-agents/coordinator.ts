import type { SubAgent, TaskResult, RoutingDecision } from './types.js';
import { SPECIALISTS, getSpecialist } from './specialists.js';
import { LLMClient } from '../llm-client.js';

export class CoordinatorAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Route a user message to the appropriate specialist(s)
   */
  async route(userMessage: string, conversationHistory: any[]): Promise<RoutingDecision> {
    const agentList = SPECIALISTS.map(s => 
      `- ${s.name}: ${s.description}`
    ).join('\n');

    const response = await this.llm.chat({
      model: 'qwen2.5:3b',
      messages: [
        {
          role: 'system',
          content: `You are a task coordinator. Given a user's message, decide which specialist agent(s) should handle it.

Available specialists:
${agentList}

Respond in JSON format:
{
  "pattern": "router" | "pipeline" | "parallel",
  "agents": ["agent_name"],
  "instructions": ["specific instruction for each agent"],
  "mergeStrategy": "concatenate" | "summarize" | "pick_best"
}

Rules:
- Use "router" for simple, single-domain tasks
- Use "pipeline" for multi-step tasks where order matters
- Use "parallel" for tasks with independent parts
- Most requests need just ONE agent (router pattern)
- Only use multiple agents when genuinely needed`,
        },
        ...conversationHistory.slice(-4),
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    try {
      const decision = JSON.parse(response.content);
      return {
        pattern: decision.pattern || 'router',
        agents: decision.agents || ['writer'],
        instructions: decision.instructions || [userMessage],
        mergeStrategy: decision.mergeStrategy || 'concatenate',
      };
    } catch {
      // Fallback: route to writer
      return {
        pattern: 'router',
        agents: ['writer'],
        instructions: [userMessage],
      };
    }
  }

  /**
   * Execute the routing decision
   */
  async execute(
    decision: RoutingDecision,
    userMessage: string,
  ): Promise<string> {
    switch (decision.pattern) {
      case 'router':
        return this.executeRouter(decision);
      case 'pipeline':
        return this.executePipeline(decision);
      case 'parallel':
        return this.executeParallel(decision);
    }
  }

  private async executeRouter(decision: RoutingDecision): Promise<string> {
    const agent = getSpecialist(decision.agents[0]);
    if (!agent) return 'No suitable specialist found.';

    const result = await this.runAgent(agent, decision.instructions[0]);
    return result.output;
  }

  private async executePipeline(decision: RoutingDecision): Promise<string> {
    let previousOutput = '';

    for (let i = 0; i < decision.agents.length; i++) {
      const agent = getSpecialist(decision.agents[i]);
      if (!agent) continue;

      const instruction = previousOutput
        ? `${decision.instructions[i]}\n\nPrevious step output:\n${previousOutput}`
        : decision.instructions[i];

      const result = await this.runAgent(agent, instruction);
      previousOutput = result.output;
    }

    return previousOutput;
  }

  private async executeParallel(decision: RoutingDecision): Promise<string> {
    const tasks = decision.agents.map((name, i) => {
      const agent = getSpecialist(name);
      if (!agent) return Promise.resolve({ agentName: name, success: false, output: '' } as TaskResult);
      return this.runAgent(agent, decision.instructions[i]);
    });

    const results = await Promise.all(tasks);

    // Merge results
    switch (decision.mergeStrategy) {
      case 'summarize':
        return this.summarizeResults(results);
      case 'pick_best':
        return results.sort((a, b) => b.output.length - a.output.length)[0]?.output || '';
      default: // concatenate
        return results
          .filter(r => r.success)
          .map(r => `## ${r.agentName}\n${r.output}`)
          .join('\n\n');
    }
  }

  private async runAgent(agent: SubAgent, instruction: string): Promise<TaskResult> {
    const start = Date.now();

    // Run with the agent's specific configuration
    const response = await this.llm.chat({
      model: agent.model || 'qwen2.5:3b',
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: instruction },
      ],
      temperature: agent.temperature || 0.7,
      tools: agent.tools,
    });

    return {
      agentName: agent.name,
      success: true,
      output: response.content,
      toolsUsed: response.toolCalls?.map((tc: any) => tc.name) || [],
      tokensUsed: response.usage?.total_tokens || 0,
      durationMs: Date.now() - start,
    };
  }

  private async summarizeResults(results: TaskResult[]): Promise<string> {
    const combined = results
      .filter(r => r.success)
      .map(r => `[${r.agentName}]: ${r.output}`)
      .join('\n\n');

    const summary = await this.llm.chat({
      model: 'qwen2.5:3b',
      messages: [{
        role: 'system',
        content: 'Combine the following specialist reports into a coherent summary.',
      }, {
        role: 'user',
        content: combined,
      }],
      temperature: 0.5,
    });

    return summary.content;
  }
}
