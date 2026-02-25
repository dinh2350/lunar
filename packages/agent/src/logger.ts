import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

export interface LogEntry {
  type: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error' | 'system';
  content: string;
  metadata?: Record<string, any>;
  ts: string;
}

export class ConversationLogger {
  private logDir: string;

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  async log(sessionId: string, entry: Omit<LogEntry, 'ts'>): Promise<void> {
    await mkdir(this.logDir, { recursive: true });

    const full: LogEntry = {
      ...entry,
      ts: new Date().toISOString(),
    };

    const filePath = path.join(this.logDir, `${sessionId}.jsonl`);
    await appendFile(filePath, JSON.stringify(full) + '\n');
  }

  async logUserMessage(sessionId: string, content: string) {
    await this.log(sessionId, { type: 'user', content });
  }

  async logAssistantMessage(sessionId: string, content: string) {
    await this.log(sessionId, { type: 'assistant', content });
  }

  async logToolCall(sessionId: string, name: string, args: any) {
    await this.log(sessionId, {
      type: 'tool_call',
      content: name,
      metadata: { args },
    });
  }

  async logToolResult(sessionId: string, name: string, result: string, success: boolean) {
    await this.log(sessionId, {
      type: 'tool_result',
      content: result.slice(0, 500),
      metadata: { name, success },
    });
  }
}
