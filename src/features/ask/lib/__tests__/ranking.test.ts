import {
  distanceToSimilarity,
  fuseRankings,
  rankNotes,
  selectContext,
  type ChunkHit,
} from '../ranking';

const hit = (chunkId: number, noteId: string, similarity: number): ChunkHit => ({
  chunkId,
  noteId,
  noteTitle: noteId,
  noteCreatedAt: 0,
  text: `chunk ${chunkId}`,
  startMs: 0,
  endMs: 1,
  similarity,
});

describe('distanceToSimilarity', () => {
  it('inverts cosine distance', () => {
    expect(distanceToSimilarity(0)).toBe(1);
    expect(distanceToSimilarity(1.5)).toBe(-0.5);
  });
});

describe('fuseRankings', () => {
  it('lifts chunks whose note also matched by keyword', () => {
    const hits = [hit(1, 'a', 0.9), hit(2, 'b', 0.85), hit(3, 'c', 0.8)];
    expect(fuseRankings(hits, ['c']).map((h) => h.chunkId)).toEqual([3, 1, 2]);
  });

  it('keeps vector order when nothing matched by keyword', () => {
    const hits = [hit(1, 'a', 0.9), hit(2, 'b', 0.85)];
    expect(fuseRankings(hits, []).map((h) => h.chunkId)).toEqual([1, 2]);
  });
});

describe('fuseRankings by chunk terms', () => {
  it('prefers the passage that contains the question terms', () => {
    const hits = [
      { ...hit(1, 'a', 0.5), text: 'The dentist moved my cleaning to Friday.' },
      { ...hit(2, 'a', 0.45), text: 'Also remember to buy oat milk.' },
    ];
    expect(fuseRankings(hits, ['a'], ['buy']).map((h) => h.chunkId)).toEqual([2, 1]);
  });
});

describe('selectContext', () => {
  it('caps passages per note, drops weak matches and respects the limit', () => {
    const hits = [
      hit(1, 'a', 0.9),
      hit(2, 'a', 0.88),
      hit(3, 'a', 0.87),
      hit(4, 'b', 0.6),
      hit(5, 'c', 0.1),
    ];
    expect(
      selectContext(hits, { limit: 3, maxPerNote: 2, minSimilarity: 0.25 }).map((h) => h.chunkId),
    ).toEqual([1, 2, 4]);
    expect(selectContext(hits, { limit: 1 }).map((h) => h.chunkId)).toEqual([1]);
  });
});

describe('selectContext with keyword matches', () => {
  it('lets keyword-matched notes through whatever their similarity', () => {
    const hits = [hit(1, 'a', 0.05), hit(2, 'b', 0.05)];
    expect(
      selectContext(hits, { minSimilarity: 0.25, keywordNoteIds: ['b'] }).map((h) => h.chunkId),
    ).toEqual([2]);
  });
});

describe('rankNotes', () => {
  it('orders notes by their best chunk and ignores weak ones', () => {
    const hits = [hit(1, 'a', 0.5), hit(2, 'b', 0.7), hit(3, 'a', 0.9), hit(4, 'c', 0.05)];
    expect(rankNotes(hits)).toEqual(['a', 'b']);
  });
});
