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
  const store = new VectorStore('./data/lunar-memory.sqlite');

  // Index all docs
  await indexDirectory('../../docs', store);

  const stats = store.getStats();
  console.log(`\n✅ Indexed ${stats.totalChunks} chunks from ${stats.totalFiles} files`);

  store.close();
}

main();
