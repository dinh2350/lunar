import type { ToolDefinition } from './types.js';

/**
 * Calculator Tool — performs math calculations.
 *
 * WHAT: Runs mathematical expressions and returns the result
 * WHEN: User asks math questions ("what's 15% of 230?", "convert 5km to miles")
 * WHY:  LLMs are BAD at math! They predict text, not calculate numbers.
 *       2847 * 394 → LLM might get this wrong. Calculator always gets it right.
 */
export const calculatorTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Evaluate a mathematical expression. Use this for ANY math calculation. Returns the numeric result.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate, e.g., "2847 * 394" or "Math.sqrt(144)"',
        },
      },
      required: ['expression'],
    },
  },
};

/**
 * Execute the calculator.
 * Uses JavaScript's Function constructor to safely evaluate math expressions.
 * In production, you'd use a proper math parser like mathjs.
 */
export function executeCalculator(args: { expression: string }): string {
  try {
    // Basic safety: only allow math-related characters
    const sanitized = args.expression.replace(/[^0-9+\-*/().%\s,Math.sqrtpowabsceilfloorround]/g, '');
    const result = new Function(`return ${sanitized}`)();
    return `${args.expression} = ${result}`;
  } catch (error: any) {
    return `Error calculating "${args.expression}": ${error.message}`;
  }
}
