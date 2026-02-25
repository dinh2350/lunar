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
      score: 1 - r.distance,
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
  }

  close(): void {
    this.db.close();
  }
}
