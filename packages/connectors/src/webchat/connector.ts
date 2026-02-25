import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { InboundEnvelope } from '../../../shared/src/types.js';
import type { Connector, MessageHandler } from '../types.js';

/**
 * WebSocket message protocol.
 * Client → Server: { type: 'message', text: string }
 * Server → Client: { type: 'response', text: string }
 *                   { type: 'typing', active: boolean }
 *                   { type: 'connected', sessionId: string }
 */
interface WSClientMessage {
  type: 'message';
  text: string;
}

interface WSServerMessage {
  type: 'response' | 'typing' | 'connected' | 'error';
  text?: string;
  active?: boolean;
  sessionId?: string;
}

/**
 * WebChat connector — serves a WebSocket server for browser-based chat.
 */
export class WebChatConnector implements Connector {
  readonly name = 'webchat';
  private wss: WebSocketServer | null = null;
  private handler: MessageHandler;
  private port: number;

  constructor(handler: MessageHandler, port = 18790) {
    this.handler = handler;
    this.port = port;
  }

  async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws) => {
      const sessionId = `session:${randomUUID().slice(0, 8)}`;
      console.log(`[webchat] New connection: ${sessionId}`);

      // Send connection confirmation
      this.send(ws, { type: 'connected', sessionId });

      ws.on('message', async (data) => {
        let parsed: WSClientMessage;
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          this.send(ws, { type: 'error', text: 'Invalid JSON' });
          return;
        }

        if (parsed.type !== 'message' || !parsed.text?.trim()) return;

        const envelope: InboundEnvelope = {
          provider: 'webchat',
          peerId: sessionId,
          text: parsed.text,
          chatType: 'direct',
          ts: new Date().toISOString(),
        };

        // Show typing indicator
        this.send(ws, { type: 'typing', active: true });

        try {
          const response = await this.handler(envelope);
          this.send(ws, { type: 'typing', active: false });
          this.send(ws, { type: 'response', text: response });
        } catch (error: any) {
          console.error(`[webchat] Error:`, error.message);
          this.send(ws, { type: 'typing', active: false });
          this.send(ws, { type: 'error', text: 'Something went wrong. Please try again.' });
        }
      });

      ws.on('close', () => {
        console.log(`[webchat] Disconnected: ${sessionId}`);
      });
    });

    console.log(`🌐 WebChat WebSocket server running on ws://localhost:${this.port}`);
  }

  async stop(): Promise<void> {
    if (this.wss) {
      for (const client of this.wss.clients) {
        client.close();
      }
      this.wss.close();
      console.log('🛑 WebChat server stopped');
    }
  }

  private send(ws: WebSocket, message: WSServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
