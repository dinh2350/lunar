import 'dotenv/config';
import { TelegramConnector } from './connector.js';
import type { InboundEnvelope } from '../../../shared/src/types.js';
import { SessionManager } from '../../../session/src/manager.js';
import { runAgent } from '../../../agent/src/runner.js';
import type { Message } from '../../../agent/src/llm/types.js';

const SYSTEM_PROMPT = `You are Lunar, a helpful personal AI assistant on Telegram.
Be concise — Telegram messages should be short and clear.
Use simple formatting. Answering questions, running commands, doing math, and remembering things.`;

const sessionManager = new SessionManager('./data/sessions');

/**
 * Handle an incoming Telegram message through the agent pipeline.
 */
async function handleMessage(envelope: InboundEnvelope): Promise<string> {
  const sessionId = sessionManager.resolveSessionId(
    envelope.provider,
    envelope.peerId,
  );

  // Load recent conversation history
  const turns = await sessionManager.loadRecentHistory(sessionId, 20);
  const history = sessionManager.toMessages(turns) as Message[];

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: envelope.text },
  ];

  // Persist user message
  await sessionManager.appendTurn(sessionId, {
    role: 'user',
    content: envelope.text,
  });

  const result = await runAgent(messages, { model: 'llama3.2', temperature: 0.7 });

  // Persist assistant response
  await sessionManager.appendTurn(sessionId, {
    role: 'assistant',
    content: result.response,
    toolCalls: result.toolCalls.map(tc => ({
      name: tc.tool,
      args: tc.args,
      result: tc.result,
    })),
  });

  return result.response;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set. Add it to .env file.');
    process.exit(1);
  }

  const connector = new TelegramConnector(token, handleMessage);
  await connector.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await connector.stop();
    process.exit(0);
  });
}

main();
