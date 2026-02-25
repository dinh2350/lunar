/**
 * CLI Chat — talk to Lunar in your terminal
 *
 * Day 4 upgrade: full conversation HISTORY.
 * The messages array grows with every turn — the AI reads
 * the ENTIRE array on each request, so it "remembers" everything.
 *
 * How it works:
 *   1. User types something
 *   2. Push user message → messages array
 *   3. Send ENTIRE messages array to Ollama
 *   4. Push AI reply → messages array
 *   5. Print reply, repeat
 */
import * as readline from 'readline';
import { ollama } from './llm/client.js';
import type { Message } from './llm/types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ══════════════════════════════════════════════
//  The conversation history — THIS IS THE KEY!
//  Every new message gets pushed to this array.
//  Every API call sends the ENTIRE array.
// ══════════════════════════════════════════════
const messages: Message[] = [
  {
    role: 'system',
    content: `You are Lunar, a helpful personal AI assistant.
Be concise and friendly. If you don't know something, say so honestly.
When asked to code, use TypeScript.`,
  },
];

// Runtime config
let model = 'llama3.2';
let temperature = 0.7;

/**
 * Send the full conversation to the AI and get a response.
 * The AI reads ALL messages from the beginning every time.
 */
async function chat(userInput: string): Promise<string> {
  // Step 1: Add user's message to history
  messages.push({ role: 'user', content: userInput });

  // Step 2: Send ENTIRE history to AI
  const response = await ollama.chat({
    model,
    messages,        // ← the whole conversation, every time
    options: { temperature },
  });

  // Step 3: Add AI's response to history (so next turn it "remembers" this too)
  const reply = response.message.content;
  messages.push({ role: 'assistant', content: reply });

  return reply;
}

/**
 * Handle slash commands.
 * Returns true if the input was a command, false if it's a regular message.
 */
function handleCommand(input: string): boolean {
  const parts = input.trim().split(' ');
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/temp': {
      const t = parseFloat(parts[1]);
      if (isNaN(t) || t < 0 || t > 2) {
        console.log('Usage: /temp <0-2>  e.g. /temp 0.3\n');
        return true;
      }
      temperature = t;
      console.log(`✅ Temperature: ${t}\n`);
      return true;
    }

    case '/model': {
      if (!parts[1]) { console.log('Usage: /model <name>  e.g. /model qwen2.5:3b\n'); return true; }
      model = parts[1];
      console.log(`✅ Model: ${model}\n`);
      return true;
    }

    case '/history': {
      // Count words across all messages as a rough token estimate (1 word ≈ 1.3 tokens)
      const wordCount = messages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);
      const estTokens = Math.round(wordCount * 1.3);
      console.log(`\n📜 Conversation: ${messages.length} messages`);
      console.log(`   Estimated tokens: ~${estTokens} / 128,000\n`);
      return true;
    }

    case '/clear': {
      // Keep only the system prompt at index 0
      messages.splice(1);
      console.log('🗑️  Conversation cleared (system prompt kept)\n');
      return true;
    }

    case '/system': {
      const prompt = parts.slice(1).join(' ');
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
  /temp <0-2>       Set temperature (0=precise, 1=creative)
  /model <name>     Switch model  (e.g. qwen2.5:3b)
  /history          Show conversation size + estimated tokens
  /clear            Clear history (keeps system prompt)
  /system [text]    View or set system prompt
  /help             Show this help
  exit              Quit
`);
      return true;
    }

    default:
      return false;
  }
}

function askQuestion(): void {
  rl.question('You: ', async (input: string) => {
    if (!input.trim()) { askQuestion(); return; }
    if (input.toLowerCase() === 'exit') { console.log('👋 Goodbye!'); rl.close(); return; }
    if (input.startsWith('/')) { handleCommand(input); askQuestion(); return; }

    try {
      const reply = await chat(input);
      console.log(`\nLunar: ${reply}\n`);
    } catch (err: any) {
      console.error(`❌ ${err.message}\n`);
    }

    askQuestion();
  });
}

console.log('╔════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — Personal Assistant  ║');
console.log('║  Now with conversation memory!     ║');
console.log('╚════════════════════════════════════╝\n');

askQuestion();
