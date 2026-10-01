import { heuristicEnrichment, heuristicTitle, lexiconMood, topKeywords } from '../heuristics';

describe('heuristicEnrichment', () => {
  const transcript =
    'Okay, so the kitchen renovation quote came in. It is higher than expected but the kitchen plan looks great. ' +
    'I need to call the builder on Monday. Remember to measure the kitchen window.';

  it('derives a title, summary, tags, action items and mood', () => {
    const result = heuristicEnrichment(transcript);
    expect(result.title).toBe('The kitchen renovation quote came in');
    expect(result.summary.startsWith('Okay, so the kitchen')).toBe(true);
    expect(result.tags[0]).toBe('kitchen');
    expect(result.actionItems).toEqual([
      'Call the builder on Monday',
      'Measure the kitchen window',
    ]);
    expect(result.mood).toBe('positive');
  });

  it('copes with an empty transcript', () => {
    expect(heuristicEnrichment('')).toEqual({
      title: 'Voice note',
      summary: 'Empty recording.',
      tags: ['note'],
      actionItems: [],
      mood: 'neutral',
    });
  });
});

describe('heuristicTitle', () => {
  it('trims fillers and long sentences', () => {
    expect(heuristicTitle('um, we should really think about moving the offsite to April.')).toBe(
      'We should really think about moving the...',
    );
  });
});

describe('topKeywords', () => {
  it('ranks by frequency, breaking ties alphabetically, without stopwords', () => {
    expect(topKeywords('budget budget travel travel hotel and the and', 2)).toEqual([
      'budget',
      'travel',
    ]);
  });
});

describe('lexiconMood', () => {
  it.each([
    ['I am so excited and happy', 'positive'],
    ['tired and worried today', 'negative'],
    ['great news but I am stressed', 'mixed'],
    ['the meeting is at three', 'neutral'],
  ])('%p -> %p', (text, mood) => expect(lexiconMood(text)).toBe(mood));
});
