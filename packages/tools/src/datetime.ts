import type { ToolDefinition } from './types.js';

/**
 * DateTime Tool — returns the current date and time.
 *
 * WHAT: Tells the AI the current date/time (AI doesn't know this on its own!)
 * WHEN: User asks "what time is it?", "what's today's date?", etc.
 * WHY:  LLMs have no real-time awareness — they need tools for current info
 */
export const datetimeTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_current_datetime',
    description: 'Get the current date and time. Use this when the user asks about the current time, date, or day of the week.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "Asia/Ho_Chi_Minh", "UTC"). Defaults to system timezone.',
        },
      },
      required: [],  // no required params — timezone is optional
    },
  },
};

/**
 * Execute the datetime tool.
 * This is a plain function — nothing AI-related about the execution.
 */
export function executeDatetime(args: { timezone?: string }): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: args.timezone || undefined,
  };

  return new Date().toLocaleString('en-US', options);
}
