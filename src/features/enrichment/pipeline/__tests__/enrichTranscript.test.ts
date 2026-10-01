import { AppError } from '@/core/errors/AppError';

import { createFakeTextGenerator } from '../../engine/fakeTextGenerator';
import { type TextGenerator } from '../../engine/TextGenerator';
import { enrichTranscript, readFields } from '../enrichTranscript';

const TRANSCRIPT = 'I need to renew my passport before the Lisbon trip. Excited about the trip.';
const GOOD =
  '{"title":"Passport before Lisbon","summary":"Passport renewal is due before the trip.","tags":["travel"],"action_items":["Renew passport"],"mood":"positive"}';

function scripted(...replies: (string | Error)[]): TextGenerator & { calls(): number } {
  const counter = { calls: 0 };
  const generator = createFakeTextGenerator(() => {
    const reply = replies[Math.min(counter.calls, replies.length - 1)]!;
    counter.calls++;
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { ...generator, calls: () => counter.calls };
}

describe('enrichTranscript', () => {
  it('uses complete model output directly', async () => {
    const result = await enrichTranscript(TRANSCRIPT, scripted(GOOD));
    expect(result).toMatchObject({ source: 'model', attempts: 1, filled: [] });
    expect(result.enrichment.title).toBe('Passport before Lisbon');
    expect(result.generations).toHaveLength(1);
  });

  it('asks again for missing fields and merges the answers', async () => {
    const generator = scripted(
      '{"title":"Passport before Lisbon","summary":"Renew it before the trip."}',
      '{"tags":["travel"],"action_items":["Renew passport"],"mood":"positive"}',
    );
    const result = await enrichTranscript(TRANSCRIPT, generator);
    expect(result).toMatchObject({ source: 'repaired', attempts: 2, filled: [] });
    expect(result.enrichment).toMatchObject({
      title: 'Passport before Lisbon',
      tags: ['travel'],
      mood: 'positive',
    });
    expect(generator.calls()).toBe(2);
  });

  it('fills what the repair could not fix from the heuristic, field by field', async () => {
    const result = await enrichTranscript(
      TRANSCRIPT,
      scripted('{"title":"Passport before Lisbon"}', 'no json'),
    );
    expect(result.source).toBe('repaired');
    expect(result.filled).toEqual(['summary', 'tags', 'action_items', 'mood']);
    expect(result.enrichment.title).toBe('Passport before Lisbon');
    expect(result.enrichment.actionItems).toEqual(['Renew my passport before the Lisbon trip']);
  });

  it('falls back to heuristics when the model produces nothing usable', async () => {
    const result = await enrichTranscript(TRANSCRIPT, scripted('no json here', 'still no json'));
    expect(result).toMatchObject({ source: 'heuristic', attempts: 2 });
    expect(result.filled).toHaveLength(5);
  });

  it('treats a generator error like an empty reply', async () => {
    const result = await enrichTranscript(TRANSCRIPT, scripted(new Error('oom'), GOOD));
    expect(result.source).toBe('repaired');
  });

  it('propagates cancellation instead of falling back', async () => {
    await expect(
      enrichTranscript(TRANSCRIPT, scripted(new AppError('CANCELLED', 'stop'))),
    ).rejects.toMatchObject({
      code: 'CANCELLED',
    });
  });

  it('skips the model when none is installed or there is nothing to enrich', async () => {
    await expect(enrichTranscript(TRANSCRIPT, null)).resolves.toMatchObject({
      source: 'heuristic',
      attempts: 0,
    });
    const generator = scripted(GOOD);
    await expect(enrichTranscript('   ', generator)).resolves.toMatchObject({
      source: 'heuristic',
    });
    expect(generator.calls()).toBe(0);
  });
});

describe('readFields', () => {
  it('rejects fields copied from the worked example', () => {
    expect(
      readFields('{"title":"Bike clicking noise","tags":["bike","travel"]}', TRANSCRIPT),
    ).toEqual({ tags: ['travel'] });
  });
});
