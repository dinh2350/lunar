/**
 * ═══════════════════════════════════════════════════════
 *  THE AGENT LOOP — The Core of AI Engineering
 * ═══════════════════════════════════════════════════════
 *
 * WHAT: A while loop that makes the AI think, use tools, and respond
 * WHY:  This turns a chatbot into an agent that can DO things
 * HOW:
 *   1. Send messages to AI
 *   2. If AI wants tools → execute them → add results → loop back
 *   3. If AI has text → return it (done!)
 *
 * This ~30-line function is the same pattern used by:
 * - ChatGPT (OpenAI)
 * - Claude (Anthropic)
 * - Every AI agent framework (LangChain, CrewAI, etc.)
 */

import { ollama } from './llm/client.js';
import type { Message, ChatOptions } from './llm/types.js';
import { getToolDefinitions, executeTool } from '../../tools/src/executor.js';

/** Maximum number of tool-calling turns to prevent infinite loops */
const MAX_ITERATIONS = 10;

export interface AgentResult {
  response: string;         // final text response
  toolCalls: ToolCallLog[]; // what tools were used
  turns: number;            // how many turns the loop ran
}

export interface ToolCallLog {
  tool: string;
  args: any;
  result: string;
  durationMs?: number;
}

/**
 * Run the agent loop.
 *
 * @param messages - Conversation history (including system prompt + user message)
 * @param options  - LLM options (model, temperature)
 * @returns AgentResult with the final response and tool call log
 */
export async function runAgent(
  messages: Message[],
  options?: ChatOptions,
): Promise<AgentResult> {
  const toolCallLog: ToolCallLog[] = [];
  const tools = getToolDefinitions();
  let turns = 0;

  // ═══════════════════════════════════════
  //  THE LOOP — keep going until AI is done
  // ═══════════════════════════════════════
  while (turns < MAX_ITERATIONS) {
    turns++;

    // Step 1: Send everything to the AI
    const response = await ollama.chat({
      model: options?.model ?? 'llama3.2',
      messages,
      tools,   // ← tell AI what tools are available
      options: {
        temperature: options?.temperature ?? 0.7,
      },
    });

    // Step 2: Check — does the AI want to call tools?
    const toolCalls = response.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // ──── NO TOOL CALLS → AI is done, return the text response ────
      return {
        response: response.message.content,
        toolCalls: toolCallLog,
        turns,
      };
    }

    // ──── YES TOOL CALLS → Execute each tool ────

    // Save AI's decision (the tool_calls message) in message history
    messages.push(response.message as any);

    for (const call of toolCalls) {
      const toolName = call.function.name;
      const toolArgs = call.function.arguments;

      // Log what's happening (visible in CLI)
      console.log(`  🔧 Tool: ${toolName}(${JSON.stringify(toolArgs)})`);

      // Execute the tool
      const result = await executeTool(toolName, toolArgs);

      // Log the result
      console.log(`  📎 Result: ${result.result.slice(0, 100)}${result.result.length > 100 ? '...' : ''}`);

      // Record in tool call log
      toolCallLog.push({
        tool: toolName,
        args: toolArgs,
        result: result.result,
        durationMs: result.durationMs,
      });

      // Add tool result to messages so AI can see it on the next turn
      messages.push({
        role: 'tool',
        content: result.result,
      });
    }

    // Loop back to Step 1 → AI now sees the tool results
    // and decides: call more tools? or respond with text?
  }

  // Safety: if we hit max iterations, return what we have
  return {
    response: 'I seem to be stuck in a loop. Let me stop here.',
    toolCalls: toolCallLog,
    turns,
  };
}
