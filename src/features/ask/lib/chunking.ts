import { type Segment } from '@/features/notes/model';

export type TextChunk = {
  position: number;
  text: string;
  startMs: number;
  endMs: number;
};

export type ChunkOptions = {
  /**
   * Two or three spoken sentences. Longer chunks average several topics into
   * one vector, and a question about one of them ("what do I need to buy")
   * then scores low against all of them.
   */
  maxChars?: number;
  /** Sentences repeated at the start of the next chunk, so ideas spanning a boundary stay retrievable. */
  overlap?: number;
};

/**
 * Groups sentence segments into retrieval chunks. Boundaries fall between
 * sentences, and each chunk keeps the time span of its sentences so a
 * citation can seek playback to where the passage was said.
 */
export function chunkSegments(
  segments: readonly Segment[],
  options: ChunkOptions = {},
): TextChunk[] {
  const { maxChars = 240, overlap = 1 } = options;
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < segments.length) {
    let end = start;
    let length = 0;
    while (end < segments.length) {
      const next = segments[end]!.text.length + (end > start ? 1 : 0);
      if (end > start && length + next > maxChars) break;
      length += next;
      end++;
    }
    const slice = segments.slice(start, end);
    chunks.push({
      position: chunks.length,
      text: slice.map((s) => s.text).join(' '),
      startMs: slice[0]!.startMs,
      endMs: slice[slice.length - 1]!.endMs,
    });
    if (end >= segments.length) break;
    // Always advance, even if one sentence alone exceeds the budget.
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

/** The note title rides along so short chunks still carry their topic into the vector. */
export function embeddingInput(title: string, chunkText: string): string {
  return title ? `${title}. ${chunkText}` : chunkText;
}
