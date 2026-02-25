import { readFile, appendFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * 3-tier memory file system:
 * 1. MEMORY.md — permanent facts (name, preferences, important info)
 * 2. memory/YYYY-MM-DD.md — daily notes (ephemeral, timestamped)
 * 3. Session JSONL — handled by SessionManager
 *
 * This class manages tiers 1 and 2.
 */
export class MemoryFiles {
  private basePath: string;

  constructor(basePath = './data/workspace') {
    this.basePath = basePath;
  }

  get permanentPath(): string {
    return path.join(this.basePath, 'MEMORY.md');
  }

  get dailyDir(): string {
    return path.join(this.basePath, 'memory');
  }

  /**
   * Read permanent memory (MEMORY.md).
   */
  async readPermanentMemory(): Promise<string> {
    const filePath = this.permanentPath;
    if (!existsSync(filePath)) return '';
    return readFile(filePath, 'utf8');
  }

  /**
   * Append a fact to permanent memory.
   */
  async appendPermanentMemory(key: string, content: string): Promise<string> {
    await mkdir(this.basePath, { recursive: true });
    const entry = `\n## ${key}\n${content}\n_Saved: ${new Date().toISOString()}_\n`;
    await appendFile(this.permanentPath, entry);
    return this.permanentPath;
  }

  /**
   * Append a note to today's daily file.
   */
  async appendDailyNote(key: string, content: string): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const filePath = path.join(this.dailyDir, `${today}.md`);
    await mkdir(this.dailyDir, { recursive: true });

    const entry = `\n## ${key}\n${content}\n_Saved: ${new Date().toISOString()}_\n`;
    await appendFile(filePath, entry);
    return filePath;
  }

  /**
   * Read a specific daily file.
   */
  async readDailyNote(date: string): Promise<string> {
    const filePath = path.join(this.dailyDir, `${date}.md`);
    if (!existsSync(filePath)) return '';
    return readFile(filePath, 'utf8');
  }

  /**
   * Get all memory files (permanent + daily) with their paths and modification times.
   */
  async getAllMemoryFiles(): Promise<{ filePath: string; mtime: Date }[]> {
    const files: { filePath: string; mtime: Date }[] = [];

    // Permanent memory
    if (existsSync(this.permanentPath)) {
      const s = await stat(this.permanentPath);
      files.push({ filePath: this.permanentPath, mtime: s.mtime });
    }

    // Daily notes
    if (existsSync(this.dailyDir)) {
      const entries = await readdir(this.dailyDir);
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue;
        const fullPath = path.join(this.dailyDir, entry);
        const s = await stat(fullPath);
        files.push({ filePath: fullPath, mtime: s.mtime });
      }
    }

    return files;
  }
}
