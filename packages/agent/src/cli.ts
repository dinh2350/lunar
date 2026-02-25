import * as readline from 'readline';
import type { Message } from './llm/types.js';
import { runAgent } from './runner.js';
import { getToolDefinitions } from '../../tools/src/executor.js';
import { SessionManager } from '../../session/src/manager.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SYSTEM_PROMPT = `You are Lunar, a helpful personal AI assistant.

## YOUR CAPABILITIES
- You have a knowledge base searchable via the memory_search tool
- You can execute shell commands, read files, and get the current time
- You remember conversation context within this session

## RULES
1. When the user asks about topics that might be in your knowledge base,
   ALWAYS use memory_search FIRST before answering.
2. Base your answers on the search results. Quote relevant sections.
3. If search returns no results, honestly say:
   "I don't have information about that in my knowledge base."
4. Never invent facts, statistics, or details not found in search results.
5. For general knowledge questions (math, common facts), answer directly.

## TOOLS
- get_current_datetime: for time/date questions
- calculate: for ANY math (never do math in your head!)
- bash: execute shell commands (ls, git, node -v, etc.)
- read_file: read file contents
- list_directory: list files in a directory
- write_file: create or modify files (only when user asks)
- memory_search: search knowledge base for information
- memory_write: save important info to memory for future retrieval

Be concise and helpful.`;

// Session management
const sessionManager = new SessionManager('./data/sessions');
const SESSION_ID = sessionManager.resolveSessionId('cli', 'local');

// Conversation history
const messages: Message[] = [
  { role: 'system', content: SYSTEM_PROMPT },
];

// Runtime config
let model = 'llama3.2';
let temperature = 0.7;

async function loadPreviousSession(): Promise<void> {
  const turns = await sessionManager.loadRecentHistory(SESSION_ID, 20);
  if (turns.length > 0) {
    const restored = sessionManager.toMessages(turns);
    messages.push(...(restored as Message[]));
    console.log(`📂 Restored ${turns.length} turns from previous session\n`);
  }
}

async function chat(userInput: string): Promise<void> {
  messages.push({ role: 'user', content: userInput });

  // Persist user message
  await sessionManager.appendTurn(SESSION_ID, { role: 'user', content: userInput });

  const result = await runAgent(messages, { model, temperature });

  // Add assistant response to history
  messages.push({ role: 'assistant', content: result.response });

  // Persist assistant message (with tool calls)
  await sessionManager.appendTurn(SESSION_ID, {
    role: 'assistant',
    content: result.response,
    toolCalls: result.toolCalls.map(tc => ({
      name: tc.tool,
      args: tc.args,
      result: tc.result,
    })),
  });

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
      console.log('🗑️  History cleared (session file preserved)\n');
      return true;
    }
    case '/sessions': {
      sessionManager.listSessions().then(sessions => {
        if (sessions.length === 0) {
          console.log('No saved sessions.\n');
        } else {
          console.log('\nSaved sessions:');
          for (const s of sessions) {
            const active = s.sessionId === SESSION_ID ? ' (current)' : '';
            console.log(`  📝 ${s.sessionId}${active} — ${s.turns} turns, last: ${s.lastActive}`);
          }
          console.log('');
        }
      });
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
  /sessions         List saved sessions
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

// Load previous session before starting
loadPreviousSession().then(() => ask());
