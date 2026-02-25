import * as readline from 'readline';
import type { Message } from './llm/types.js';
import { runAgent } from './runner.js';
import { getToolDefinitions } from '../../tools/src/executor.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Conversation history
const messages: Message[] = [
  {
    role: 'system',
    content: `You are Lunar, a helpful personal AI assistant.

You have access to tools. Use them when appropriate:
- get_current_datetime: for time/date questions
- calculate: for ANY math (never do math in your head!)
- bash: execute shell commands (ls, git, node -v, etc.)
- read_file: read file contents
- list_directory: list files in a directory
- write_file: create or modify files (only when user asks)

If the user asks for something you can't do, say so honestly.
Be concise and friendly.`,
  },
];

// Runtime config
let model = 'llama3.2';
let temperature = 0.7;

async function chat(userInput: string): Promise<void> {
  messages.push({ role: 'user', content: userInput });

  const result = await runAgent(messages, { model, temperature });

  // Add assistant response to history
  messages.push({ role: 'assistant', content: result.response });

  console.log(`\nLunar: ${result.response}`);

  // Show tool usage stats
  if (result.toolCalls.length > 0) {
    console.log(`  ⚡ ${result.toolCalls.length} tool call(s) in ${result.turns} turn(s)`);
  }
  console.log('');
}

function handleCommand(input: string): boolean {
  const [cmd, ...args] = input.split(' ');

  switch (cmd) {
    case '/temp': {
      const t = parseFloat(args[0]);
      if (!isNaN(t)) { temperature = t; console.log(`✅ Temperature: ${t}\n`); }
      else console.log('Usage: /temp <0-2>  e.g. /temp 0.3\n');
      return true;
    }
    case '/model': {
      if (args[0]) { model = args[0]; console.log(`✅ Model: ${model}\n`); }
      else console.log(`Current model: ${model}\n`);
      return true;
    }
    case '/history': {
      const turns = messages.filter(m => m.role !== 'system').length;
      const tokens = messages.reduce((s, m) => s + Math.ceil(m.content.split(/\s+/).length * 1.3), 0);
      console.log(`📜 ${turns} messages, ~${tokens} tokens\n`);
      return true;
    }
    case '/clear': {
      messages.splice(1);
      console.log('🗑️  History cleared\n');
      return true;
    }
    case '/tools': {
      const tools = getToolDefinitions();
      console.log('\nAvailable tools:');
      for (const tool of tools) {
        console.log(`  🔧 ${tool.function.name} — ${tool.function.description}`);
      }
      console.log('');
      return true;
    }
    case '/help': {
      console.log(`
Commands:
  /temp <0-2>       Set temperature
  /model <name>     Switch model
  /tools            List available tools
  /history          Show conversation size
  /clear            Clear history
  /help             Show this
  exit              Quit
      `);
      return true;
    }
    default: return false;
  }
}

function ask(): void {
  rl.question('You: ', async (input) => {
    if (!input.trim()) { ask(); return; }
    if (input.toLowerCase() === 'exit') { console.log('👋'); rl.close(); return; }
    if (input.startsWith('/')) { handleCommand(input); ask(); return; }

    try {
      await chat(input);
    } catch (err: any) {
      console.error(`\n❌ ${err.message}\n`);
    }
    ask();
  });
}


console.log('╔═════════════════════════════════════════╗');
console.log('║  🌙 Lunar AI Agent — v0.2 (with tools)  ║');
console.log('║  I can check the time and do math!      ║');
console.log('╚═════════════════════════════════════════╝\n');

ask();
