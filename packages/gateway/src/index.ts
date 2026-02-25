import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

// Domain imports
import { VectorStore } from '../../memory/src/store.js';
import { MemoryFiles } from '../../memory/src/files.js';
import { MemoryIndexer } from '../../memory/src/indexer.js';
import { SessionManager } from '../../session/src/manager.js';
import { initializeTools } from '../../tools/src/executor.js';
import { runAgent } from '../../agent/src/runner.js';
import type { Message } from '../../agent/src/llm/types.js';
import { TelegramConnector } from '../../connectors/src/telegram/connector.js';
import type { InboundEnvelope } from '../../shared/src/types.js';

// ─── Configuration ───
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const DB_PATH = process.env.DB_PATH ?? './data/lunar-memory.sqlite';
const MEMORY_PATH = process.env.MEMORY_PATH ?? './data/workspace';
const SESSIONS_PATH = process.env.SESSIONS_PATH ?? './data/sessions';

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

// ─── Bootstrap Dependencies ───
const store = new VectorStore(DB_PATH);
const memoryFiles = new MemoryFiles(MEMORY_PATH);
const indexer = new MemoryIndexer(store, memoryFiles);
const sessionManager = new SessionManager(SESSIONS_PATH);

// Initialize memory-dependent tools
initializeTools(store, memoryFiles, indexer);

/**
 * Shared message handler for all channels.
 * Loads session, runs agent, persists turns.
 */
async function handleMessage(envelope: InboundEnvelope): Promise<string> {
  const sessionId = sessionManager.resolveSessionId(
    envelope.provider,
    envelope.peerId,
  );

  // Load recent history for context
  const turns = await sessionManager.loadRecentHistory(sessionId, 20);
  const history = sessionManager.toMessages(turns) as Message[];

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: envelope.text },
  ];

  // Persist user turn
  await sessionManager.appendTurn(sessionId, {
    role: 'user',
    content: envelope.text,
  });

  const result = await runAgent(messages, { model: 'llama3.2', temperature: 0.7 });

  // Persist assistant turn
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

// ─── Fastify Server ───
async function startGateway() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    uptime: process.uptime(),
    memory: store.getStats(),
  }));

  // HTTP Chat endpoint
  app.post<{ Body: { text: string; provider?: string; peerId?: string } }>(
    '/api/chat',
    async (request, reply) => {
      const { text, provider = 'api', peerId = 'anonymous' } = request.body ?? {};

      if (!text?.trim()) {
        return reply.code(400).send({ error: 'text is required' });
      }

      const envelope: InboundEnvelope = {
        provider: provider as any,
        peerId,
        text,
        chatType: 'direct',
        ts: new Date().toISOString(),
      };

      const response = await handleMessage(envelope);
      return { response };
    },
  );

  // WebSocket Chat
  app.get('/ws/chat', { websocket: true }, (socket) => {
    const sessionId = `session:ws-${Date.now().toString(36)}`;
    console.log(`[ws] New connection: ${sessionId}`);

    socket.send(JSON.stringify({ type: 'connected', sessionId }));

    socket.on('message', async (data: Buffer) => {
      let parsed: { type: string; text: string };
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', text: 'Invalid JSON' }));
        return;
      }

      if (parsed.type !== 'message' || !parsed.text?.trim()) return;

      socket.send(JSON.stringify({ type: 'typing', active: true }));

      try {
        const envelope: InboundEnvelope = {
          provider: 'webchat',
          peerId: sessionId,
          text: parsed.text,
          chatType: 'direct',
          ts: new Date().toISOString(),
        };

        const response = await handleMessage(envelope);
        socket.send(JSON.stringify({ type: 'typing', active: false }));
        socket.send(JSON.stringify({ type: 'response', text: response }));
      } catch (error: any) {
        socket.send(JSON.stringify({ type: 'typing', active: false }));
        socket.send(JSON.stringify({ type: 'error', text: error.message }));
      }
    });

    socket.on('close', () => {
      console.log(`[ws] Disconnected: ${sessionId}`);
    });
  });

  // Start HTTP server
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Lunar Gateway running on http://localhost:${PORT}`);
  console.log(`   📡 HTTP API: POST /api/chat`);
  console.log(`   🔌 WebSocket: ws://localhost:${PORT}/ws/chat`);
  console.log(`   ❤️  Health: GET /api/health`);

  // Start Telegram bot if token is set
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken) {
    const telegram = new TelegramConnector(telegramToken, handleMessage);
    await telegram.start();
  } else {
    console.log('   ℹ️  Telegram: skipped (no TELEGRAM_BOT_TOKEN)');
  }

  // Index memory files on startup
  console.log('\n📚 Indexing memory files...');
  const { indexed, chunks } = await indexer.indexChanged();
  if (indexed > 0) {
    console.log(`   ✅ Indexed ${chunks} chunks from ${indexed} files`);
  } else {
    console.log('   ✅ Memory index is up to date');
  }

  console.log('\n🌙 Lunar is ready!\n');
}

// ─── Graceful Shutdown ───
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  store.close();
  process.exit(0);
});

startGateway().catch((err) => {
  console.error('❌ Failed to start gateway:', err);
  process.exit(1);
});
