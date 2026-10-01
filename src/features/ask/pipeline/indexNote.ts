import { type Segment } from '@/features/notes/model';

import { type ChunkRepository } from '../data/chunkRepository';
import { type Embedder } from '../engine/Embedder';
import { chunkSegments, embeddingInput } from '../lib/chunking';

/** Chunks a transcript, embeds each chunk, and replaces the note's vectors atomically. */
export async function indexNote(
  deps: { embedder: Embedder; chunks: ChunkRepository },
  note: { id: string; title: string; segments: readonly Segment[] },
): Promise<number> {
  const chunks = chunkSegments(note.segments);
  const embedded = [];
  for (const chunk of chunks) {
    embedded.push({
      ...chunk,
      embedding: await deps.embedder.embed(embeddingInput(note.title, chunk.text)),
    });
  }
  await deps.chunks.replaceForNote(note.id, embedded);
  return embedded.length;
}
