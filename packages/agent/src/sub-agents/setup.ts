import { CoordinatorAgent } from './coordinator.js';
import { SpecialistAgent } from './specialist.js';

export function createAgentTeam(
  llmCall: (messages: any[], options: any) => Promise<any>,
  memorySearch: (query: string) => Promise<any[]>,
): CoordinatorAgent {
  const coordinator = new CoordinatorAgent(llmCall, memorySearch);

  // Register specialists
  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'writer',
    description: 'Writes, edits, and improves text content',
    systemPrompt: 'You are an expert writer. Write clear, engaging content. Be concise.',
    allowedTools: [],
    defaultConstraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 0, temperature: 0.7 },
  }, llmCall));

  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'coder',
    description: 'Writes, reviews, and debugs code',
    systemPrompt: 'You are an expert programmer. Write clean, tested, documented code.',
    allowedTools: ['read_file', 'write_file', 'run_command'],
    defaultConstraints: { maxTokens: 3000, timeout: 45_000, maxToolCalls: 10, temperature: 0.2 },
  }, llmCall));

  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'researcher',
    description: 'Searches memory and external sources for information',
    systemPrompt: 'You are a research specialist. Find and summarize relevant information.',
    allowedTools: ['search_memory', 'web_search'],
    defaultConstraints: { maxTokens: 1500, timeout: 20_000, maxToolCalls: 5, temperature: 0.3 },
  }, llmCall));

  coordinator.registerSpecialist(new SpecialistAgent({
    name: 'analyst',
    description: 'Analyzes data, extracts insights, draws conclusions',
    systemPrompt: 'You are a data analyst. Analyze information and provide clear insights.',
    allowedTools: ['search_memory'],
    defaultConstraints: { maxTokens: 2000, timeout: 30_000, maxToolCalls: 3, temperature: 0.3 },
  }, llmCall));

  return coordinator;
}
