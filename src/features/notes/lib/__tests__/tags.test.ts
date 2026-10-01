import { normalizeTag, normalizeTags, parseTagInput } from '../tags';

describe('normalizeTag', () => {
  it.each([
    ['Project Atlas!', 'project-atlas'],
    ['#health', 'health'],
    ['  --weird__spacing--  ', 'weird-spacing'],
    ['Ünïcode Straße', 'ünïcode-straße'],
    ['a-very-long-tag-that-goes-on-and-on', 'a-very-long-tag-that-goe'],
    ['!!!', null],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });

  it('never leaves a trailing dash after truncation', () => {
    expect(normalizeTag('abcdefghijklmnopqrstuvw yz')).toBe('abcdefghijklmnopqrstuvw');
  });
});

describe('normalizeTags', () => {
  it('dedupes after normalising and respects the limit', () => {
    expect(normalizeTags(['Work', 'work', '#WORK', 'home', 'a', 'b', 'c', 'd'], 3)).toEqual([
      'work',
      'home',
      'a',
    ]);
  });
});

describe('parseTagInput', () => {
  it('splits on commas and whitespace', () => {
    expect(parseTagInput('work, ideas #home')).toEqual(['work', 'ideas', 'home']);
  });
});
