/**
 * CLI Chat — talk to Lunar in your terminal
 *
 * This is a simple REPL (Read-Eval-Print Loop) with slash commands.
 *
 * How it works:
 *   1. Show prompt "You: "
 *   2. If input starts with / → handle as command
 *   3. Otherwise → send to AI
 *   4. Print AI's response
 *   5. Go back to step 1
 */
import * as readline from 'readline';
import { chat, CODE_CONFIG, CREATIVE_CONFIG, FACTUAL_CONFIG } from './llm/client.js';
import type { LLMConfig } from './llm/client.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Current configuration (can be changed at runtime via slash commands)
let currentConfig: Partial<LLMConfig> = {};
let currentSystemPrompt = 'You are Lunar, a helpful personal assistant. Be concise.';

/**
 * Handle slash commands like /temp, /model, /preset
 * Returns true if the input was a command, false if it's a regular message.
 */
function handleCommand(input: string): boolean {
  const parts = input.split(' ');
  const command = parts[0].toLowerCase();

  switch (command) {
    case '/temp':
    case '/temperature': {
      const temp = parseFloat(parts[1]);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        console.log('Usage: /temp <0-2>  (e.g., /temp 0.7)\n');
        return true;
      }
      currentConfig.temperature = temp;
      console.log(`✅ Temperature set to ${temp}\n`);
      return true;
    }

    case '/model': {
      const model = parts[1];
      if (!model) {
        console.log('Usage: /model <name>  (e.g., /model qwen2.5:3b)\n');
        return true;
      }
      currentConfig.model = model;
      console.log(`✅ Model switched to ${model}\n`);
      return true;
    }

    case '/preset': {
      const preset = parts[1]?.toLowerCase();
      switch (preset) {
        case 'code':
          currentConfig = { ...CODE_CONFIG };
          console.log('✅ Preset: CODE (temp=0.1, precise)\n');
          break;
        case 'creative':
          currentConfig = { ...CREATIVE_CONFIG };
          console.log('✅ Preset: CREATIVE (temp=1.0, varied)\n');
          break;
        case 'factual':
          currentConfig = { ...FACTUAL_CONFIG };
          console.log('✅ Preset: FACTUAL (temp=0, deterministic)\n');
          break;
        default:
          console.log('Usage: /preset <code|creative|factual>\n');
      }
      return true;
    }

    case '/system': {
      const newPrompt = parts.slice(1).join(' ');
      if (!newPrompt) {
        console.log(`Current system prompt: "${currentSystemPrompt}"\n`);
        return true;
      }
      currentSystemPrompt = newPrompt;
      console.log('✅ System prompt updated\n');
      return true;
    }

    case '/config': {
      const effective = { model: 'llama3.2', temperature: 0.7, maxTokens: 2048, ...currentConfig };
      console.log('Current config:', effective);
      console.log(`System prompt: "${currentSystemPrompt}"\n`);
      return true;
    }

    case '/help': {
      console.log(`
Available commands:
  /temp <0-2>                      Set temperature (0=precise, 1=creative)
  /model <name>                    Switch AI model (e.g., qwen2.5:3b)
  /preset <code|creative|factual>  Use preconfigured settings
  /system <prompt>                 Change system prompt
  /config                          Show current settings
  /help                            Show this help
  exit                             Quit
`);
      return true;
    }

    default:
      return false; // not a command — treat as regular message
  }
}

function askQuestion(): void {
  rl.question('You: ', async (input: string) => {
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('Goodbye! 👋');
      rl.close();
      return;
    }

    if (!input.trim()) { askQuestion(); return; }

    // Check if it's a slash command
    if (input.startsWith('/')) {
      handleCommand(input);
      askQuestion();
      return;
    }

    try {
      console.log('Lunar is thinking...');
      const answer = await chat(input, currentSystemPrompt, currentConfig);
      console.log(`\nLunar: ${answer}\n`);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }

    askQuestion();
  });
}

// Start
console.log('╔════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — Personal Assistant  ║');
console.log('║  Type /help for commands           ║');
console.log('╚════════════════════════════════════╝\n');

askQuestion();
