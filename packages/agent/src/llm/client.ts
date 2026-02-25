/**
 * LLM Client — talks to Ollama
 *
 * This is the lowest-level AI code in Lunar.
 * Everything else builds on top of this.
 */
import { Ollama } from 'ollama';

// Connect to Ollama running on your Mac
export const ollama = new Ollama({
  host: 'http://localhost:11434', // default Ollama port
});

/**
 * Send a message to the AI and get a response.
 *
 * @param userMessage - What the user typed
 * @returns The AI's response text
 *
 * Think of this like: fetch(apiUrl).then(r => r.json())
 * But instead of a REST API, you're calling an AI.
 */
export async function chat(userMessage: string): Promise<string> {
  const response = await ollama.chat({
    model: 'llama3.2', // which AI model to use
    messages: [
      {
        role: 'system', // developer instructions (hidden from user)
        content: 'You are Lunar, a helpful personal assistant. Be concise and friendly.',
      },
      {
        role: 'user', // what the human said
        content: userMessage,
      },
    ],
  });

  // response.message.content is the AI's text response
  return response.message.content;
}
