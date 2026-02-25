import { readFile, appendFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * One turn in a conversation: user message, assistant reply, and any tool calls.
 */
export interface SessionTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { name: string; args: any; result: string }[];
  ts: string;
}

export interface SessionMeta {
  sessionId: string;
  turns: number;
  lastActive: string;
}

/**
 * Manages persistent conversation sessions stored as JSONL files.
 * Each line in a .jsonl file is one SessionTurn.
 * Append-only — never delete or modify existing lines.
 */
export class SessionManager {
  private basePath: string;

  constructor(basePath = './data/sessions') {
    this.basePath = basePath;
  }

  /**
   * Build a deterministic session ID from provider + peer info.
   * Format: agent:{agentId}:{provider}:{peerId}
   */
  resolveSessionId(
    provider: string,
    peerId: string,
    agentId = 'main',
  ): string {
    return `agent:${agentId}:${provider}:${peerId}`;
  }

  /**
   * Load entire conversation history for a session.
   */
  async loadHistory(sessionId: string): Promise<SessionTurn[]> {
    const filePath = this.sessionFilePath(sessionId);
    if (!existsSync(filePath)) return [];

    const content = await readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.length > 0);

    const turns: SessionTurn[] = [];
    for (const line of lines) {
      try {
        turns.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
    return turns;
  }

  /**
   * Load only the most recent N turns (for LLM context window).
   */
  async loadRecentHistory(
    sessionId: string,
    maxTurns = 20,
  ): Promise<SessionTurn[]> {
    const all = await this.loadHistory(sessionId);
    return all.slice(-maxTurns);
  }

  /**
   * Append a single turn to the session file.
   */
  async appendTurn(sessionId: string, turn: Omit<SessionTurn, 'ts'>): Promise<void> {
    await mkdir(this.basePath, { recursive: true });

    const full: SessionTurn = {
      ...turn,
      ts: new Date().toISOString(),
    };

    const filePath = this.sessionFilePath(sessionId);
    await appendFile(filePath, JSON.stringify(full) + '\n');
  }

  /**
   * Convert session turns into LLM Message format.
   */
  toMessages(turns: SessionTurn[]): { role: string; content: string }[] {
    return turns
      .filter(t => t.role === 'user' || t.role === 'assistant')
      .map(t => ({
        role: t.role,
        content: t.content,
      }));
  }

  /**
   * List all saved sessions with metadata.
   */
  async listSessions(): Promise<SessionMeta[]> {
    if (!existsSync(this.basePath)) return [];

    const files = await readdir(this.basePath);
    const sessions: SessionMeta[] = [];

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const sessionId = file.replace('.jsonl', '').replace(/-/g, ':');
      const turns = await this.loadHistory(sessionId);
      const lastTurn = turns[turns.length - 1];

      sessions.push({
        sessionId,
        turns: turns.length,
        lastActive: lastTurn?.ts ?? 'unknown',
      });
    }

    return sessions;
  }

  /**
   * Sanitize session ID for use as filename (replace : with -).
   */
  private sessionFilePath(sessionId: string): string {
    const safeName = sessionId.replace(/:/g, '-');
    return path.join(this.basePath, `${safeName}.jsonl`);
  }
}
