import * as readline from 'readline';
import { OllamaProvider } from './llm/client.js';
import type { Message } from './llm/types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// The AI provider
const provider = new OllamaProvider();

// Conversation history
const messages: Message[] = [
  {
    role: 'system',
    content: 'You are Lunar, a helpful personal assistant. Be concise and friendly.',
  },
];

// Config
let temperature = 0.7;
let model = 'llama3.2';
let useStreaming = true;

/**
 * Chat with streaming — tokens appear word by word
 */
async function chatWithStreaming(userInput: string): Promise<string> {
  messages.push({ role: 'user', content: userInput });

  process.stdout.write('\nLunar: ');  // print prefix without newline

  const response = await provider.chatStream(
    messages,
    (token) => {
      process.stdout.write(token);  // ← each word appears immediately!
    },
    { model, temperature },
  );

  process.stdout.write('\n\n');  // add newline after response

  messages.push({ role: 'assistant', content: response.content });
  return response.content;
}

/**
 * Chat without streaming — full response at once
 */
async function chatWithoutStreaming(userInput: string): Promise<string> {
  messages.push({ role: 'user', content: userInput });

  console.log('Lunar is thinking...');
  const response = await provider.chat(messages, { model, temperature });

  console.log(`\nLunar: ${response.content}\n`);
  messages.push({ role: 'assistant', content: response.content });
  return response.content;
}

/**
 * Handle slash commands
 */
function handleCommand(input: string): boolean {
  const [cmd, ...args] = input.split(' ');

  switch (cmd) {
    case '/stream': {
      useStreaming = !useStreaming;
      console.log(`✅ Streaming: ${useStreaming ? 'ON' : 'OFF'}\n`);
      return true;
    }
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
    case '/models': {
      console.log(`
Available models (run "ollama pull <name>" to download):
  llama3.2        — 3B general purpose (recommended for 8GB Mac)
  qwen2.5:3b      — 3B very fast, basic tasks
  nomic-embed-text — embeddings (not for chat)
      `);
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
    case '/system': {
      const prompt = args.join(' ');
      if (!prompt) {
        console.log(`📋 System prompt: "${messages[0].content}"\n`);
        return true;
      }
      messages[0] = { role: 'system', content: prompt };
      console.log('✅ System prompt updated\n');
      return true;
    }
    case '/help': {
      console.log(`
Commands:
  /stream           Toggle streaming on/off
  /temp <0-2>       Set temperature
  /model <name>     Switch model
  /models           List available models
  /history          Show conversation size
  /clear            Clear history
  /system [text]    View or set system prompt
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
      if (useStreaming) {
        await chatWithStreaming(input);
      } else {
        await chatWithoutStreaming(input);
      }
    } catch (err: any) {
      console.error(`\n❌ ${err.message}\n`);
    }
    ask();
  });
}

console.log('╔═══════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — v0.1 (streaming mode)  ║');
console.log('║  Type /help for commands              ║');
console.log('╚═══════════════════════════════════════╝\n');

ask();
