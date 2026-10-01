export type ChunkHit = {
  chunkId: number;
  noteId: string;
  noteTitle: string;
  noteCreatedAt: number;
  text: string;
  startMs: number;
  endMs: number;
  /** Cosine similarity in [-1, 1]. */
  similarity: number;
};

/** sqlite-vec reports cosine distance (1 - cosine similarity). */
export function distanceToSimilarity(distance: number): number {
  return 1 - distance;
}

/** Standard RRF constant: dampens the influence of top ranks so one list cannot dominate. */
const RRF_K = 60;

/**
 * Hybrid ranking. Vector similarity finds paraphrases ("dentist" for "teeth
 * cleaning"); words find exact names and numbers embeddings blur. Three
 * orderings are combined with reciprocal rank fusion, which avoids having to
 * calibrate a cosine score against a BM25 score:
 *  - vector similarity of each chunk,
 *  - the full-text rank of the chunk's note,
 *  - how many of the question's terms the chunk itself contains, which picks
 *    the right passage inside a note that matched.
 */
export function fuseRankings(
  hits: readonly ChunkHit[],
  keywordNoteIds: readonly string[],
  terms: readonly string[] = [],
): ChunkHit[] {
  const keywordRank = new Map(keywordNoteIds.map((id, index) => [id, index]));
  const lexical = hits.map((hit) => termMatches(hit.text, terms));
  const lexicalOrder = [...lexical.keys()]
    .filter((i) => lexical[i]! > 0)
    .sort((a, b) => lexical[b]! - lexical[a]!);
  const lexicalRank = new Map(lexicalOrder.map((hitIndex, rank) => [hitIndex, rank]));

  const scored = hits.map((hit, index) => {
    const noteRank = keywordRank.get(hit.noteId);
    const chunkRank = lexicalRank.get(index);
    const score =
      1 / (RRF_K + index + 1) +
      (noteRank === undefined ? 0 : 1 / (RRF_K + noteRank + 1)) +
      (chunkRank === undefined ? 0 : 1 / (RRF_K + chunkRank + 1));
    return { hit, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.hit);
}

/** Question terms are plain lowercase words (see questionTerms), so a prefix match on word starts is enough. */
function termMatches(text: string, terms: readonly string[]): number {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return terms.filter((term) => words.some((word) => word.startsWith(term))).length;
}

export type ContextOptions = {
  limit?: number;
  maxPerNote?: number;
  /** Below this, a passage is noise rather than evidence. */
  minSimilarity?: number;
  /**
   * Notes that also matched by keyword skip the similarity floor: an exact
   * word match is evidence on its own, and small embedding models score
   * short, vague questions ("what do I need to buy") low against everything.
   */
  keywordNoteIds?: readonly string[];
};

/**
 * Picks the passages the model sees. Caps passages per note so one long
 * recording cannot crowd out the others, and drops weak matches entirely:
 * fewer, better sources give a small model less to misattribute.
 */
export function selectContext(hits: readonly ChunkHit[], options: ContextOptions = {}): ChunkHit[] {
  const { limit = 4, maxPerNote = 2, minSimilarity = 0.25, keywordNoteIds = [] } = options;
  const keyword = new Set(keywordNoteIds);
  const perNote = new Map<string, number>();
  const selected: ChunkHit[] = [];
  for (const hit of hits) {
    if (!keyword.has(hit.noteId) && hit.similarity < minSimilarity) continue;
    const count = perNote.get(hit.noteId) ?? 0;
    if (count >= maxPerNote) continue;
    perNote.set(hit.noteId, count + 1);
    selected.push(hit);
    if (selected.length >= limit) break;
  }
  return selected;
}

/** Note ids by their best-matching chunk, for semantic search in the notes list. */
export function rankNotes(hits: readonly ChunkHit[], minSimilarity = 0.2): string[] {
  const best = new Map<string, number>();
  for (const hit of hits) {
    if (hit.similarity < minSimilarity) continue;
    best.set(hit.noteId, Math.max(best.get(hit.noteId) ?? -1, hit.similarity));
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
