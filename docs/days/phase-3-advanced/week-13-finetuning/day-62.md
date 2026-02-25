# Day 62 — Training Data Preparation

> 🎯 **DAY GOAL:** Build a pipeline to create, clean, and format training data from Lunar's conversation logs

---

## 📚 CONCEPT 1: Training Data Quality

### WHAT — Garbage In, Garbage Out

**Your fine-tuned model is only as good as your training data. Preparing high-quality training examples is 80% of the fine-tuning work.**

```
TRAINING DATA PIPELINE:
  Raw Logs ──▶ Filter ──▶ Clean ──▶ Format ──▶ Validate ──▶ Split ──▶ Train

  1. COLLECT   — Gather conversations from Lunar's JSONL logs
  2. FILTER    — Keep only good interactions (user rated well, task completed)
  3. CLEAN     — Remove PII, fix formatting, normalize
  4. FORMAT    — Convert to ChatML JSONL format
  5. VALIDATE  — Check format, token counts, balance
  6. SPLIT     — 90% train / 10% validation
```

### WHY — Common Data Problems

```
PROBLEM                         SOLUTION
─────────────────────────────── ──────────────────────
Inconsistent format             → Standardize all examples
Too few examples                → Generate synthetic data
Imbalanced topics               → Balance categories
Contains PII                    → Run PII detection
Too long examples               → Trim or split
Duplicate conversations         → Deduplicate
Bad quality responses           → Manual review / filter
```

---

## 🔨 HANDS-ON: Build Data Pipeline

### Step 1: Data Collector (20 minutes)

Create `scripts/training/collect-data.ts`:

```typescript
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolCalls?: any[];
}

interface RawConversation {
  sessionId: string;
  messages: RawMessage[];
  metadata?: {
    channel: string;
    userId: string;
    rating?: number;
  };
}

/**
 * Collect conversations from Lunar's JSONL transcript logs
 */
function collectFromTranscripts(logsDir: string): RawConversation[] {
  const conversations: RawConversation[] = [];

  const files = readdirSync(logsDir).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const lines = readFileSync(join(logsDir, file), 'utf-8')
      .split('\n')
      .filter(Boolean);

    const messages: RawMessage[] = [];
    let sessionId = file.replace('.jsonl', '');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.role && entry.content) {
          messages.push({
            role: entry.role,
            content: entry.content,
            timestamp: entry.timestamp,
            toolCalls: entry.toolCalls,
          });
        }
      } catch { /* skip malformed lines */ }
    }

    if (messages.length >= 2) { // At least one exchange
      conversations.push({ sessionId, messages });
    }
  }

  return conversations;
}

/**
 * Generate synthetic training examples for tool usage
 */
function generateSyntheticToolExamples(): RawConversation[] {
  const examples: RawConversation[] = [];
  
  const toolPatterns = [
    {
      user: "What's the weather in Tokyo?",
      assistant: 'Let me check the weather for you.\n\n<tool_call>{"name": "get_weather", "args": {"city": "Tokyo"}}</tool_call>',
    },
    {
      user: "Remember that my favorite language is TypeScript",
      assistant: "I'll save that preference for you.\n\n<tool_call>{\"name\": \"save_memory\", \"args\": {\"content\": \"User's favorite language is TypeScript\", \"type\": \"preference\"}}</tool_call>",
    },
    {
      user: "Find information about vector databases",
      assistant: 'Let me search my knowledge base.\n\n<tool_call>{"name": "search_memory", "args": {"query": "vector databases"}}</tool_call>',
    },
    {
      user: "What did we talk about yesterday?",
      assistant: 'Let me look through our conversation history.\n\n<tool_call>{"name": "search_memory", "args": {"query": "yesterday conversation summary"}}</tool_call>',
    },
  ];

  for (const pattern of toolPatterns) {
    examples.push({
      sessionId: `synthetic-${Math.random().toString(36).slice(2, 8)}`,
      messages: [
        { role: 'system', content: 'You are Lunar, a helpful AI agent.' },
        { role: 'user', content: pattern.user },
        { role: 'assistant', content: pattern.assistant },
      ],
    });
  }

  return examples;
}

// Export for pipeline
export { collectFromTranscripts, generateSyntheticToolExamples };
export type { RawConversation, RawMessage };
```

### Step 2: Data Cleaner (20 minutes)

Create `scripts/training/clean-data.ts`:

```typescript
import type { RawConversation, RawMessage } from './collect-data.js';

// PII patterns to redact
const PII_PATTERNS = [
  { name: 'email', regex: /[\w.-]+@[\w.-]+\.\w+/g, replacement: '<EMAIL>' },
  { name: 'phone', regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '<PHONE>' },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '<SSN>' },
  { name: 'creditcard', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '<CC>' },
  { name: 'ip', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '<IP>' },
];

/**
 * Clean a conversation for training
 */
export function cleanConversation(conv: RawConversation): RawConversation | null {
  const cleaned: RawMessage[] = [];

  for (const msg of conv.messages) {
    // Skip empty messages
    if (!msg.content?.trim()) continue;

    // Redact PII
    let content = msg.content;
    for (const pattern of PII_PATTERNS) {
      content = content.replace(pattern.regex, pattern.replacement);
    }

    // Normalize whitespace
    content = content.replace(/\n{3,}/g, '\n\n').trim();

    // Skip very short assistant responses (likely errors)
    if (msg.role === 'assistant' && content.length < 10) continue;

    cleaned.push({ ...msg, content });
  }

  // Need at least system + user + assistant
  const hasUser = cleaned.some(m => m.role === 'user');
  const hasAssistant = cleaned.some(m => m.role === 'assistant');
  
  if (!hasUser || !hasAssistant) return null;

  return { ...conv, messages: cleaned };
}

/**
 * Filter conversations by quality
 */
export function filterByQuality(
  conversations: RawConversation[],
  options: {
    minMessages?: number;
    maxMessages?: number;
    minAssistantLength?: number;
    maxTokenEstimate?: number;
    requireToolUse?: boolean;
  } = {}
): RawConversation[] {
  const {
    minMessages = 3,
    maxMessages = 20,
    minAssistantLength = 50,
    maxTokenEstimate = 2048,
    requireToolUse = false,
  } = options;

  return conversations.filter(conv => {
    // Message count limits
    if (conv.messages.length < minMessages) return false;
    if (conv.messages.length > maxMessages) return false;

    // Check assistant response quality
    const assistantMsgs = conv.messages.filter(m => m.role === 'assistant');
    const avgLength = assistantMsgs.reduce((sum, m) => sum + m.content.length, 0) / assistantMsgs.length;
    if (avgLength < minAssistantLength) return false;

    // Rough token estimate (1 token ≈ 4 chars)
    const totalChars = conv.messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars / 4 > maxTokenEstimate) return false;

    // Tool use requirement
    if (requireToolUse) {
      const hasToolCall = assistantMsgs.some(m => m.content.includes('<tool_call>'));
      if (!hasToolCall) return false;
    }

    return true;
  });
}

/**
 * Deduplicate similar conversations
 */
export function deduplicate(conversations: RawConversation[]): RawConversation[] {
  const seen = new Set<string>();
  
  return conversations.filter(conv => {
    // Create a fingerprint from first user message
    const firstUser = conv.messages.find(m => m.role === 'user');
    if (!firstUser) return false;
    
    const fingerprint = firstUser.content.toLowerCase().trim().slice(0, 100);
    if (seen.has(fingerprint)) return false;
    
    seen.add(fingerprint);
    return true;
  });
}
```

### Step 3: Format Converter (15 minutes)

Create `scripts/training/format-data.ts`:

```typescript
import type { RawConversation } from './collect-data.js';

interface ChatMLExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

const DEFAULT_SYSTEM = 'You are Lunar, a helpful AI agent built with Node.js. You use tools when needed and remember user preferences.';

/**
 * Convert to ChatML format (standard for fine-tuning)
 */
export function toChatML(conversations: RawConversation[]): ChatMLExample[] {
  return conversations.map(conv => {
    const messages: ChatMLExample['messages'] = [];
    
    // Ensure system message exists
    const hasSystem = conv.messages.some(m => m.role === 'system');
    if (!hasSystem) {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM });
    }

    for (const msg of conv.messages) {
      if (msg.role === 'tool') {
        // Wrap tool results in the assistant flow
        messages.push({
          role: 'user',
          content: `<tool_result>${msg.content}</tool_result>`,
        });
      } else if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    return { messages };
  });
}

/**
 * Write to JSONL file
 */
export function toJSONL(examples: ChatMLExample[]): string {
  return examples.map(ex => JSON.stringify(ex)).join('\n');
}

/**
 * Split into train/validation sets
 */
export function trainValSplit(
  examples: ChatMLExample[],
  valRatio = 0.1,
): { train: ChatMLExample[]; val: ChatMLExample[] } {
  // Shuffle
  const shuffled = [...examples].sort(() => Math.random() - 0.5);
  
  const valSize = Math.max(1, Math.floor(shuffled.length * valRatio));
  
  return {
    val: shuffled.slice(0, valSize),
    train: shuffled.slice(valSize),
  };
}

/**
 * Print dataset statistics
 */
export function printStats(examples: ChatMLExample[]): void {
  const totalMessages = examples.reduce((sum, ex) => sum + ex.messages.length, 0);
  const totalChars = examples.reduce(
    (sum, ex) => sum + ex.messages.reduce((s, m) => s + m.content.length, 0), 0
  );
  const avgMessages = totalMessages / examples.length;
  const estimatedTokens = Math.floor(totalChars / 4);

  const withTools = examples.filter(ex =>
    ex.messages.some(m => m.content.includes('<tool_call>'))
  ).length;

  console.log(`
Dataset Statistics:
  Examples:        ${examples.length}
  Total messages:  ${totalMessages}
  Avg messages:    ${avgMessages.toFixed(1)} per example
  Total chars:     ${totalChars.toLocaleString()}
  Est. tokens:     ${estimatedTokens.toLocaleString()}
  With tool calls: ${withTools} (${((withTools / examples.length) * 100).toFixed(1)}%)
  `);
}
```

### Step 4: Full Pipeline (10 minutes)

Create `scripts/training/pipeline.ts`:

```typescript
import { collectFromTranscripts, generateSyntheticToolExamples } from './collect-data.js';
import { cleanConversation, filterByQuality, deduplicate } from './clean-data.js';
import { toChatML, toJSONL, trainValSplit, printStats } from './format-data.js';
import { writeFileSync, mkdirSync } from 'fs';

async function main() {
  const logsDir = process.argv[2] || './data/transcripts';
  const outputDir = process.argv[3] || './data/training';

  console.log('📦 Collecting data...');
  let conversations = collectFromTranscripts(logsDir);
  console.log(`   Found ${conversations.length} conversations`);

  // Add synthetic examples
  const synthetic = generateSyntheticToolExamples();
  conversations = [...conversations, ...synthetic];
  console.log(`   + ${synthetic.length} synthetic examples`);

  console.log('🧹 Cleaning...');
  const cleaned = conversations
    .map(cleanConversation)
    .filter((c): c is NonNullable<typeof c> => c !== null);
  console.log(`   ${cleaned.length} after cleaning`);

  console.log('🔍 Filtering...');
  const filtered = filterByQuality(cleaned);
  console.log(`   ${filtered.length} after quality filter`);

  console.log('🔄 Deduplicating...');
  const unique = deduplicate(filtered);
  console.log(`   ${unique.length} after dedup`);

  console.log('📝 Formatting...');
  const examples = toChatML(unique);
  printStats(examples);

  console.log('✂️  Splitting...');
  const { train, val } = trainValSplit(examples);
  console.log(`   Train: ${train.length} | Val: ${val.length}`);

  console.log('💾 Saving...');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(`${outputDir}/train.jsonl`, toJSONL(train));
  writeFileSync(`${outputDir}/val.jsonl`, toJSONL(val));
  writeFileSync(`${outputDir}/full.jsonl`, toJSONL(examples));
  console.log(`   Saved to ${outputDir}/`);

  console.log('\n✅ Pipeline complete!');
}

main().catch(console.error);
```

---

## ✅ CHECKLIST

- [ ] Data collector reads Lunar's JSONL transcript logs
- [ ] Synthetic data generator for tool-use examples
- [ ] PII redaction (email, phone, SSN, CC, IP)
- [ ] Quality filter (message count, length, token limit)
- [ ] Deduplication by first user message
- [ ] ChatML format converter
- [ ] Train/val split (90/10)
- [ ] Dataset statistics printer
- [ ] Full pipeline script

---

## 💡 KEY TAKEAWAY

**Training data preparation is 80% of fine-tuning success. The pipeline is: collect → clean → filter → format → validate → split. Key rules: (1) quality > quantity, (2) always redact PII, (3) deduplicate to avoid overfitting, (4) include synthetic examples for underrepresented skills like tool calling. The output is JSONL in ChatML format — the universal standard for chat fine-tuning.**

---

**Next → [Day 63: Fine-tuning with Unsloth](day-63.md)**
