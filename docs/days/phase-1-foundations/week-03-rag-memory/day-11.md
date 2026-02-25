# Day 11 — Text Chunking + Understanding Embeddings

> 🎯 **DAY GOAL:** Understand HOW AI searches text, and build the first step: split documents into searchable chunks

---

## 📚 CONCEPT 1: Why AI Can't Just "Read" Documents

### WHAT — The Problem

**LLMs have a limited "memory window" (context window).** You can't send an entire book to the AI. You need to find the RELEVANT parts and send only those.

### WHY — Why Can't We Send Everything?

```
Context window sizes (2026):
  Llama 3.3:     128,000 tokens (~96,000 words)
  GPT-4:         128,000 tokens
  Claude:        200,000 tokens

Your architecture.md:  ~10,000 tokens ← fits easily!
A codebase:            ~500,000 tokens ← DOES NOT FIT
A book:                ~200,000 tokens ← barely fits, but SLOW + EXPENSIVE

Even if it fits:
  Sending 100,000 tokens when you need 500 = 
    ❌ Slow (AI reads everything)
    ❌ Expensive (pay per token)
    ❌ Inaccurate (AI gets distracted by irrelevant content)
    ❌ Lost in the middle (AI forgets info in the middle of long text)

Solution: FIND the 5 most relevant paragraphs → send only those
```

### WHEN — When Do You Need Chunking?

```
✅ NEED CHUNKING:
  - Knowledge bases (docs, FAQs, manuals)
  - Codebase search
  - Personal memory (user's notes, conversations)
  - Any collection of documents > 1 file

❌ DON'T NEED CHUNKING:
  - Single short document (< 2000 tokens)
  - Real-time data (use tools instead: APIs, bash)
  - Structured data (use SQL queries instead)
```

### 🔗 NODE.JS ANALOGY

```
Chunking = database indexing for text

Without index (no chunking):
  SELECT * FROM documents WHERE content LIKE '%agent loop%';
  → Full table scan — reads EVERY row — slow!

With index (chunking + embeddings):
  SELECT * FROM chunks ORDER BY similarity(embedding, query_embedding) LIMIT 5;
  → Index lookup — finds relevant chunks instantly — fast!
```

---

## 📚 CONCEPT 2: Text Chunking

### WHAT — Simple Definition

**Splitting a large document into smaller, overlapping pieces called "chunks."** Each chunk is a standalone paragraph-sized piece of text that contains one idea or section.

### WHY — Why Overlap?

```
WITHOUT overlap (chunk_size=100 words):
  Chunk 1: "The agent loop is a while(true) that keeps running"
  Chunk 2: "until the AI gives a text response without tool calls."

  Problem: if someone searches "how does the agent loop end",
  the answer is SPLIT across two chunks! Neither chunk alone answers it.

WITH overlap (chunk_size=100, overlap=20):
  Chunk 1: "The agent loop is a while(true) that keeps running until the AI"
  Chunk 2: "that keeps running until the AI gives a text response without tool calls."

  Now "until the AI gives a text response" appears in BOTH chunks.
  Search finds the answer!
```

### HOW — The Chunking Algorithm

```
Document: [████████████████████████████████████████]
                         ↓ chunk
Chunk 1:  [██████████]
Chunk 2:       [██████████]        ← overlaps with chunk 1
Chunk 3:            [██████████]   ← overlaps with chunk 2
Chunk 4:                 [██████████]

Settings:
  chunk_size = 400 tokens (~300 words)  ← how big each chunk is
  overlap = 80 tokens (~60 words)       ← how much chunks overlap

Why 400 tokens?
  Too small (50 tokens): chunks have no context, search results are fragments
  Too big (2000 tokens): too many irrelevant words per chunk, wastes context
  400 tokens: sweet spot — big enough for context, small enough for precision
```

### 🔗 NODE.JS ANALOGY

```typescript
// Chunking is like Array.slice() with step < size:
const words = document.split(' ');
const chunkSize = 400;
const overlap = 80;

for (let i = 0; i < words.length; i += chunkSize - overlap) {
  const chunk = words.slice(i, i + chunkSize).join(' ');
  // Each chunk overlaps with the next by 80 words
}

// Same concept as Node.js streams with highWaterMark:
// Read 400 bytes at a time, buffer 80 bytes of overlap
```

---

## 📚 CONCEPT 3: Embeddings

### WHAT — Simple Definition

**Turning text into a list of numbers (a "vector") that captures the MEANING of the text.** Similar meanings → similar numbers. Then you can find similar text by finding similar numbers.

### WHY — Why Numbers Instead of Text?

```
Text comparison (exact match):
  "How does the agent loop work?" 
  vs "agent loop mechanism"
  → No match! Different words.

Embedding comparison (meaning match):
  "How does the agent loop work?"  → [0.23, -0.81, 0.45, ...]
  "agent loop mechanism"           → [0.25, -0.79, 0.43, ...]
  → Similarity: 0.95! Very similar meaning!

  "How to cook pasta"              → [-0.67, 0.12, 0.89, ...]
  → Similarity: 0.08. Completely different topic.

KEY INSIGHT: Embeddings capture MEANING, not exact words.
  "happy" and "joyful"  → similar vectors (same meaning)
  "bank" (river) and "bank" (money) → different vectors (different meaning)
```

### HOW — What Does an Embedding Look Like?

```
Input text: "The agent loop calls tools and waits for results"
     ↓
Embedding model (nomic-embed-text)
     ↓
Output: [0.023, -0.812, 0.451, -0.067, 0.334, ... ]  ← 768 numbers!

Each number represents one "dimension" of meaning:
  Dimension 1: how technical is this? (high = very technical)
  Dimension 2: is this about code? (high = yes)
  Dimension 3: is this about people? (low = no)
  ... 768 dimensions total

You don't choose what each dimension means — the model learns this
from training on billions of text examples.
```

### HOW — Measuring Similarity

```
Cosine Similarity = how similar are two vectors?

  1.0  = identical meaning
  0.8+ = very similar
  0.5  = somewhat related
  0.0  = completely unrelated

Formula (you don't need to memorize):
  cos(A, B) = (A · B) / (|A| × |B|)

In practice: you call a function and get a number between 0 and 1.
```

### 🔗 NODE.JS ANALOGY

```typescript
// Embeddings = like a hash function, but for MEANING
// 
// A hash (like MD5) preserves EXACT equality:
//   md5("hello") === md5("hello")  ✅
//   md5("hello") === md5("hi")     ❌ completely different hash
//
// An embedding preserves MEANING similarity:
//   embed("hello") ~ embed("hi")         ← similar vectors!
//   embed("hello") ~ embed("greetings")  ← similar vectors!
//   embed("hello") ~ embed("quantum physics")  ← very different vectors

// You already use something similar: 
// Full-text search (FTS) in Elasticsearch or Postgres
// But embeddings find MEANING, not just keywords
```

---

## 🔨 HANDS-ON: Build the Chunker + Generate Embeddings

### Step 1: Create Memory Package (10 minutes)

```bash
mkdir -p packages/memory/src
cd packages/memory
pnpm init
# Edit package.json: set "name": "@lunar/memory", "type": "module"
```

### Step 2: Build the Text Chunker (25 minutes)

Create `packages/memory/src/chunker.ts`:

```typescript
// ============================================
// Text Chunker — splits documents into searchable pieces
// ============================================

export interface Chunk {
  id: string;           // unique ID: "filepath:chunkIndex"
  content: string;      // the actual text
  filePath: string;     // source file
  chunkIndex: number;   // position in the document (0, 1, 2, ...)
  tokenCount: number;   // approximate token count
}

/**
 * Split text into overlapping chunks.
 *
 * WHY these defaults?
 *   chunkSize=400: big enough for full paragraphs, small enough for precision
 *   overlap=80: ~20% overlap catches ideas that span chunk boundaries
 */
export function chunkText(
  text: string,
  filePath: string,
  chunkSize = 400,
  overlap = 80
): Chunk[] {
  // Simple word-based tokenization
  // (production systems use tiktoken or similar, but words work fine for learning)
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return [];

  const chunks: Chunk[] = [];
  const step = chunkSize - overlap; // advance by this many words each time

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    const content = chunkWords.join(' ');

    chunks.push({
      id: `${filePath}:${chunks.length}`,
      content,
      filePath,
      chunkIndex: chunks.length,
      tokenCount: chunkWords.length, // approximation: 1 word ≈ 1.3 tokens
    });

    // Stop if we've covered all words
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

/**
 * Smart chunking: split on markdown headers first, then by size.
 * This keeps related content together.
 */
export function chunkMarkdown(text: string, filePath: string): Chunk[] {
  // Split by markdown headers (## or ###)
  const sections = text.split(/(?=^#{1,3}\s)/m);

  const chunks: Chunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount <= 400) {
      // Section is small enough — keep as one chunk
      chunks.push({
        id: `${filePath}:${chunks.length}`,
        content: trimmed,
        filePath,
        chunkIndex: chunks.length,
        tokenCount: wordCount,
      });
    } else {
      // Section too big — split further
      const subChunks = chunkText(trimmed, filePath);
      for (const sub of subChunks) {
        sub.id = `${filePath}:${chunks.length}`;
        sub.chunkIndex = chunks.length;
        chunks.push(sub);
      }
    }
  }

  return chunks;
}
```

### Step 3: Test the Chunker (10 minutes)

Create `packages/memory/src/test-chunker.ts`:

```typescript
import { readFileSync } from 'fs';
import { chunkText, chunkMarkdown } from './chunker.js';

// Chunk the architecture document
const text = readFileSync('../../docs/architechture/architecture.md', 'utf8');

// Method 1: Simple word-based chunking
const simpleChunks = chunkText(text, 'architecture.md');
console.log(`\n📄 Simple chunking:`);
console.log(`   Total chunks: ${simpleChunks.length}`);
console.log(`   First chunk (${simpleChunks[0].tokenCount} tokens):`);
console.log(`   "${simpleChunks[0].content.slice(0, 150)}..."`);

// Method 2: Markdown-aware chunking
const mdChunks = chunkMarkdown(text, 'architecture.md');
console.log(`\n📄 Markdown chunking:`);
console.log(`   Total chunks: ${mdChunks.length}`);
console.log(`   First chunk (${mdChunks[0].tokenCount} tokens):`);
console.log(`   "${mdChunks[0].content.slice(0, 150)}..."`);

// Show a few chunks to understand the structure
console.log('\n📋 First 3 chunks:');
for (const chunk of mdChunks.slice(0, 3)) {
  console.log(`\n--- Chunk ${chunk.chunkIndex} (${chunk.tokenCount} tokens) ---`);
  console.log(chunk.content.slice(0, 200) + '...');
}
```

Run: `npx tsx packages/memory/src/test-chunker.ts`

### Step 4: Generate Embeddings (20 minutes)

Create `packages/memory/src/embedder.ts`:

```typescript
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://localhost:11434' });

/**
 * Generate an embedding vector for a piece of text.
 *
 * WHAT HAPPENS INSIDE:
 *   "The agent loop calls tools" → [0.023, -0.812, 0.451, ... ] (768 numbers)
 *
 * The model (nomic-embed-text) was trained to make similar texts
 * produce similar number arrays.
 */
export async function embed(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: 'nomic-embed-text',
    input: text,
  });
  return response.embeddings[0];
}

/**
 * Generate embeddings for multiple texts at once (batched).
 * More efficient than calling embed() one by one.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await ollama.embed({
    model: 'nomic-embed-text',
    input: texts,
  });
  return response.embeddings;
}

/**
 * Calculate cosine similarity between two embedding vectors.
 * Returns: 0.0 (completely different) to 1.0 (identical meaning)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Step 5: Test Embeddings + Similarity (15 minutes)

Create `packages/memory/src/test-embed.ts`:

```typescript
import { embed, cosineSimilarity } from './embedder.js';

async function main() {
  console.log('Generating embeddings...\n');

  // Generate embeddings for test sentences
  const sentences = [
    'The agent loop calls tools and waits for results',
    'How does the tool calling mechanism work in the AI agent?',
    'My favorite recipe for chocolate cake',
    'LLMs predict the next token based on the context window',
  ];

  const embeddings = await Promise.all(sentences.map(s => embed(s)));

  console.log(`Embedding dimensions: ${embeddings[0].length}`);  // Should be 768
  console.log(`First 5 values: [${embeddings[0].slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

  // Compare similarities
  console.log('\n📊 Similarity Matrix:');
  console.log('(1.0 = identical meaning, 0.0 = completely different)\n');

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      const bar = '█'.repeat(Math.round(sim * 20));
      console.log(`${sim.toFixed(3)} ${bar}`);
      console.log(`  "${sentences[i].slice(0, 50)}..."`);
      console.log(`  "${sentences[j].slice(0, 50)}..."\n`);
    }
  }
}

main();
```

**Expected output:**

```
📊 Similarity Matrix:
0.891 █████████████████░░░
  "The agent loop calls tools and waits for results"
  "How does the tool calling mechanism work in the AI ..."
  → HIGH similarity! Different words, same meaning ✅

0.132 ██░░░░░░░░░░░░░░░░░░
  "The agent loop calls tools and waits for results"
  "My favorite recipe for chocolate cake"
  → LOW similarity! Completely different topics ✅

0.654 ████████████░░░░░░░░
  "The agent loop calls tools and waits for results"
  "LLMs predict the next token based on the context w..."
  → MEDIUM similarity — both about AI, but different aspects ✅
```

---

## ✅ CHECKLIST

- [ ] Memory package created (`packages/memory/`)
- [ ] Text chunker works: splits docs into 400-token overlapping chunks
- [ ] Markdown-aware chunker splits on headers first
- [ ] Embedding generation works: text → 768-dimensional vector
- [ ] Cosine similarity works: compare two embeddings → 0 to 1
- [ ] You tested: similar texts get high similarity scores
- [ ] You tested: different texts get low similarity scores

---

## 💡 KEY TAKEAWAY

**Chunking splits documents into searchable pieces. Embeddings turn those pieces into numbers that capture meaning. Similar text → similar numbers → we can "search by meaning" instead of just keywords.** This is the foundation of RAG.

---

## ❓ SELF-CHECK QUESTIONS

1. **Why do chunks need to overlap?**
   <details><summary>Answer</summary>Because ideas can span chunk boundaries. If a sentence starts at the end of chunk 1 and ends at the start of chunk 2, neither chunk alone captures the full idea. Overlap ensures important sentences appear in at least one complete chunk.</details>

2. **What does an embedding vector represent?**
   <details><summary>Answer</summary>It's a list of 768 numbers that represent the MEANING of the text across 768 learned dimensions. Each dimension captures some aspect of meaning (topic, sentiment, technicality, etc). Similar meanings produce similar numbers, enabling "search by meaning."</details>

3. **Why does "How does tool calling work?" match "The agent loop calls tools" even though they share few words?**
   <details><summary>Answer</summary>Because embeddings capture MEANING, not exact words. The embedding model learned from billions of examples that "tool calling" and "calls tools" mean the same thing, and "how does X work" and "X does Y" are semantically related. The vectors end up similar even though the words are different.</details>

4. **Why not just send the entire document to the AI instead of chunking?**
   <details><summary>Answer</summary>Four reasons: (1) documents may exceed the context window, (2) it's slow (AI reads everything), (3) it's expensive (pay per token), (4) "lost in the middle" — AI forgets info in the middle of long text. Chunking finds the relevant 5 paragraphs and sends only those.</details>

5. **Why 400 tokens for chunk size? What happens if you use 50 or 5000?**
   <details><summary>Answer</summary>50 tokens: chunks are tiny fragments — "The agent loop" with no context about what the agent loop does. 5000 tokens: chunks are huge — mostly irrelevant content surrounding the answer. 400 is the sweet spot: big enough to contain a complete idea with context, small enough to be precise.</details>

---

**Next → [Day 12: SQLite Vector Store](day-12.md)**
