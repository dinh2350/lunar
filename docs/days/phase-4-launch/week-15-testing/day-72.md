# Day 72 — E2E Testing + CI Pipeline

> 🎯 **DAY GOAL:** Build end-to-end tests that verify the complete user experience, and set up CI to run tests on every push

---

## 📚 CONCEPT 1: E2E Tests for AI Agents

### WHAT — Test the Complete Flow

```
E2E TEST = Simulated user interaction through the FULL system

USER INPUT ──▶ Gateway ──▶ Agent ──▶ Tools ──▶ Memory ──▶ Response

E2E tests verify:
  1. User sends message → gets meaningful response
  2. Memory saves → can be retrieved later
  3. Tool calls work → results included in response
  4. Multi-turn conversations maintain context
  5. Error scenarios return helpful messages
```

---

## 🔨 HANDS-ON: Build E2E Tests + CI

### Step 1: E2E Test Framework (20 minutes)

Create `packages/agent/src/__tests__/e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Simulate a full conversation
class TestClient {
  private conversationId: string;
  private history: Array<{ role: string; content: string }> = [];
  private agentHandle: (messages: any[]) => Promise<string>;

  constructor(agentHandle: (messages: any[]) => Promise<string>) {
    this.conversationId = `test-${Date.now()}`;
    this.agentHandle = agentHandle;
  }

  async send(message: string): Promise<string> {
    this.history.push({ role: 'user', content: message });
    const response = await this.agentHandle([...this.history]);
    this.history.push({ role: 'assistant', content: response });
    return response;
  }
}

describe('E2E: Complete Conversation Flows', () => {
  let client: TestClient;

  beforeAll(() => {
    // Setup with mock agent (in real tests, use actual agent with test config)
    client = new TestClient(async (messages) => {
      const last = messages[messages.length - 1].content;
      if (last.includes('remember')) return "I'll remember that for you.";
      if (last.includes('what did I')) return "You mentioned you like TypeScript.";
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
      if (messages.length > 2) return "You said hello earlier!";
      return "Hi there!";
    });

    await client2.send('Hello');
    const response = await client2.send('What did I just say?');
    expect(response).toContain('hello');
  });

  it('should handle memory save + recall', async () => {
    const r1 = await client.send('Please remember that I like TypeScript');
    expect(r1.toLowerCase()).toContain('remember');

    const r2 = await client.send('What did I tell you?');
    expect(r2.toLowerCase()).toContain('typescript');
  });
});

describe('E2E: Error Handling', () => {
  it('should handle empty messages gracefully', async () => {
    const client = new TestClient(async () => "Could you say that again?");
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
```

### Step 2: GitHub Actions CI (20 minutes)

Create `.github/workflows/ci.yml`:

```yaml
name: Lunar CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm -r exec tsc --noEmit
      
      - name: Lint
        run: pnpm -r exec eslint src/
      
      - name: Unit tests
        run: pnpm vitest run --coverage
      
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
  
  eval:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install eval dependencies
        run: pip install -r eval/requirements.txt
      
      - name: Run eval suite
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: python eval/run_eval.py --output eval-results.json
      
      - name: Check quality gate
        run: python eval/quality_gate.py eval-results.json --min-score 0.7
```

### Step 3: Add package.json Scripts (10 minutes)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --include='**/*.e2e.test.ts'",
    "lint": "eslint packages/*/src/",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "ci": "pnpm typecheck && pnpm lint && pnpm test"
  }
}
```

---

## ✅ CHECKLIST

- [ ] E2E test client simulates full conversations
- [ ] Multi-turn context tests
- [ ] Memory save/recall E2E test
- [ ] Error handling tests (empty, long messages)
- [ ] GitHub Actions CI workflow
- [ ] Type checking in CI
- [ ] Linting in CI
- [ ] Unit tests with coverage in CI
- [ ] Eval suite runs on main branch pushes
- [ ] Quality gate blocks deployment if score too low

---

## 💡 KEY TAKEAWAY

**CI is your safety net. Every push runs: type check → lint → unit tests → (on main) eval suite with quality gate. E2E tests verify the complete user experience, not just individual functions. Mock the LLM for fast, deterministic CI tests. Run real LLM evals only on main branch to save costs. If eval score drops below threshold, the quality gate fails the pipeline.**

---

**Next → [Day 73: Performance Optimization](day-73.md)**
