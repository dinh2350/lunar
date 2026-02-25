# Day 14 — Connect RAG to the Agent (The Full Pipeline)

> 🎯 **DAY GOAL:** Wire memory search into your agent so it answers questions from YOUR documents — not from training data

---

## 📚 CONCEPT 1: RAG (Retrieval-Augmented Generation)

### WHAT — Simple Definition

**RAG = "look up information FIRST, then answer."** Instead of the AI making things up from its training data, it searches your documents, finds relevant facts, and includes them in its answer.

### WHY — Why RAG Is THE Most Important AI Pattern?

```
WITHOUT RAG:
  You: "What is Lunar's memory system?"
  AI: "I don't have information about Lunar's memory system."
      OR WORSE:
      "Lunar uses PostgreSQL for memory storage." ← HALLUCINATION! (it's SQLite)

WITH RAG:
  You: "What is Lunar's memory system?"
  Agent: 🔍 searches memory → finds architecture.md chunks about memory
  Agent: sends those chunks + question to AI
  AI: "Lunar uses SQLite with sqlite-vec for vector search,
       combined with FTS5 for BM25 keyword search,
       implementing a hybrid search pipeline." ← ACCURATE! ✅
```

### WHY — Why Companies Use RAG Everywhere?

```
1. ACCURACY: AI answers from YOUR data → no hallucination
2. FRESHNESS: Add new docs any time → AI instantly knows them
3. NO FINE-TUNING: Don't need to retrain the model
4. CITATION: Can show WHICH document the answer came from
5. PRIVACY: Your data stays local (not sent to train models)

Real-world examples:
  - Customer support bot → RAG over help docs
  - Code assistant → RAG over codebase
  - Legal AI → RAG over case files
  - Your Lunar → RAG over personal knowledge base
```

### WHEN — RAG vs Fine-Tuning vs Long Context?

```
Use RAG when:
  ✅ Data changes frequently (docs, knowledge base)
  ✅ You need source citations
  ✅ Data is too large for context window
  ✅ You want to keep data private

Use FINE-TUNING when:
  ✅ Teaching the AI a NEW SKILL (writing style, domain language)
  ✅ Data rarely changes
  ❌ NOT for adding factual knowledge (use RAG for facts)

Use LONG CONTEXT when:
  ✅ Single document analysis (one report, one file)
  ✅ Data fits in context window AND you need full context
  ❌ Not for searching across many documents
```

### HOW — The Complete RAG Pipeline

```
User: "How does Lunar handle message routing?"
  │
  ├─ 1. RETRIEVE
  │    Agent calls memory_search tool
  │    → hybridSearch("message routing") 
  │    → Returns 5 relevant chunks from your docs
  │
  ├─ 2. AUGMENT
  │    Build prompt with retrieved context:
  │    "Here is relevant information from the knowledge base:
  │     [chunk 1: Gateway routes messages via bindings...]
  │     [chunk 2: Channel connectors normalize messages...]
  │     [chunk 3: The agent engine processes envelopes...]
  │     
  │     Based on this information, answer the user's question."
  │
  └─ 3. GENERATE
       AI reads context + question → generates accurate answer
       "Lunar routes messages through a Gateway that uses a 
        bindings[] array to match channel providers to agent instances..."
```

### 🔗 NODE.JS ANALOGY

```typescript
// RAG = like a search-powered API endpoint

// WITHOUT RAG (pure LLM):
app.post('/ask', async (req, res) => {
  const answer = await llm.chat(req.body.question); // AI guesses from training
  res.json({ answer });
});

// WITH RAG:
app.post('/ask', async (req, res) => {
  // 1. Search your database for relevant info
  const context = await searchDocs(req.body.question);
  
  // 2. Include that info in the prompt
  const answer = await llm.chat(
    `Context: ${context}\n\nQuestion: ${req.body.question}`
  );
  
  // 3. Return answer with sources
  res.json({ answer, sources: context.map(c => c.filePath) });
});

// Same pattern you'd use to build a search-powered API!
```

---

## 📚 CONCEPT 2: Grounding (Preventing Hallucination)

### WHAT — Simple Definition

**Grounding = telling the AI "ONLY use the information I gave you."** If the answer isn't in the provided context, the AI should say "I don't know" instead of making something up.

### WHY — Why Grounding Matters?

```
WITHOUT grounding:
  Context: "Lunar uses SQLite for storage."
  Question: "What database does Lunar use and what's its max throughput?"
  AI: "Lunar uses SQLite with a max throughput of 50,000 queries/sec." 
       ← made up the throughput number! 😱

WITH grounding:
  Context: "Lunar uses SQLite for storage."
  Question: "What database does Lunar use and what's its max throughput?"
  AI: "Lunar uses SQLite for storage. The max throughput is not
       mentioned in the available documentation."
       ← honest about what it doesn't know ✅
```

### HOW — Grounding via System Prompt

```
SYSTEM PROMPT (add this to your agent):

"You are Lunar, a helpful AI assistant with access to a knowledge base.

RULES:
1. When answering questions about Lunar or documented topics, 
   ALWAYS use the memory_search tool first.
2. Only use information from the search results to answer.
3. If the information is insufficient, say: 
   'I don't have enough information about that in my knowledge base.'
4. Never make up facts, numbers, or details not in the context.
5. When citing information, mention the source if available."
```

---

## 🔨 HANDS-ON: Wire RAG into the Agent

### Step 1: Create memory_search Tool (20 minutes)

Create `packages/tools/src/memory-search.ts`:

```typescript
import type { ToolDefinition, ToolResult } from '@lunar/shared';
import { hybridSearch } from '../../memory/src/search.js';
import type { VectorStore } from '../../memory/src/store.js';

export const memorySearchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'memory_search',
    description: 'Search the knowledge base for relevant information. Use this BEFORE answering questions about documented topics.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — describe what information you need',
        },
      },
      required: ['query'],
    },
  },
};

export function createMemorySearchExecutor(store: VectorStore) {
  return async function executeMemorySearch(
    args: { query: string }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const results = await hybridSearch(args.query, store, { limit: 5 });

      if (results.length === 0) {
        return {
          name: 'memory_search',
          result: 'No relevant information found in the knowledge base.',
          success: true,
          durationMs: Date.now() - startTime,
        };
      }

      // Format results for the AI
      const formatted = results.map((r, i) => {
        const source = r.filePath ? ` (source: ${r.filePath})` : '';
        return `[${i + 1}]${source}\n${r.content}`;
      }).join('\n\n---\n\n');

      return {
        name: 'memory_search',
        result: formatted,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        name: 'memory_search',
        result: `Search error: ${error.message}`,
        success: false,
        durationMs: Date.now() - startTime,
      };
    }
  };
}
```

### Step 2: Update Tool Executor (15 minutes)

Update `packages/tools/src/executor.ts` to include memory_search:

```typescript
import { createMemorySearchExecutor, memorySearchTool } from './memory-search.js';
import type { VectorStore } from '../../memory/src/store.js';

let memorySearchExecutor: ReturnType<typeof createMemorySearchExecutor> | null = null;

export function initializeTools(store: VectorStore) {
  memorySearchExecutor = createMemorySearchExecutor(store);
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    datetimeTool,
    bashTool,
    readFileTool,
    listDirTool,
    memorySearchTool,  // ← NEW
  ];
}

export async function executeTool(name: string, args: any): Promise<ToolResult> {
  switch (name) {
    case 'memory_search':
      if (!memorySearchExecutor) throw new Error('Memory not initialized');
      return memorySearchExecutor(args);
    case 'bash':
      return executeBash(args);
    // ... other tools
  }
}
```

### Step 3: Update System Prompt for RAG (10 minutes)

Update your system prompt in the CLI or wherever you configure it:

```typescript
const SYSTEM_PROMPT = `You are Lunar, a helpful personal AI assistant.

## YOUR CAPABILITIES
- You have a knowledge base searchable via the memory_search tool
- You can execute shell commands, read files, and get the current time
- You remember conversation context within this session

## RULES
1. When the user asks about topics that might be in your knowledge base 
   (Lunar architecture, documented processes, saved information), 
   ALWAYS use memory_search FIRST before answering.
2. Base your answers on the search results. Quote relevant sections.
3. If search returns no results, honestly say:
   "I don't have information about that in my knowledge base."
4. Never invent facts, statistics, or details not found in search results.
5. For general knowledge questions (math, common facts), answer directly 
   without searching — use your built-in knowledge.

## RESPONSE FORMAT
- Be concise but complete
- When citing from memory, mention the source
- If you're unsure, say so`;
```

### Step 4: Index Your Documents (15 minutes)

Create `packages/memory/src/index-docs.ts`:

```typescript
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { chunkMarkdown } from './chunker.js';
import { embedBatch } from './embedder.js';
import { VectorStore } from './store.js';

async function indexDirectory(dirPath: string, store: VectorStore) {
  const files = readdirSync(dirPath, { recursive: true }) as string[];
  const mdFiles = files.filter(f => f.endsWith('.md'));

  console.log(`📁 Found ${mdFiles.length} markdown files in ${dirPath}`);

  for (const file of mdFiles) {
    const fullPath = path.join(dirPath, file);
    const text = readFileSync(fullPath, 'utf8');
    const chunks = chunkMarkdown(text, file);

    console.log(`  📄 ${file}: ${chunks.length} chunks`);

    // Batch embed
    const batchSize = 10;
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = await embedBatch(batch.map(c => c.content));
      embeddings.push(...batchEmbeddings);
    }

    store.insertChunks(chunks, embeddings);
  }
}

async function main() {
  const store = new VectorStore('./lunar-memory.sqlite');

  // Index all docs
  await indexDirectory('../../docs', store);

  const stats = store.getStats();
  console.log(`\n✅ Indexed ${stats.totalChunks} chunks from ${stats.totalFiles} files`);

  store.close();
}

main();
```

Run: `npx tsx packages/memory/src/index-docs.ts`

### Step 5: Test RAG End-to-End (20 minutes)

Run your CLI agent and test:

```
You: How does Lunar handle message routing?
🔧 memory_search({"query": "message routing"})
📎 [1] (source: architechture/architecture.md)
   The Gateway routes messages using bindings...
Lunar: Lunar routes messages through a Gateway that uses a bindings[] 
       array. Each binding maps a channel provider (like Telegram) to 
       an agent instance. When a message arrives, the Gateway looks up 
       the binding and forwards it to the correct agent engine.
       (source: architecture.md)

You: What's the weather today?
Lunar: I don't have weather data in my knowledge base, but I can run 
       a command to check! Would you like me to try?
       (No tool called — it knows this isn't in the KB) ✅

You: What database does Lunar use?
🔧 memory_search({"query": "database storage"})
Lunar: Lunar uses SQLite with the sqlite-vec extension for vector 
       search, combined with FTS5 for keyword search.
       (source: architecture.md) ✅ ACCURATE!
```

---

## ✅ CHECKLIST

- [ ] memory_search tool registered in the tool executor
- [ ] System prompt instructs AI to search before answering
- [ ] All docs/ files indexed into SQLite vector store
- [ ] Agent searches memory when asked about documented topics
- [ ] Agent answers directly for general knowledge questions
- [ ] Agent says "I don't know" when info isn't in the knowledge base
- [ ] Answers are accurate and cite sources

---

## 💡 KEY TAKEAWAY

**RAG = Retrieve + Augment + Generate. Search your docs → inject into prompt → AI answers from real data. This one pattern eliminates hallucination and is used in 90% of production AI systems. You just built it.**

---

## ❓ SELF-CHECK QUESTIONS

1. **What does each letter in R-A-G stand for and what happens in each step?**
   <details><summary>Answer</summary>**R**etrieval: search the knowledge base for relevant chunks. **A**ugmentation: add those chunks into the prompt as context. **G**eneration: the LLM reads the context and generates an answer based on it. The AI answers from evidence, not from memory.</details>

2. **Why use a tool for memory search instead of always searching before every question?**
   <details><summary>Answer</summary>Not every question needs document search. "What's 2+2?" or "Tell me a joke" don't need knowledge base lookup. By making it a tool, the AI decides WHEN to search based on the question type. This saves time and tokens on questions that don't need retrieval.</details>

3. **How does grounding prevent hallucination?**
   <details><summary>Answer</summary>The system prompt says "ONLY answer from search results" and "if info is insufficient, say you don't know." This constrains the AI to facts it can verify. Without grounding, the AI might fill gaps with plausible-sounding but false information from its training data.</details>

4. **Why do we format search results as numbered items with sources?**
   <details><summary>Answer</summary>Numbers help the AI reference specific chunks: "According to [1], Lunar uses SQLite." Sources let the human verify: "architecture.md says X" is checkable. It also helps evaluation: did the AI actually USE the relevant chunk, or did it ignore it and make something up?</details>

---

**Next → [Day 15: Temporal Decay + MMR Re-ranking](day-15.md)**
