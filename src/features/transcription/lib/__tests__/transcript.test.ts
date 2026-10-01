import {
  activeSegmentIndex,
  cleanTranscript,
  resolveLanguage,
  splitSentences,
  toSentenceSegments,
} from '../transcript';

describe('cleanTranscript', () => {
  it('drops non-speech annotations and special tokens', () => {
    expect(cleanTranscript(' [BLANK_AUDIO] Hello (wind blowing) there <|endoftext|> ')).toBe(
      'Hello there',
    );
  });
});

describe('splitSentences', () => {
  it('splits on terminal punctuation and keeps it', () => {
    expect(splitSentences('One. Two? Three! "Four."')).toEqual([
      'One.',
      'Two?',
      'Three!',
      '"Four."',
    ]);
  });

  it('keeps an unterminated tail', () => {
    expect(splitSentences('First one. and then it trails off')).toEqual([
      'First one.',
      'and then it trails off',
    ]);
    expect(splitSentences('')).toEqual([]);
  });
});

describe('toSentenceSegments', () => {
  it('spreads each chunk span across its sentences by length', () => {
    const segments = toSentenceSegments([
      { startMs: 0, endMs: 10_000, text: 'Short. A much longer sentence here.' },
      { startMs: 10_000, endMs: 14_000, text: '[BLANK_AUDIO]' },
      { startMs: 14_000, endMs: 20_000, text: 'Last one' },
    ]);
    expect(segments.map((s) => s.text)).toEqual([
      'Short.',
      'A much longer sentence here.',
      'Last one',
    ]);
    expect(segments[0]).toMatchObject({ position: 0, startMs: 0 });
    expect(segments[0]!.endMs).toBeLessThan(3_000);
    expect(segments[1]).toMatchObject({ startMs: segments[0]!.endMs, endMs: 10_000 });
    expect(segments[2]).toMatchObject({ position: 2, startMs: 14_000, endMs: 20_000 });
  });
});

describe('activeSegmentIndex', () => {
  const segments = [
    { position: 0, startMs: 0, endMs: 1_000, text: 'a' },
    { position: 1, startMs: 1_000, endMs: 2_000, text: 'b' },
    { position: 2, startMs: 2_000, endMs: 3_000, text: 'c' },
  ];

  it.each([
    [0, 0],
    [999, 0],
    [1_000, 1],
    [2_500, 2],
    [9_000, 2],
  ])('at %p ms -> %p', (ms, index) => expect(activeSegmentIndex(segments, ms)).toBe(index));

  it('is -1 before the first segment or with no segments', () => {
    expect(activeSegmentIndex([], 10)).toBe(-1);
    expect(activeSegmentIndex([{ position: 0, startMs: 500, endMs: 900, text: 'x' }], 10)).toBe(-1);
  });
});

describe('resolveLanguage', () => {
  const supported = ['en', 'de', 'fr'];

  it('prefers an explicit, supported choice', () => {
    expect(resolveLanguage('fr', ['de-DE'], supported)).toBe('fr');
  });

  it('falls back to the first supported device language', () => {
    expect(resolveLanguage(null, ['ur-PK', 'de-DE'], supported)).toBe('de');
    expect(resolveLanguage('xx', ['DE'], supported)).toBe('de');
  });

  it('falls back to English, then to whatever the model has', () => {
    expect(resolveLanguage(null, ['ur-PK'], supported)).toBe('en');
    expect(resolveLanguage(null, [], ['ja'])).toBe('ja');
    expect(resolveLanguage(null, [], [])).toBe('en');
  });
});

describe('splitSentences with numbers', () => {
  it('keeps times and amounts inside their sentence', () => {
    expect(splitSentences('Moved to Friday at 9.15. That costs 3.50 now.')).toEqual([
      'Moved to Friday at 9.15.',
      'That costs 3.50 now.',
    ]);
  });
});
