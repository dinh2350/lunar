# Day 12 — SQLite Vector Store

> 🎯 **DAY GOAL:** Build a database that stores text chunks AND their embeddings, enabling search by meaning

---

## 📚 CONCEPT 1: Vector Database

### WHAT — Simple Definition

**A database that can find rows with the most similar number arrays (vectors).** You store text along with its embedding vector, then query: "find the 5 rows most similar to this query vector."

### WHY — Why Not Just Use Regular SQL?

```
Regular SQL:
  SELECT * FROM chunks WHERE content LIKE '%agent loop%';
  ✅ Finds: "The agent loop calls tools"
  ❌ Misses: "How AI decides which function to invoke"
  → Only matches EXACT keywords

Vector SQL (with sqlite-vec):
  SELECT * FROM chunks ORDER BY vec_distance(embedding, ?) LIMIT 5;
  ✅ Finds: "The agent loop calls tools"
  ✅ ALSO finds: "How AI decides which function to invoke"
  → Matches by MEANING (because embeddings capture semantics)
```

### WHEN — Vector DB vs Regular DB?

```
Use VECTOR search when:
  ✅ Searching by meaning ("how does routing work?")
  ✅ Finding similar content (related docs)
  ✅ Semantic search across documents

Use REGULAR SQL when:
  ✅ Exact lookup (find user by ID)
  ✅ Filtering (all chunks from file X)
  ✅ Counting, aggregating, sorting by date

Best approach: use BOTH → that's hybrid search (Day 13)
```

### HOW — How Vector Search Works Internally

```
Step 1: Store vectors
  chunks table:
    id          | content                              | embedding
    "arch:0"    | "The Gateway is the entry point..."  | [0.12, -0.34, 0.56, ...]
    "arch:1"    | "The Agent Engine runs the loop..."  | [0.45, -0.23, 0.78, ...]
    "arch:2"    | "Memory uses hybrid search..."       | [0.33, -0.67, 0.21, ...]

Step 2: Query
  User asks: "How does the AI process messages?"
  Generate query embedding: [0.41, -0.25, 0.73, ...]

Step 3: Find nearest neighbors
  Distance from query to each stored vector:
    "arch:0" → distance: 0.45  (somewhat similar)
    "arch:1" → distance: 0.12  🏆 (very similar!)
    "arch:2" → distance: 0.67  (less similar)

Step 4: Return top N
  Result: ["arch:1", "arch:0"] ← sorted by similarity
```

### 🔗 NODE.JS ANALOGY

```typescript
// Vector search = like Array.sort() by distance to a target point
//
// Regular search:
items.filter(item => item.name.includes(query));  // exact keyword match
//
// Vector search:
items
  .map(item => ({ ...item, distance: vectorDistance(item.embedding, queryEmbedding) }))
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 5);  // top 5 most similar

// sqlite-vec does this efficiently using an index (KNN search)
// so it doesn't scan every row — it's fast even with millions of rows
```

---

## 📚 CONCEPT 2: SQLite + sqlite-vec

### WHAT — Simple Definition

**SQLite is a database in a single file (no server needed). sqlite-vec is an extension that adds vector search capability.** Together, they give you a vector database that runs locally with zero setup.

### WHY — Why SQLite Instead of Pinecone/Weaviate/ChromaDB?

```
Cloud vector DBs (Pinecone, Weaviate):
  ✅ Scale to billions of vectors
  ❌ Cost money ($70+/month)
  ❌ Network latency (API calls)
  ❌ External dependency

SQLite + sqlite-vec:
  ✅ Free forever
  ✅ Zero latency (local file)
  ✅ Zero setup (no server to run)
  ✅ Good enough for millions of vectors
  ❌ Can't scale to billions (but you don't need to)

For a personal AI assistant: SQLite is PERFECT.
For a company with 100M documents: use Pinecone/Weaviate.
```

### HOW — sqlite-vec Architecture

```
SQLite file: lunar-memory.sqlite
  ├── chunks          ← regular table (text content, metadata)
  ├── chunks_fts      ← FTS5 virtual table (keyword search)
  └── chunks_vec      ← vec0 virtual table (vector search)

Three tables working together:
  chunks:     stores the actual text and metadata
  chunks_fts: Full-Text Search index (fast keyword search)
  chunks_vec: Vector index (fast similarity search)

Query flow:
  Keyword search  → chunks_fts → "find rows containing 'agent loop'"
  Vector search   → chunks_vec → "find rows most similar to [0.41, -0.25, ...]"
  Get full text   → chunks     → "get the content for chunk 'arch:1'"
```

### 🔗 NODE.JS ANALOGY

```typescript
// Using better-sqlite3 (you might know this) — it's synchronous:
import Database from 'better-sqlite3';
const db = new Database('app.sqlite');

// Regular query:
db.prepare('SELECT * FROM users WHERE id = ?').get(123);

// With sqlite-vec, you can also do:
db.prepare(`
  SELECT chunk_id, distance 
  FROM chunks_vec 
  WHERE embedding MATCH ? 
  ORDER BY distance 
  LIMIT 5
`).all(queryEmbeddingBuffer);

// Same familiar SQLite API — just with vector search added!
```

---

## 📚 CONCEPT 3: BM25 Full-Text Search

### WHAT — Simple Definition

**BM25 is the algorithm behind keyword search.** It scores documents by how many times your search terms appear, weighted by rarity. It's what Google used before AI.

### WHY — Why Have BM25 When We Have Vectors?

```
Vector search WEAKNESS — exact terms:
  Query: "error code ENOENT"
  Vector search finds: "file system errors and missing paths" ← related but vague
  BM25 finds: "ENOENT error occurs when file does not exist" ← EXACT match!

BM25 search WEAKNESS — meaning:
  Query: "how to make the AI stop talking"
  BM25 finds: nothing (no document contains these exact words)
  Vector search finds: "configure max_tokens to limit response length" ← BINGO!

Lesson: each method catches what the other misses.
  That's why we use BOTH (hybrid search = Day 13).
```

### HOW — BM25 Scoring

```
BM25 score = sum of:
  for each search term:
    term_frequency × inverse_document_frequency × normalization

In simple terms:
  - Words that appear MORE in a document → higher score
  - Words that are RARE across all documents → higher score
  - Very long documents get slightly penalized (normalization)

Example:
  Search: "agent loop"
  Doc A: "The agent loop runs..." → "agent" appears 3x, "loop" 2x → score: 8.5
  Doc B: "The loop iterates..."  → "agent" 0x, "loop" 1x → score: 1.2
  Doc C: "Agent configuration..." → "agent" 1x, "loop" 0x → score: 2.1
  → Result: Doc A wins!
```

### 🔗 NODE.JS ANALOGY

```
BM25 = like Elasticsearch's default scoring, or Postgres ts_rank:

// Postgres full-text search:
SELECT * FROM documents 
WHERE to_tsvector(content) @@ to_tsquery('agent & loop')
ORDER BY ts_rank(to_tsvector(content), to_tsquery('agent & loop')) DESC;

// SQLite FTS5 (what we'll use):
SELECT * FROM chunks_fts WHERE chunks_fts MATCH 'agent loop'
ORDER BY rank;
```

---

## 🔨 HANDS-ON: Build the Vector Store

### Step 1: Install Dependencies (5 minutes)

```bash
cd packages/memory
pnpm add better-sqlite3 sqlite-vec
pnpm add -D @types/better-sqlite3
```

### Step 2: Create the Store (40 minutes)

Create `packages/memory/src/store.ts`:

```typescript
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { Chunk } from './chunker.js';

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: string;
  content: string;
  filePath: string;
  score: number;
  source: 'vector' | 'bm25';
}

// ============================================
// Vector Store
// ============================================

export class VectorStore {
  private db: Database.Database;
  private dimensions: number;

  constructor(dbPath: string, dimensions = 768) {
    this.dimensions = dimensions;
    this.db = new Database(dbPath);

    // Load sqlite-vec extension
    sqliteVec.load(this.db);

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');

    this.createTables();
  }

  // ---- SETUP ----

  private createTables() {
    this.db.exec(`
      -- Main table: stores chunk text and metadata
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );

      -- FTS5 index: enables fast keyword (BM25) search
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content,
        content=chunks,
        content_rowid=rowid
      );

      -- Vector index: enables fast similarity search
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[${this.dimensions}]
      );
    `);
  }

  // ---- INSERT ----

  insertChunk(chunk: Chunk, embedding: number[]): void {
    const insertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, file_path, chunk_index, content, token_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertFTS = this.db.prepare(`
      INSERT OR REPLACE INTO chunks_fts (rowid, content)
      VALUES ((SELECT rowid FROM chunks WHERE id = ?), ?)
    `);

    const insertVec = this.db.prepare(`
      INSERT OR REPLACE INTO chunks_vec (chunk_id, embedding)
      VALUES (?, ?)
    `);

    // Run all inserts in a transaction (faster + atomic)
    const transaction = this.db.transaction(() => {
      insertChunk.run(chunk.id, chunk.filePath, chunk.chunkIndex, chunk.content, chunk.tokenCount);
      insertFTS.run(chunk.id, chunk.content);
      insertVec.run(chunk.id, new Float32Array(embedding));
    });

    transaction();
  }

  /**
   * Insert multiple chunks at once (much faster for bulk indexing).
   */
  insertChunks(chunks: Chunk[], embeddings: number[][]): void {
    const transaction = this.db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        this.insertChunk(chunks[i], embeddings[i]);
      }
    });
    transaction();
  }

  // ---- SEARCH: VECTOR (semantic similarity) ----

  searchVector(queryEmbedding: number[], limit = 5): SearchResult[] {
    const results = this.db.prepare(`
      SELECT
        v.chunk_id as id,
        v.distance,
        c.content,
        c.file_path
      FROM chunks_vec v
      JOIN chunks c ON c.id = v.chunk_id
      WHERE v.embedding MATCH ?
      ORDER BY v.distance
      LIMIT ?
    `).all(new Float32Array(queryEmbedding), limit) as any[];

    return results.map(r => ({
      id: r.id,
      content: r.content,
      filePath: r.file_path,
      score: 1 - r.distance, // convert distance to similarity (1 = identical)
      source: 'vector' as const,
    }));
  }

  // ---- SEARCH: BM25 (keyword matching) ----

  searchBM25(query: string, limit = 5): SearchResult[] {
    const results = this.db.prepare(`
      SELECT
        c.id,
        c.content,
        c.file_path,
        chunks_fts.rank as score
      FROM chunks_fts
      JOIN chunks c ON c.rowid = chunks_fts.rowid
      WHERE chunks_fts MATCH ?
      ORDER BY chunks_fts.rank
      LIMIT ?
    `).all(query, limit) as any[];

    return results.map(r => ({
      id: r.id,
      content: r.content,
      filePath: r.file_path,
      score: -r.score, // FTS5 rank is negative (lower = better), flip it
      source: 'bm25' as const,
    }));
  }

  // ---- STATS ----

  getStats(): { totalChunks: number; totalFiles: number } {
    const row = this.db.prepare(`
      SELECT 
        COUNT(*) as totalChunks,
        COUNT(DISTINCT file_path) as totalFiles
      FROM chunks
    `).get() as any;
    return row;
  }

  // ---- CLEANUP ----

  deleteByFilePath(filePath: string): void {
    this.db.prepare('DELETE FROM chunks WHERE file_path = ?').run(filePath);
    // FTS and vec entries are cleaned up automatically via triggers/rebuild
  }

  close(): void {
    this.db.close();
  }
}
```

### Step 3: Test the Vector Store (20 minutes)

Create `packages/memory/src/test-store.ts`:

```typescript
import { readFileSync } from 'fs';
import { chunkMarkdown } from './chunker.js';
import { embed, embedBatch } from './embedder.js';
import { VectorStore } from './store.js';

async function main() {
  // 1. Create store
  const store = new VectorStore('./test-memory.sqlite');
  console.log('✅ Store created\n');

  // 2. Chunk a document
  const text = readFileSync('../../docs/architechture/architecture.md', 'utf8');
  const chunks = chunkMarkdown(text, 'architecture.md');
  console.log(`📄 Created ${chunks.length} chunks from architecture.md`);

  // 3. Generate embeddings (batch for speed)
  console.log('🧮 Generating embeddings...');
  const batchSize = 10;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch.map(c => c.content));
    allEmbeddings.push(...embeddings);
    process.stdout.write(`  ${Math.min(i + batchSize, chunks.length)}/${chunks.length}\r`);
  }
  console.log(`\n✅ Generated ${allEmbeddings.length} embeddings`);

  // 4. Insert into store
  store.insertChunks(chunks, allEmbeddings);
  console.log('✅ Inserted into database');

  const stats = store.getStats();
  console.log(`📊 Stats: ${stats.totalChunks} chunks from ${stats.totalFiles} files\n`);

  // 5. Test VECTOR search
  console.log('🔍 VECTOR SEARCH: "How does the agent process messages?"');
  const queryEmbed = await embed('How does the agent process messages?');
  const vectorResults = store.searchVector(queryEmbed, 3);
  for (const r of vectorResults) {
    console.log(`  [${r.score.toFixed(3)}] ${r.content.slice(0, 100)}...`);
  }

  // 6. Test BM25 search
  console.log('\n🔍 BM25 SEARCH: "agent loop"');
  const bm25Results = store.searchBM25('agent loop', 3);
  for (const r of bm25Results) {
    console.log(`  [${r.score.toFixed(3)}] ${r.content.slice(0, 100)}...`);
  }

  store.close();
  console.log('\n✅ Done! Check test-memory.sqlite with any SQLite viewer.');
}

main();
```

Run: `npx tsx packages/memory/src/test-store.ts`

---

## ✅ CHECKLIST

- [ ] better-sqlite3 and sqlite-vec installed
- [ ] Three tables created: chunks, chunks_fts, chunks_vec
- [ ] Can insert chunks with embeddings (single + batch)
- [ ] Vector search returns results sorted by similarity
- [ ] BM25 search returns results sorted by keyword relevance
- [ ] Successfully indexed architecture.md and searched it
- [ ] Stats endpoint shows correct counts

---

## 💡 KEY TAKEAWAY

**SQLite + sqlite-vec gives you a free, local vector database. Three tables work together: chunks (text), chunks_fts (keyword search), chunks_vec (meaning search). This is the storage engine for your AI's memory.**

---

## ❓ SELF-CHECK QUESTIONS

1. **What are the three tables and what does each one do?**
   <details><summary>Answer</summary>`chunks` stores the actual text content and metadata. `chunks_fts` is an FTS5 virtual table for fast keyword (BM25) search. `chunks_vec` is a vec0 virtual table for fast vector similarity search. All three reference the same data but enable different search strategies.</details>

2. **Why use Float32Array instead of a regular JavaScript array for embeddings?**
   <details><summary>Answer</summary>sqlite-vec expects binary float data, not JSON. Float32Array stores 768 numbers as raw bytes (3KB) instead of JSON text (~6KB). It's also faster to process because there's no parsing step.</details>

3. **What does `distance` vs `similarity` mean in vector search?**
   <details><summary>Answer</summary>Distance = how far apart two vectors are (lower = more similar, 0 = identical). Similarity = 1 - distance (higher = more similar, 1 = identical). sqlite-vec returns distance, but we convert to similarity because "0.92 similarity" is more intuitive than "0.08 distance."</details>

4. **Why use transactions for batch inserts?**
   <details><summary>Answer</summary>Without transactions, each INSERT is its own transaction — SQLite writes to disk for each one. With 100 inserts, that's 100 disk writes. Wrapping in a transaction does ONE disk write for all 100 inserts. It's 10-100x faster for batch operations.</details>

---

**Next → [Day 13: Hybrid Search (BM25 + Vector)](day-13.md)**
