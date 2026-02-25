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
  overlap = 80,
): Chunk[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) return [];

  const chunks: Chunk[] = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    const content = chunkWords.join(' ');

    chunks.push({
      id: `${filePath}:${chunks.length}`,
      content,
      filePath,
      chunkIndex: chunks.length,
      tokenCount: chunkWords.length,
    });

    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

/**
 * Smart chunking: split on markdown headers first, then by size.
 * This keeps related content together.
 */
export function chunkMarkdown(text: string, filePath: string): Chunk[] {
  const sections = text.split(/(?=^#{1,3}\s)/m);

  const chunks: Chunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount <= 400) {
      chunks.push({
        id: `${filePath}:${chunks.length}`,
        content: trimmed,
        filePath,
        chunkIndex: chunks.length,
        tokenCount: wordCount,
      });
    } else {
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
