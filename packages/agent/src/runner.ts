import { ollama } from './llm/client.js';
import type { Message, ChatOptions } from './llm/types.js';
import { getToolDefinitions, executeTool } from '../../tools/src/executor.js';
import { getPolicy, askUserApproval } from './approval.js';

const MAX_ITERATIONS = 10;
const MAX_TOOL_OUTPUT = 3000;

export interface AgentResult {
  response: string;
  toolCalls: ToolCallLog[];
  turns: number;
}

export interface ToolCallLog {
  tool: string;
  args: any;
  result: string;
  durationMs?: number;
}

export async function runAgent(
  messages: Message[],
  options?: ChatOptions,
): Promise<AgentResult> {
  const toolCallLog: ToolCallLog[] = [];
  const tools = getToolDefinitions();
  let turns = 0;

  while (turns < MAX_ITERATIONS) {
    turns++;

    // === LLM CALL WITH ERROR HANDLING ===
    let response;
    try {
      response = await ollama.chat({
        model: options?.model ?? 'llama3.2',
        messages,
        tools,
        options: {
          temperature: options?.temperature ?? 0.7,
        },
      });
    } catch (error: any) {
      return {
        response: `⚠️ LLM error: ${error.message}. Please try again.`,
        toolCalls: toolCallLog,
        turns,
      };
    }

    const toolCalls = response.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      return {
        response: response.message.content,
        toolCalls: toolCallLog,
        turns,
      };
    }

    messages.push(response.message as any);

    for (const call of toolCalls) {
      const toolName = call.function.name;
      let toolArgs: Record<string, any>;

      // Parse args safely
      try {
        toolArgs = typeof call.function.arguments === 'string'
          ? JSON.parse(call.function.arguments || '{}')
          : call.function.arguments ?? {};
      } catch {
        messages.push({
          role: 'tool',
          content: 'Error: Could not parse tool arguments as JSON.',
        });
        continue;
      }

      // === CHECK APPROVAL ===
      const policy = getPolicy(toolName, toolArgs);

      if (policy === 'deny') {
        console.log(`  ❌ DENIED: ${toolName}(${JSON.stringify(toolArgs)})`);
        messages.push({
          role: 'tool',
          content: '⛔ This action is blocked for safety. The command was not executed.',
        });
        continue;
      }

      if (policy === 'ask') {
        const approval = await askUserApproval(toolName, toolArgs);
        if (approval === 'denied') {
          console.log(`  🚫 User denied: ${toolName}`);
          messages.push({
            role: 'tool',
            content: 'User denied this tool call. Try a different approach or ask what the user wants.',
          });
          continue;
        }
      }

      // === EXECUTE WITH ERROR HANDLING ===
      console.log(`  🔧 ${toolName}(${JSON.stringify(toolArgs)})`);

      const result = await executeTool(toolName, toolArgs);

      // Truncate long results
      let output = result.result;
      if (output.length > MAX_TOOL_OUTPUT) {
        output = output.slice(0, MAX_TOOL_OUTPUT) + '\n...(truncated)';
      }

      console.log(`  📎 ${result.success ? '✅' : '❌'} ${output.slice(0, 100)}${output.length > 100 ? '...' : ''}`);

      toolCallLog.push({
        tool: toolName,
        args: toolArgs,
        result: output,
        durationMs: result.durationMs,
      });

      messages.push({
        role: 'tool',
        content: output,
      });
    }
  }

  return {
    response: `⚠️ I reached the maximum number of steps (${MAX_ITERATIONS}). Could you simplify the request?`,
    toolCalls: toolCallLog,
    turns,
  };
}
