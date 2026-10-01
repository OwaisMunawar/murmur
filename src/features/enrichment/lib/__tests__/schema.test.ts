import { checkFields, toEnrichment, type Fields } from '../schema';

describe('checkFields', () => {
  it('accepts well-formed output and maps it to the domain shape', () => {
    const check = checkFields({
      title: 'Weekend garden jobs',
      summary: 'Compost and the fence.',
      tags: ['Garden', 'family'],
      action_items: ['Buy compost'],
      mood: 'positive',
    });
    expect(check.invalid).toEqual([]);
    expect(toEnrichment(check.valid as Fields)).toEqual({
      title: 'Weekend garden jobs',
      summary: 'Compost and the fence.',
      tags: ['garden', 'family'],
      actionItems: ['Buy compost'],
      mood: 'positive',
    });
  });

  it('normalises the shapes small models drift into', () => {
    const { valid } = checkFields({
      title: '"Groceries for the week."',
      summary: '  Need   milk and eggs.  ',
      tags: 'Food, Errands',
      action_items: '1. Buy milk',
      mood: 'Mixed',
    });
    expect(valid).toEqual({
      title: 'Groceries for the week',
      summary: 'Need milk and eggs.',
      tags: ['food', 'errands'],
      action_items: ['Buy milk'],
      mood: 'mixed',
    });
  });

  it('keeps good fields when others are missing or invalid', () => {
    const check = checkFields({ title: 'Kept', summary: '   ', tags: ['!!!'], mood: 'ecstatic' });
    expect(check.valid).toEqual({ title: 'Kept' });
    expect(check.invalid).toEqual(['summary', 'tags', 'action_items', 'mood']);
    expect(check.issues).toContain('- action_items: missing');
    expect(check.issues).toContain('- mood:');
  });

  it('drops junk action items and accepts an empty string as none', () => {
    expect(checkFields({ action_items: ['-', 'ok then'] }).valid.action_items).toEqual(['ok then']);
    expect(checkFields({ action_items: ' ' }).valid.action_items).toEqual([]);
  });
});

describe('degenerate replies', () => {
  it('rejects titles and summaries without words', () => {
    expect(checkFields({ title: '...', summary: ', ' }).invalid).toEqual(
      expect.arrayContaining(['title', 'summary']),
    );
  });
});
