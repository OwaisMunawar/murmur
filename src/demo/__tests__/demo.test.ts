import { type SqlDriver } from '@/core/db/SqlDriver';
import { createChunkRepository } from '@/features/ask/data/chunkRepository';
import { createFakeEmbedder } from '@/features/ask/engine/fakeEmbedder';
import { askQuestion } from '@/features/ask/pipeline/askQuestion';
import { createFakeTextGenerator } from '@/features/enrichment/engine/fakeTextGenerator';
import { enrichTranscript } from '@/features/enrichment/pipeline/enrichTranscript';
import { createNotesRepository } from '@/features/notes/data/notesRepository';
import { createMemoryAudioStore } from '@/features/recording/data/audioStore';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { DEMO_NOTES, DEMO_RECORDING_SCRIPT } from '../notes';
import { demoRespond } from '../responders';
import { seedDemoNotes } from '../seed';
import { sentenceSpans, syntheticSpeech } from '../syntheticAudio';

describe('demo mode', () => {
  let db: SqlDriver;
  beforeEach(async () => {
    db = await createMigratedTestDriver();
  });
  afterEach(() => db.close());

  const deps = () => ({
    notes: createNotesRepository(db),
    chunks: createChunkRepository(db),
    audio: createMemoryAudioStore(),
    embedder: createFakeEmbedder(),
    now: new Date(2026, 9, 1, 12).getTime(),
  });

  it('seeds twelve ready, indexed notes with audio, once', async () => {
    const d = deps();
    await expect(seedDemoNotes(d)).resolves.toBe(12);
    await expect(seedDemoNotes(d)).resolves.toBe(0);
    const notes = await d.notes.list();
    expect(notes).toHaveLength(DEMO_NOTES.length);
    expect(notes.every((n) => n.status === 'ready' && n.title.length > 0)).toBe(true);
    expect(d.audio.size()).toBe(12);
    expect(await d.chunks.notesMissingVectors()).toEqual([]);
    const groceries = notes.find((n) => n.title === 'Groceries for the dinner party')!;
    expect(groceries.openActionCount).toBe(2);
  });

  it('answers a question with a citation to the right note', async () => {
    const d = deps();
    await seedDemoNotes(d);
    const result = await askQuestion(
      {
        embedder: d.embedder,
        chunks: d.chunks,
        keywordSearch: async (q) => (await d.notes.list({ text: q })).map((n) => n.id),
        generator: createFakeTextGenerator(demoRespond),
      },
      'When is my dentist cleaning?',
    );
    expect(result.kind).toBe('answer');
    if (result.kind !== 'answer') return;
    expect(result.cited.length).toBeGreaterThan(0);
    const cited = result.sources[result.cited[0]! - 1];
    expect(cited?.noteTitle).toBe('Dentist moved to Friday');
    expect(result.parts[0]).toEqual({
      type: 'text',
      text: 'Your cleaning moved from Wednesday to Friday at nine fifteen.',
    });
  });

  it('produces valid enrichment JSON through the real validation path', async () => {
    const result = await enrichTranscript(
      DEMO_RECORDING_SCRIPT,
      createFakeTextGenerator(demoRespond),
    );
    expect(result.source).toBe('model');
    expect(result.enrichment.actionItems).toContain(
      'Email Priya the updated budget before ten, and pick up the dry cleaning on the way home',
    );
  });

  it('declines when nothing matches, and ignores unknown prompts', () => {
    expect(
      demoRespond([
        { role: 'system', content: 'numbered sources' },
        { role: 'user', content: 'Sources:\n[1] "x" (Mon)\nhello\n\nQuestion: zebra?' },
      ]),
    ).toBe('I could not find that in your notes.');
    expect(demoRespond([{ role: 'user', content: 'hi' }])).toBe('');
  });
});

describe('syntheticSpeech', () => {
  it('is deterministic, bounded and silent between sentences', () => {
    const spans = sentenceSpans(['One sentence here.', 'Another one.']);
    const a = syntheticSpeech(spans, 6_000, 1_000, 3);
    const b = syntheticSpeech(spans, 6_000, 1_000, 3);
    expect(a).toEqual(b);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(a[0]).toBe(0);
    expect(spans[1]!.startMs).toBeGreaterThan(spans[0]!.endMs);
  });
});
