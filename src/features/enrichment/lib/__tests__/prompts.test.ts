import {
  buildEnrichmentMessages,
  buildRepairMessages,
  EXAMPLE_OUTPUT,
  fitTranscript,
} from '../prompts';

describe('fitTranscript', () => {
  it('leaves short transcripts alone apart from whitespace', () => {
    expect(fitTranscript('  hello \n world ')).toBe('hello world');
  });

  it('keeps the head and tail of long transcripts within the budget', () => {
    const long = `${'start '.repeat(100)}${'middle '.repeat(500)}${'end '.repeat(100)}`;
    const fitted = fitTranscript(long, 1_000);
    expect(fitted.length).toBeLessThanOrEqual(1_000);
    expect(fitted.startsWith('start')).toBe(true);
    expect(fitted.endsWith('end')).toBe(true);
    expect(fitted).toContain(' ... ');
  });
});

describe('message builders', () => {
  it('puts a valid worked example before the real transcript', () => {
    const messages = buildEnrichmentMessages('my note');
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(() => JSON.parse(EXAMPLE_OUTPUT)).not.toThrow();
    expect(messages.at(-1)?.content).toContain('my note');
  });

  it('asks again for only the fields that failed', () => {
    const messages = buildRepairMessages('my note', '{"title": "x"}', ['tags', 'mood']);
    expect(messages.at(-2)).toEqual({ role: 'assistant', content: '{"title": "x"}' });
    expect(messages.at(-1)?.content).toContain('only "tags", "mood"');
  });
});
