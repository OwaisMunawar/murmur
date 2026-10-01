import { answerText, parseCitations } from '../citations';

describe('parseCitations', () => {
  it('splits text and citations and lists cited sources in order', () => {
    const parsed = parseCitations('You need oat milk [2] and lemons [1].', 3);
    expect(parsed.parts).toEqual([
      { type: 'text', text: 'You need oat milk' },
      { type: 'cite', source: 2 },
      { type: 'text', text: ' and lemons' },
      { type: 'cite', source: 1 },
      { type: 'text', text: '.' },
    ]);
    expect(parsed.cited).toEqual([2, 1]);
  });

  it('handles grouped and adjacent citations', () => {
    expect(parseCitations('Both [1, 3][3]', 3)).toEqual({
      parts: [
        { type: 'text', text: 'Both' },
        { type: 'cite', source: 1 },
        { type: 'cite', source: 3 },
        { type: 'cite', source: 3 },
      ],
      cited: [1, 3],
    });
  });

  it('drops citations to sources that do not exist', () => {
    expect(parseCitations('Made up [5] fact [0].', 2)).toEqual({
      parts: [{ type: 'text', text: 'Made up fact.' }],
      cited: [],
    });
  });

  it('points any citation at the only source when there is just one', () => {
    expect(parseCitations('Oat milk [2].', 1)).toEqual({
      parts: [
        { type: 'text', text: 'Oat milk' },
        { type: 'cite', source: 1 },
        { type: 'text', text: '.' },
      ],
      cited: [1],
    });
  });

  it('leaves answers without citations as one text part', () => {
    expect(parseCitations('Nothing about that.', 2)).toEqual({
      parts: [{ type: 'text', text: 'Nothing about that.' }],
      cited: [],
    });
  });
});

describe('answerText', () => {
  it('renders a readable plain-text answer', () => {
    expect(answerText(parseCitations('Milk [1].', 1).parts)).toBe('Milk [1].');
  });
});
