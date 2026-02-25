# Day 19 — Long-Term Memory (MEMORY.md + Daily Logs + Auto-Index)

> 🎯 **DAY GOAL:** Build a 3-tier memory system — session history + permanent facts + daily notes, all searchable

---

## 📚 CONCEPT 1: The 3-Tier Memory Architecture

### WHAT — Simple Definition

**Three layers of memory, each for different types of information:**

```
TIER 1: SESSION HISTORY (JSONL transcripts) — already built!
  What: the current conversation
  Lifespan: loaded on each message, last 20 turns
  Example: "User just said hello 5 seconds ago"

TIER 2: PERMANENT MEMORY (MEMORY.md)
  What: facts that never change
  Lifespan: forever (no temporal decay)
  Example: "User's name is Hao", "Preferred language: TypeScript"

TIER 3: DAILY NOTES (memory/YYYY-MM-DD.md)
  What: time-specific information
  Lifespan: decays over time (temporal decay from Day 15)
  Example: "Meeting at 2pm today", "Working on RAG feature"
```

### WHY — Why Three Tiers?

```
Single tier (everything in one place):
  ❌ "User's name is Hao" and "meeting at 2pm today" rank equally
  ❌ Old meeting notes clutter search results
  ❌ Can't tell what's permanent vs temporary

Three tiers:
  ✅ Permanent facts always searchable (no decay)
  ✅ Daily notes fade over time (temporal decay)
  ✅ Session history provides immediate context
  ✅ Each tier is easy to browse manually (just markdown files!)
```

### HOW — File System Layout

```
~/.lunar/agents/main/workspace/
├── MEMORY.md                    ← TIER 2: Permanent facts
│   ## User Profile
│   Name: Hao
│   Role: Node.js Developer
│   
│   ## Preferences
│   Favorite restaurant: Pho 99
│   Preferred language: TypeScript
│
├── memory/                      ← TIER 3: Daily notes
│   ├── 2026-02-23.md           ← 2 days ago (decayed score)
│   ├── 2026-02-24.md           ← yesterday
│   └── 2026-02-25.md           ← today (full score)
│
└── data/
    └── sessions/                ← TIER 1: Session transcripts
        ├── agent-main-telegram-user-123.jsonl
        └── agent-main-cli-local.jsonl
```

### 🔗 NODE.JS ANALOGY

```
Tier 1 (sessions) = req.session       → per-request context
Tier 2 (MEMORY.md) = database record  → permanent user profile
Tier 3 (daily notes) = log files      → time-stamped events
```

---

## 🔨 HANDS-ON: Build the Memory File System + Auto-Indexer

### Step 1: Memory File Manager (25 minutes)

Create `packages/memory/src/files.ts`:

```typescript
import { existsSync, readFileSync, readdirSync } from 'fs';
import { readFile, appendFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export class MemoryFiles {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  // ---- PERMANENT MEMORY (MEMORY.md) ----

  get memoryFilePath(): string {
    return path.join(this.basePath, 'MEMORY.md');
  }

  async readPermanentMemory(): Promise<string> {
    if (!existsSync(this.memoryFilePath)) return '';
    return readFile(this.memoryFilePath, 'utf8');
  }

  async appendPermanentMemory(key: string, content: string): Promise<void> {
    await this.ensureDir(this.basePath);
    const entry = `\n## ${key}\n${content}\n_Updated: ${new Date().toISOString()}_\n`;
    await appendFile(this.memoryFilePath, entry);
  }

  // ---- DAILY NOTES (memory/YYYY-MM-DD.md) ----

  get dailyDir(): string {
    return path.join(this.basePath, 'memory');
  }

  todayFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.dailyDir, `${date}.md`);
  }

  async appendDailyNote(key: string, content: string): Promise<void> {
    await this.ensureDir(this.dailyDir);
    const filePath = this.todayFilePath();
    
    // Add header if file is new
    if (!existsSync(filePath)) {
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      await writeFile(filePath, `# Daily Notes — ${date}\n`);
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const entry = `\n## ${key} (${time})\n${content}\n`;
    await appendFile(filePath, entry);
  }

  // ---- LIST ALL MEMORY FILES (for indexing) ----

  getAllMemoryFiles(): string[] {
    const files: string[] = [];

    // MEMORY.md
    if (existsSync(this.memoryFilePath)) {
      files.push(this.memoryFilePath);
    }

    // Daily notes
    if (existsSync(this.dailyDir)) {
      const dailyFiles = readdirSync(this.dailyDir)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(this.dailyDir, f));
      files.push(...dailyFiles);
    }

    return files;
  }

  private async ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
  }
}
```

### Step 2: Auto-Indexer (30 minutes)

Create `packages/memory/src/indexer.ts`:

```typescript
import { readFileSync, statSync } from 'fs';
import path from 'path';
import { chunkMarkdown } from './chunker.js';
import { embedBatch } from './embedder.js';
import type { VectorStore } from './store.js';
import { MemoryFiles } from './files.js';

/**
 * Auto-indexer: keeps the vector store in sync with memory files.
 * 
 * HOW IT WORKS:
 *   1. Check each memory file's last-modified time
 *   2. If newer than last index time → re-chunk + re-embed + update store
 *   3. Runs after every memory_write and periodically
 */
export class MemoryIndexer {
  private store: VectorStore;
  private memoryFiles: MemoryFiles;
  private lastIndexed: Map<string, number> = new Map(); // filePath → timestamp

  constructor(store: VectorStore, memoryFiles: MemoryFiles) {
    this.store = store;
    this.memoryFiles = memoryFiles;
  }

  /** Index all memory files that have changed since last index */
  async indexChanged(): Promise<{ indexed: number; skipped: number }> {
    const files = this.memoryFiles.getAllMemoryFiles();
    let indexed = 0;
    let skipped = 0;

    for (const filePath of files) {
      const stat = statSync(filePath);
      const lastMod = stat.mtimeMs;
      const lastIdx = this.lastIndexed.get(filePath) || 0;

      if (lastMod <= lastIdx) {
        skipped++;
        continue;
      }

      // File changed — re-index
      await this.indexFile(filePath);
      this.lastIndexed.set(filePath, Date.now());
      indexed++;
    }

    return { indexed, skipped };
  }

  /** Index a single file: delete old chunks, re-chunk, re-embed, re-insert */
  async indexFile(filePath: string): Promise<number> {
    const relativePath = path.relative(this.memoryFiles['basePath'], filePath);
    const text = readFileSync(filePath, 'utf8');

    // Delete old chunks for this file
    this.store.deleteByFilePath(relativePath);

    // Re-chunk
    const chunks = chunkMarkdown(text, relativePath);
    if (chunks.length === 0) return 0;

    // Re-embed in batches
    const batchSize = 10;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await embedBatch(batch.map(c => c.content));
      allEmbeddings.push(...embeddings);
    }

    // Re-insert
    this.store.insertChunks(chunks, allEmbeddings);

    console.log(`  📝 Indexed ${relativePath}: ${chunks.length} chunks`);
    return chunks.length;
  }

  /** Index everything from scratch */
  async indexAll(): Promise<number> {
    const files = this.memoryFiles.getAllMemoryFiles();
    let total = 0;

    for (const filePath of files) {
      total += await this.indexFile(filePath);
      this.lastIndexed.set(filePath, Date.now());
    }

    return total;
  }
}
```

### Step 3: Update memory_write to Auto-Index (15 minutes)

Update the memory_write tool to trigger re-indexing after writing:

```typescript
// In packages/tools/src/memory-write.ts — update executor

export function createMemoryWriteExecutor(
  store: VectorStore,
  memoryFiles: MemoryFiles,
  indexer: MemoryIndexer
) {
  return async function executeMemoryWrite(
    args: { key: string; content: string; permanent?: string }
  ): Promise<ToolResult> {
    const isPermanent = args.permanent === 'true';

    // Write to the appropriate file
    if (isPermanent) {
      await memoryFiles.appendPermanentMemory(args.key, args.content);
    } else {
      await memoryFiles.appendDailyNote(args.key, args.content);
    }

    // Re-index immediately (so it's searchable right away)
    await indexer.indexChanged();

    return {
      name: 'memory_write',
      result: `Saved "${args.key}" to ${isPermanent ? 'permanent memory' : 'daily notes'}.`,
      success: true,
      durationMs: Date.now() - startTime,
    };
  };
}
```

### Step 4: Test Full Flow (15 minutes)

```
You: Remember my name is Hao (permanently)
🔧 memory_write({"key":"name","content":"Hao","permanent":"true"})
📝 Indexed MEMORY.md: 1 chunk
✅ Saved "name" to permanent memory.

You: I have a meeting at 3pm about the RAG feature
🔧 memory_write({"key":"meeting","content":"3pm - RAG feature discussion","permanent":"false"})
📝 Indexed memory/2026-02-25.md: 1 chunk
✅ Saved "meeting" to daily notes.

You: What's my name?
🔧 memory_search({"query":"name"})
📎 Found: [MEMORY.md] "## name\nHao"
Lunar: Your name is Hao!

You: Do I have any meetings today?
🔧 memory_search({"query":"meetings today"})
📎 Found: [memory/2026-02-25.md] "## meeting (3:00 PM)\n3pm - RAG feature discussion"
Lunar: Yes! You have a meeting at 3pm about the RAG feature.

Check files:
  cat ~/.lunar/agents/main/workspace/MEMORY.md
  cat ~/.lunar/agents/main/workspace/memory/2026-02-25.md
```

---

## ✅ CHECKLIST

- [ ] MEMORY.md stores permanent facts
- [ ] Daily markdown files store time-specific notes
- [ ] Auto-indexer detects changed files and re-indexes
- [ ] memory_write triggers immediate re-indexing
- [ ] Written content is searchable immediately
- [ ] All memory files are human-readable markdown

---

## 💡 KEY TAKEAWAY

**3-tier memory (session + permanent + daily) with auto-indexing gives Lunar persistent, searchable memory. Files are simple markdown — you can read, edit, or delete them manually anytime. The auto-indexer keeps the vector store in sync.**

---

**Next → [Day 20: Gateway Integration](day-20.md)**
