import { buildFtsQuery } from '../ftsQuery';

describe('buildFtsQuery', () => {
  it('quotes each word as a prefix term joined with AND', () => {
    expect(buildFtsQuery('Grocery list')).toBe('"grocery"* AND "list"*');
  });

  it('neutralises FTS5 syntax instead of passing it through', () => {
    expect(buildFtsQuery('title:"x" OR -y NEAR(z)')).toBe(
      '"title"* AND "x"* AND "or"* AND "y"* AND "near"* AND "z"*',
    );
  });

  it('keeps non-latin letters and digits', () => {
    expect(buildFtsQuery('café 2026 日本')).toBe('"café"* AND "2026"* AND "日本"*');
  });

  it('returns null when nothing searchable is left', () => {
    expect(buildFtsQuery('  ?! ')).toBeNull();
  });

  it('caps the number of terms', () => {
    expect(buildFtsQuery('a b c d e f g h i j')?.split(' AND ')).toHaveLength(8);
  });
});

describe('buildFtsQuery any-mode', () => {
  it('keeps only meaningful words from a question and ORs them', () => {
    expect(buildFtsQuery('What do I need to buy?', 'any')).toBe('"buy"*');
    expect(buildFtsQuery('Where am I staying in Lisbon', 'any')).toBe('"staying"* OR "lisbon"*');
    expect(buildFtsQuery('what is it', 'any')).toBeNull();
  });
});
