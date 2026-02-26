/**
 * Built-in help system and command handler
 */

export const HELP_TEXT = `🌙 **Lunar Help**

**Commands:**
/help — Show this message
/status — System health check
/memory — What I remember about you
/forget — Clear conversation history
/model — Current LLM model info
/tools — List available tools

**Tips:**
• Send images for vision analysis
• Send voice messages for transcription
• Ask me to remember things
• Use natural language — no special syntax needed

**Examples:**
"Summarize this article: [url]"
"Remember that my project uses React"
"What did we talk about yesterday?"
`;

export const COMMANDS: Record<string, { description: string; handler: () => string }> = {
  '/help': {
    description: 'Show help message',
    handler: () => HELP_TEXT,
  },
  '/status': {
    description: 'System health check',
    handler: () => '🟢 Lunar is running. All systems operational.',
  },
  '/memory': {
    description: 'Show what I remember',
    handler: () => "I'll search my memory for information about you...",
  },
  '/forget': {
    description: 'Clear conversation history',
    handler: () => '🗑️ Conversation history cleared. Starting fresh!',
  },
  '/model': {
    description: 'Current LLM model info',
    handler: () => '🤖 Currently using: llama3.2:3b via Ollama (local)',
  },
  '/tools': {
    description: 'List available tools',
    handler: () =>
      [
        '🔧 **Available Tools:**',
        '• calculator — Math calculations',
        '• datetime — Date and time info',
        '• filesystem — Read/write files',
        '• bash — Run shell commands',
        '• memory_search — Search memories',
        '• memory_write — Save memories',
      ].join('\n'),
  },
};

export function isCommand(message: string): boolean {
  return message.startsWith('/') && message.split(' ')[0] in COMMANDS;
}

export function handleCommand(message: string): string | null {
  const cmd = message.split(' ')[0];
  const command = COMMANDS[cmd];
  return command ? command.handler() : null;
}

// ── Contextual Help ──

export function getContextualHelp(lastError?: string): string {
  if (lastError === 'tool_not_found') {
    return "I don't have that tool. Type /tools to see what's available.";
  }
  if (lastError === 'memory_empty') {
    return "I don't have memories yet. Tell me things to remember!";
  }
  if (lastError === 'rate_limited') {
    return "I'm being rate limited. Wait a moment and try again.";
  }
  return 'Type /help for a list of commands.';
}

// ── Keyboard Shortcuts (for Web UI) ──

export const KEYBOARD_SHORTCUTS = {
  'Ctrl+/': 'Toggle help panel',
  'Ctrl+K': 'Focus search / command palette',
  'Ctrl+N': 'New conversation',
  Escape: 'Close panel / cancel',
  'Up Arrow': 'Edit last message (when input empty)',
} as const;
