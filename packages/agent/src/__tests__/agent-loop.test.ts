import { describe, it, expect, vi } from 'vitest';

// ── Simplified agent loop for testing ──

async function runAgentLoop(
  input: string,
  llm: any,
  tools: Record<string, any>,
  opts = { maxIterations: 10 },
): Promise<string> {
  const messages: Array<{ role: string; content: string | null; toolCalls?: any[] }> = [
    { role: 'user', content: input },
  ];

  for (let i = 0; i < opts.maxIterations; i++) {
    const response = await llm(messages);

    if (response.content && !response.toolCalls?.length) {
      return response.content;
    }

    for (const call of response.toolCalls || []) {
      try {
        const result = await tools[call.name](call.args);
        messages.push({ role: 'tool', content: String(result) });
      } catch (error: any) {
        messages.push({ role: 'tool', content: `Error: ${error.message}` });
      }
    }
  }

  return 'Max iterations reached';
}

// ── Tests ──

describe('Agent Loop Integration', () => {
  it('should execute tool when LLM requests it', async () => {
    const mockLLM = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ name: 'get_weather', args: { city: 'Tokyo' } }],
      })
      .mockResolvedValueOnce({
        content: 'The weather in Tokyo is sunny, 25°C.',
        toolCalls: [],
      });

    const tools = {
      get_weather: vi.fn().mockResolvedValue('Sunny, 25°C'),
    };

    const result = await runAgentLoop('What is the weather?', mockLLM, tools);

    expect(tools.get_weather).toHaveBeenCalledWith({ city: 'Tokyo' });
    expect(result).toContain('sunny');
    expect(mockLLM).toHaveBeenCalledTimes(2);
  });

  it('should handle tool errors gracefully', async () => {
    const mockLLM = vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [{ name: 'get_weather', args: { city: 'Tokyo' } }],
      })
      .mockResolvedValueOnce({
        content: "I'm sorry, I couldn't get the weather data.",
        toolCalls: [],
      });

    const tools = {
      get_weather: vi.fn().mockRejectedValue(new Error('API down')),
    };

    const result = await runAgentLoop('What is the weather?', mockLLM, tools);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should stop after max iterations', async () => {
    const mockLLM = vi.fn().mockResolvedValue({
      content: null,
      toolCalls: [{ name: 'search', args: { q: 'test' } }],
    });

    const tools = { search: vi.fn().mockResolvedValue('no results') };

    const result = await runAgentLoop('search forever', mockLLM, tools, {
      maxIterations: 5,
    });

    expect(result).toBe('Max iterations reached');
    expect(mockLLM.mock.calls.length).toBeLessThanOrEqual(6);
  });
});
