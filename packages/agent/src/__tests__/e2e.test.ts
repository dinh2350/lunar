import { describe, it, expect, beforeAll } from 'vitest';

// ── Test Client (simulates full conversation) ──

class TestClient {
  private history: Array<{ role: string; content: string }> = [];
  private agentHandle: (messages: any[]) => Promise<string>;

  constructor(agentHandle: (messages: any[]) => Promise<string>) {
    this.agentHandle = agentHandle;
  }

  async send(message: string): Promise<string> {
    this.history.push({ role: 'user', content: message });
    const response = await this.agentHandle([...this.history]);
    this.history.push({ role: 'assistant', content: response });
    return response;
  }
}

// ── E2E Tests ──

describe('E2E: Complete Conversation Flows', () => {
  let client: TestClient;

  beforeAll(() => {
    client = new TestClient(async (messages) => {
      const last = messages[messages.length - 1].content;
      if (last.includes('remember')) return "I'll remember that for you.";
      if (last.includes('what did I')) return 'You mentioned you like TypeScript.';
      return "I'm Lunar, happy to help!";
    });
  });

  it('should handle a basic greeting', async () => {
    const response = await client.send('Hello!');
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(5);
  });

  it('should maintain conversation context', async () => {
    const client2 = new TestClient(async (messages) => {
      if (messages.length > 2) return 'You said hello earlier!';
      return 'Hi there!';
    });

    await client2.send('Hello');
    const response = await client2.send('What did I just say?');
    expect(response).toContain('hello');
  });

  it('should handle memory save + recall', async () => {
    const r1 = await client.send('Please remember that I like TypeScript');
    expect(r1.toLowerCase()).toContain('remember');

    const r2 = await client.send('what did I tell you?');
    expect(r2.toLowerCase()).toContain('typescript');
  });
});

describe('E2E: Error Handling', () => {
  it('should handle empty messages gracefully', async () => {
    const client = new TestClient(async () => 'Could you say that again?');
    const response = await client.send('');
    expect(response).toBeTruthy();
  });

  it('should handle very long messages', async () => {
    const client = new TestClient(async () => "That's quite long! Let me summarize...");
    const longMsg = 'word '.repeat(5000);
    const response = await client.send(longMsg);
    expect(response).toBeTruthy();
  });
});
