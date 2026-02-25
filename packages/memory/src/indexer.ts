import { readFile } from 'fs/promises';
import path from 'path';
import type { VectorStore } from './store.js';
import type { MemoryFiles } from './files.js';
import { chunkMarkdown } from './chunker.js';
import { embedBatch } from './embedder.js';

/**
 * Auto-indexes memory files into the vector store.
 * Tracks last-modified times to only re-index changed files.
 */
export class MemoryIndexer {
  private store: VectorStore;
  private memoryFiles: MemoryFiles;
  private lastIndexed: Map<string, number> = new Map(); // filePath → mtime ms

  constructor(store: VectorStore, memoryFiles: MemoryFiles) {
    this.store = store;
    this.memoryFiles = memoryFiles;
  }

  /**
   * Index a single file into the vector store.
   * Deletes existing chunks for this file first, then re-indexes.
   */
  async indexFile(filePath: string): Promise<number> {
    const content = await readFile(filePath, 'utf8');
    if (!content.trim()) return 0;

    // Use relative path as chunk filePath for consistency
    const relativePath = path.relative(process.cwd(), filePath);

    // Remove old chunks for this file
    this.store.deleteByFilePath(relativePath);

    const chunks = chunkMarkdown(content, relativePath);
    if (chunks.length === 0) return 0;

    const BATCH_SIZE = 10;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await embedBatch(batch.map(c => c.content));
      allEmbeddings.push(...embeddings);
    }

    this.store.insertChunks(chunks, allEmbeddings);
    this.lastIndexed.set(filePath, Date.now());

    return chunks.length;
  }

  /**
   * Index only files that have changed since last indexing.
   */
  async indexChanged(): Promise<{ indexed: number; chunks: number }> {
    const files = await this.memoryFiles.getAllMemoryFiles();
    let totalChunks = 0;
    let indexed = 0;

    for (const { filePath, mtime } of files) {
      const lastTime = this.lastIndexed.get(filePath) ?? 0;
      if (mtime.getTime() > lastTime) {
        const chunks = await this.indexFile(filePath);
        totalChunks += chunks;
        indexed++;
        console.log(`  📝 Indexed ${filePath}: ${chunks} chunks`);
      }
    }

    return { indexed, chunks: totalChunks };
  }

  /**
   * Force re-index all memory files.
   */
  async indexAll(): Promise<{ indexed: number; chunks: number }> {
    this.lastIndexed.clear();
    return this.indexChanged();
  }
}
