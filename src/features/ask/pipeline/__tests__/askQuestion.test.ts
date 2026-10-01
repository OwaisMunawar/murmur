import { type SqlDriver } from '@/core/db/SqlDriver';
import { createFakeTextGenerator } from '@/features/enrichment/engine/fakeTextGenerator';
import { createNotesRepository } from '@/features/notes/data/notesRepository';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { createChunkRepository } from '../../data/chunkRepository';
import { createFakeEmbedder } from '../../engine/fakeEmbedder';
import { askQuestion } from '../askQuestion';
import { indexNote } from '../indexNote';

describe('askQuestion', () => {
  let db: SqlDriver;
  const embedder = createFakeEmbedder();

  beforeEach(async () => {
    db = await createMigratedTestDriver();
    const notes = createNotesRepository(db);
    const chunks = createChunkRepository(db);
    const seed = async (title: string, sentences: string[]) => {
      const id = await notes.create({
        createdAt: Date.UTC(2026, 8, 1),
        durationMs: 10_000,
        audioFile: null,
        language: 'en',
      });
      const segments = sentences.map((text, position) => ({
        position,
        startMs: position * 4_000,
        endMs: position * 4_000 + 3_900,
        text,
      }));
      await notes.saveTranscript(id, segments, 'en');
      await notes.updateTitle(id, title);
      await indexNote({ embedder, chunks }, { id, title, segments });
      return id;
    };
    await seed('Dentist', ['The dentist moved my cleaning to Friday at nine.']);
    await seed('Groceries', ['Buy oat milk, lemons and coffee beans.']);
  });
  afterEach(() => db.close());

  const deps = (generator: Parameters<typeof askQuestion>[0]['generator']) => ({
    embedder,
    chunks: createChunkRepository(db),
    keywordSearch: async (q: string) =>
      (await createNotesRepository(db).list({ text: q })).map((n) => n.id),
    generator,
  });

  it('answers with citations that point at the retrieved sources', async () => {
    const streamed: string[] = [];
    const generator = createFakeTextGenerator(() => 'Your cleaning is on Friday at nine [1].');
    const result = await askQuestion(deps(generator), 'When is the dentist cleaning?', {
      onToken: (partial) => streamed.push(partial),
    });
    expect(result.kind).toBe('answer');
    if (result.kind !== 'answer') return;
    expect(result.cited).toEqual([1]);
    expect(result.sources[0]?.noteTitle).toBe('Dentist');
    expect(result.parts).toContainEqual({ type: 'cite', source: 1 });
    expect(streamed.at(-1)).toBe('Your cleaning is on Friday at nine [1].');
  });

  it('returns passages when no language model is installed', async () => {
    const result = await askQuestion(deps(null), 'oat milk lemons');
    expect(result.kind).toBe('passages');
    if (result.kind === 'passages') expect(result.sources[0]?.noteTitle).toBe('Groceries');
  });

  it('says so when nothing relevant exists', async () => {
    await expect(askQuestion(deps(null), 'quantum chromodynamics lecture')).resolves.toEqual({
      kind: 'nothing-found',
    });
  });

  it('survives a failing keyword search and wraps generator errors', async () => {
    const failing = {
      ...deps(
        createFakeTextGenerator(() => {
          throw new Error('oom');
        }),
      ),
      keywordSearch: () => Promise.reject(new Error('fts down')),
    };
    await expect(askQuestion(failing, 'dentist cleaning friday')).rejects.toMatchObject({
      code: 'GENERATION_FAILED',
    });
  });
});
