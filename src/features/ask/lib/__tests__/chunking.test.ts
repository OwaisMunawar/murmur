import { chunkSegments, embeddingInput } from '../chunking';

const seg = (position: number, text: string) => ({
  position,
  startMs: position * 1_000,
  endMs: position * 1_000 + 900,
  text,
});

describe('chunkSegments', () => {
  it('packs sentences up to the budget and keeps time spans', () => {
    const chunks = chunkSegments([seg(0, 'aaaa'), seg(1, 'bbbb'), seg(2, 'cccc')], {
      maxChars: 9,
      overlap: 0,
    });
    expect(chunks).toEqual([
      { position: 0, text: 'aaaa bbbb', startMs: 0, endMs: 1_900 },
      { position: 1, text: 'cccc', startMs: 2_000, endMs: 2_900 },
    ]);
  });

  it('overlaps one sentence between neighbouring chunks', () => {
    const chunks = chunkSegments([seg(0, 'aaaa'), seg(1, 'bbbb'), seg(2, 'cccc')], {
      maxChars: 9,
      overlap: 1,
    });
    expect(chunks.map((c) => c.text)).toEqual(['aaaa bbbb', 'bbbb cccc']);
  });

  it('always advances, even past a sentence longer than the budget', () => {
    const chunks = chunkSegments([seg(0, 'x'.repeat(50)), seg(1, 'y')], { maxChars: 10 });
    expect(chunks.map((c) => c.text)).toEqual(['x'.repeat(50), 'y']);
  });

  it('returns nothing for an empty transcript', () => {
    expect(chunkSegments([])).toEqual([]);
  });
});

describe('embeddingInput', () => {
  it('prefixes the title when there is one', () => {
    expect(embeddingInput('Trip', 'Pack light.')).toBe('Trip. Pack light.');
    expect(embeddingInput('', 'Pack light.')).toBe('Pack light.');
  });
});
