import { extractJsonObject, salvageFields } from '../parseJson';

describe('extractJsonObject', () => {
  it('parses a bare object', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('finds the object inside prose and code fences', () => {
    const raw = 'Sure! Here you go:\n```json\n{"title": "x", "tags": ["a"]}\n```\nAnything else?';
    expect(extractJsonObject(raw)).toEqual({ ok: true, value: { title: 'x', tags: ['a'] } });
  });

  it('ignores braces inside strings when matching', () => {
    expect(extractJsonObject('{"summary": "use {curly} braces", "n": 2} trailing }')).toEqual({
      ok: true,
      value: { summary: 'use {curly} braces', n: 2 },
    });
  });

  it('repairs single quotes, unquoted keys and trailing commas', () => {
    expect(extractJsonObject("{title: 'Shopping', tags: ['food',],}")).toEqual({
      ok: true,
      value: { title: 'Shopping', tags: ['food'] },
    });
  });

  it('repairs an object truncated by the token limit', () => {
    expect(extractJsonObject('{"title": "Half", "tags": ["a", "b"')).toEqual({
      ok: true,
      value: { title: 'Half', tags: ['a', 'b'] },
    });
  });

  it('strips reasoning blocks some models emit first', () => {
    expect(extractJsonObject('<think>{"wrong": true}</think>{"right": true}')).toEqual({
      ok: true,
      value: { right: true },
    });
  });

  it('handles escaped quotes inside strings', () => {
    expect(extractJsonObject('{"q": "she said \\"hi\\" {"}')).toEqual({
      ok: true,
      value: { q: 'she said "hi" {' },
    });
  });

  it('reports output with no object', () => {
    expect(extractJsonObject('I cannot help with that.')).toEqual({
      ok: false,
      reason: 'no JSON object in output',
    });
  });

  it('reports unrepairable garbage', () => {
    const result = extractJsonObject('{ :: }');
    expect(result.ok).toBe(false);
  });
});

describe('salvageFields', () => {
  const keys = ['title', 'summary', 'tags', 'action_items', 'mood'];

  it('recovers members from output with missing separators', () => {
    const raw =
      '{"title":"Weekday team updates"""tags":["work","launch"]""action_items":["Email Priya"]""mood":positive"}';
    expect(salvageFields(raw, keys)).toEqual({
      title: 'Weekday team updates',
      tags: ['work', 'launch'],
      action_items: ['Email Priya'],
      mood: 'positive',
    });
  });

  it('unescapes quoted values and skips absent keys', () => {
    expect(salvageFields('{"summary": "She said \\"hi\\"."', keys)).toEqual({
      summary: 'She said "hi".',
    });
  });
});
