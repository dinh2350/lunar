/**
 * CLI Chat — talk to Lunar in your terminal
 *
 * This is a simple REPL (Read-Eval-Print Loop).
 *
 * How it works:
 *   1. Show prompt "You: "
 *   2. Wait for user to type something
 *   3. Send to AI
 *   4. Print AI's response
 *   5. Go back to step 1
 */
import * as readline from 'readline';
import { chat } from './llm/client.js';

// readline = Node.js built-in for reading terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Ask one question, print the answer, repeat.
 */
function askQuestion(): void {
  rl.question('You: ', async (input: string) => {
    // Let user exit gracefully
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('Goodbye! 👋');
      rl.close();
      return;
    }

    // Skip empty input
    if (!input.trim()) {
      askQuestion();
      return;
    }

    try {
      // Call the AI — this is where the magic happens
      console.log('Lunar is thinking...');
      const answer = await chat(input);
      console.log(`\nLunar: ${answer}\n`);
    } catch (error) {
      // If Ollama is not running, show a helpful error
      console.error('\n❌ Error: Could not reach Ollama.');
      console.error('   Make sure Ollama is running: ollama serve\n');
    }

    // Ask the next question (the REPL loop)
    askQuestion();
  });
}

// Start the REPL
console.log('╔════════════════════════════════════╗');
console.log('║  🌙 Lunar AI — Personal Assistant  ║');
console.log('║  Type "exit" to quit               ║');
console.log('╚════════════════════════════════════╝');
console.log('');

askQuestion();
